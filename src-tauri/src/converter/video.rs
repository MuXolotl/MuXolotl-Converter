use super::builder::FfmpegBuilder;
use super::spawn_ffmpeg;
use crate::codec_map;
use crate::codec_registry;
use crate::formats::video::{self, VideoFormat};
use crate::gpu::GpuInfo;
use crate::media::{self, MediaInfo};
use crate::types::{ConversionSettings, Quality};
use crate::utils;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::process::Child;
use tokio::sync::Mutex;

pub async fn convert(
    window: tauri::WebviewWindow,
    input: &str,
    output: &str,
    format: &str,
    gpu_info: GpuInfo,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    // Pre-flight validation: ensure input file still exists
    utils::validate_input_path(input)?;

    let task_id = settings.task_id();
    let fmt = video::get_format(format).context("Unknown video format")?;
    let media = media::detect_media_type(&window.app_handle(), input).await?;

    // ========== GIF special path ==========
    if format == "gif" {
        return convert_to_gif(window, input, output, &media, &settings, task_id, processes).await;
    }

    // ========== Stream copy fast path ==========
    if can_copy_video_stream(&media, &fmt, &settings) {
        tracing::info!(
            task_id = %task_id,
            "Using video stream copy — no re-encoding needed"
        );
        let _ = window.emit(
            "conversion-info",
            serde_json::json!({
                "task_id": &task_id,
                "message": "Using stream copy — no re-encoding needed",
            }),
        );

        let mut builder = FfmpegBuilder::new(input, output)
            .hide_banner()
            .overwrite()
            .input_file()
            .progress_pipe()
            .metadata(&settings.metadata)
            .video_codec("copy");

        builder = apply_audio_settings(builder, &fmt, &media, &settings);
        builder = apply_container_settings(builder, &fmt);

        let (args, output_path) = builder.build();
        return spawn_ffmpeg(window, task_id, media.duration, args, output_path, processes).await;
    }

    // ========== Normal conversion path ==========
    let use_gpu = should_use_gpu(&gpu_info, &settings, &fmt);
    let mut video_codec = determine_video_codec(&fmt, &gpu_info, use_gpu, &settings);

    // Pre-validate GPU codec
    if codec_map::is_gpu_encoder(&video_codec) && !gpu_info.is_encoder_available(&video_codec) {
        if let Some(sw) = codec_map::software_fallback_for_encoder(&video_codec) {
            tracing::warn!(
                encoder = %video_codec,
                gpu = %gpu_info.name,
                fallback = %sw,
                "GPU encoder not available, falling back to software"
            );
            let _ = window.emit(
                "conversion-fallback",
                serde_json::json!({
                    "task_id": &task_id,
                    "from": &video_codec,
                    "to": &sw,
                    "reason": format!("{} not supported by {}", video_codec, gpu_info.name),
                }),
            );
            video_codec = sw.to_string();
        }
    }

    // Check codec registry (FFmpeg build support)
    if !codec_map::is_gpu_encoder(&video_codec)
        && codec_registry::is_initialized()
        && !codec_registry::is_encoder_available(&video_codec)
    {
        if let Some(alt) = find_available_encoder(&fmt) {
            tracing::warn!(
                encoder = %video_codec,
                alternative = %alt,
                "Encoder not available in FFmpeg build, using alternative"
            );
            video_codec = alt;
        } else {
            anyhow::bail!(
                "Encoder '{}' not available in this FFmpeg build",
                video_codec
            );
        }
    }

    // Verify format compatibility
    if !fmt.supports_video_codec(&video_codec) {
        if let Some(sw) = codec_map::software_fallback_for_encoder(&video_codec) {
            if fmt.supports_video_codec(sw) {
                video_codec = sw.to_string();
            } else {
                anyhow::bail!(
                    "No compatible codec for format '{}' (tried: {})",
                    fmt.extension,
                    video_codec
                );
            }
        } else {
            anyhow::bail!(
                "Codec '{}' not compatible with {}",
                video_codec,
                fmt.extension
            );
        }
    }

    let mut builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite()
        .input_file()
        .progress_pipe()
        .metadata(&settings.metadata)
        .video_codec(&video_codec)
        .apply_video_codec_preset(&video_codec, settings.quality);

    // Auto-bitrate for codecs that need explicit bitrate (AMF)
    if settings.bitrate.is_none() && video_codec.contains("amf") {
        let width = settings
            .width
            .unwrap_or_else(|| media.primary_video().map(|v| v.width).unwrap_or(1920));
        let height = settings
            .height
            .unwrap_or_else(|| media.primary_video().map(|v| v.height).unwrap_or(1080));
        let fps = settings.fps.unwrap_or_else(|| {
            media
                .primary_video()
                .map(|v| v.fps.round() as u32)
                .unwrap_or(30)
        });
        let target_bitrate =
            calculate_auto_bitrate(width, height, fps, settings.quality, &video_codec);
        builder = builder
            .arg("-b:v", &format!("{}k", target_bitrate))
            .arg(
                "-maxrate",
                &format!("{}k", (target_bitrate as f64 * 1.5) as u32),
            )
            .arg("-bufsize", &format!("{}k", target_bitrate * 2));
    } else if let Some(br) = settings.bitrate {
        builder = builder.arg("-b:v", &format!("{}k", br));
    }

    builder = apply_resolution(builder, &fmt, &media, &settings);

    if let Some(fps) = settings.fps {
        builder = builder.fps(fps);
    }

    // Pixel format
    if video_codec.contains("amf") {
        builder = builder.pixel_format("nv12");
    } else if let Some(pix_fmt) = &fmt.default_pixel_format {
        builder = builder.pixel_format(pix_fmt);
    }

    builder = apply_audio_settings(builder, &fmt, &media, &settings);
    builder = apply_container_settings(builder, &fmt);

    let (args, output_path) = builder.build();

    // Try conversion, with automatic GPU→software fallback on failure
    match spawn_ffmpeg(
        window.clone(),
        task_id.clone(),
        media.duration,
        args,
        output_path.clone(),
        processes.clone(),
    )
    .await
    {
        Ok(result) => Ok(result),
        Err(e) if codec_map::software_fallback_for_encoder(&video_codec).is_some() => {
            let sw_codec = codec_map::software_fallback_for_encoder(&video_codec).unwrap();
            tracing::warn!(
                encoder = %video_codec,
                fallback = %sw_codec,
                error = %e,
                "GPU encoder failed at runtime, retrying with software fallback"
            );

            let _ = window.emit(
                "conversion-fallback",
                serde_json::json!({
                    "task_id": &task_id,
                    "from": &video_codec,
                    "to": &sw_codec,
                    "reason": format!("Runtime error: {}", e),
                }),
            );

            let mut retry = FfmpegBuilder::new(input, output)
                .hide_banner()
                .overwrite()
                .input_file()
                .progress_pipe()
                .metadata(&settings.metadata)
                .video_codec(sw_codec)
                .apply_video_codec_preset(sw_codec, settings.quality);

            if let Some(br) = settings.bitrate {
                retry = retry.arg("-b:v", &format!("{}k", br));
            }

            retry = apply_resolution(retry, &fmt, &media, &settings);

            if let Some(fps) = settings.fps {
                retry = retry.fps(fps);
            }

            if let Some(pix_fmt) = &fmt.default_pixel_format {
                retry = retry.pixel_format(pix_fmt);
            }

            retry = apply_audio_settings(retry, &fmt, &media, &settings);
            retry = apply_container_settings(retry, &fmt);

            let (retry_args, retry_output) = retry.build();
            spawn_ffmpeg(
                window,
                task_id,
                media.duration,
                retry_args,
                retry_output,
                processes,
            )
            .await
        }
        Err(e) => Err(e),
    }
}

// ============ GIF conversion ============

async fn convert_to_gif(
    window: tauri::WebviewWindow,
    input: &str,
    output: &str,
    media: &MediaInfo,
    settings: &ConversionSettings,
    task_id: String,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let gif_fps = settings.fps.unwrap_or(15).min(20);

    let scale_part = match (settings.width, settings.height) {
        (Some(w), Some(h)) => format!("scale={}:{}:flags=lanczos", w, h),
        (Some(w), None) => format!("scale={}:-2:flags=lanczos", w),
        (None, Some(h)) => format!("scale=-2:{}:flags=lanczos", h),
        (None, None) => {
            let source_width = media.primary_video().map(|v| v.width).unwrap_or(640);
            if source_width > 480 {
                "scale=480:-2:flags=lanczos".to_string()
            } else {
                format!("scale={}:-2:flags=lanczos", source_width)
            }
        }
    };

    let filter_complex = format!(
        "[0:v]fps={},{},split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a",
        gif_fps, scale_part
    );

    tracing::info!(
        task_id = %task_id,
        fps = gif_fps,
        "Converting to GIF with palette optimization"
    );

    let builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite()
        .input_file()
        .progress_pipe()
        .filter_complex(&filter_complex)
        .disable_audio()
        .arg("-loop", "0")
        .format("gif");

    let (args, output_path) = builder.build();
    spawn_ffmpeg(window, task_id, media.duration, args, output_path, processes).await
}

// ============ Stream copy detection ============

fn can_copy_video_stream(
    media: &MediaInfo,
    fmt: &VideoFormat,
    settings: &ConversionSettings,
) -> bool {
    let video = match media.primary_video() {
        Some(v) => v,
        None => return false,
    };

    if settings.video_codec.is_some() {
        return false;
    }
    if settings.width.is_some() || settings.height.is_some() {
        return false;
    }
    if settings.fps.is_some() {
        return false;
    }
    if fmt.requires_fixed_resolution {
        return false;
    }
    if let Some((max_w, max_h)) = fmt.max_resolution {
        if video.width > max_w || video.height > max_h {
            return false;
        }
    }

    fmt.supports_video_codec(&video.codec)
}

// ============ Helpers ============

fn find_available_encoder(fmt: &VideoFormat) -> Option<String> {
    for codec_type in &fmt.video_codecs {
        let sw_name = codec_map::software_encoder_for_codec(codec_type)
            .unwrap_or(codec_type);
        if codec_registry::is_encoder_available(sw_name) {
            return Some(sw_name.to_string());
        }
    }
    None
}

fn calculate_auto_bitrate(
    width: u32,
    height: u32,
    fps: u32,
    quality: Quality,
    codec: &str,
) -> u32 {
    let pixels = width as f64 * height as f64;

    let base_bpp = match quality {
        Quality::Low => 0.05,
        Quality::Medium => 0.10,
        Quality::High => 0.18,
        Quality::Ultra => 0.30,
        Quality::Custom => 0.12,
    };

    let efficiency = if codec.contains("av1") {
        0.55
    } else if codec.contains("hevc") || codec.contains("vp9") || codec.contains("libx265") {
        0.65
    } else if codec.contains("vp8") {
        0.85
    } else {
        1.00
    };

    ((pixels * fps as f64 * base_bpp * efficiency) / 1000.0) as u32
}

fn should_use_gpu(gpu: &GpuInfo, settings: &ConversionSettings, fmt: &VideoFormat) -> bool {
    gpu.available && settings.use_gpu && !fmt.requires_fixed_resolution
}

fn determine_video_codec(
    fmt: &VideoFormat,
    gpu: &GpuInfo,
    use_gpu: bool,
    settings: &ConversionSettings,
) -> String {
    if let Some(codec) = &settings.video_codec {
        return codec.clone();
    }

    fmt.get_recommended_video_codec(gpu, use_gpu)
        .unwrap_or_else(|| "libx264".to_string())
}

fn apply_resolution(
    builder: FfmpegBuilder,
    fmt: &VideoFormat,
    media: &MediaInfo,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    if fmt.requires_fixed_resolution {
        let source_height = media.primary_video().map(|v| v.height).unwrap_or(576);
        let height = if source_height <= 480 { 480 } else { 576 };
        let fps = if height == 480 { "30000/1001" } else { "25" };
        return builder
            .resolution(Some(720), Some(height), true)
            .arg("-r", fps);
    }

    if settings.width.is_some() || settings.height.is_some() {
        return builder.resolution(settings.width, settings.height, false);
    }

    if let Some((max_w, max_h)) = fmt.max_resolution {
        if let Some(video) = media.primary_video() {
            if video.width > max_w || video.height > max_h {
                tracing::info!(
                    source = format!("{}x{}", video.width, video.height),
                    max = format!("{}x{}", max_w, max_h),
                    format = %fmt.extension,
                    "Auto-downscaling to fit format resolution limits"
                );
                return builder.resolution_fit(max_w, max_h);
            }
        }
    }

    builder
}

fn apply_audio_settings(
    builder: FfmpegBuilder,
    fmt: &VideoFormat,
    media: &MediaInfo,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    if media.audio_streams.is_empty() || fmt.audio_codecs.is_empty() {
        return builder.disable_audio();
    }

    let input_codec = media.audio_codec().unwrap_or("");

    if let Some(requested) = &settings.audio_codec {
        if fmt.supports_audio_codec(requested) {
            return builder.audio_codec(requested);
        }
    }

    if !input_codec.is_empty() && can_copy_audio(&fmt.audio_codecs, input_codec) {
        return builder.audio_codec("copy");
    }

    if let Some(rec) = fmt.get_recommended_audio_codec() {
        let actual_codec = if codec_registry::is_initialized()
            && !codec_registry::is_encoder_available(&rec)
        {
            tracing::warn!(
                encoder = %rec,
                "Audio encoder not available, trying alternatives"
            );
            codec_registry::get_audio_fallback(&rec)
                .map(|s| s.to_string())
                .unwrap_or(rec.clone())
        } else {
            rec.clone()
        };

        let mut b = builder.audio_codec(&actual_codec);
        if !actual_codec.starts_with("pcm") && actual_codec != "copy" {
            let bitrate = match actual_codec.as_str() {
                "libopus" => 128,
                "ac3" => 448,
                _ => 192,
            };
            b = b.audio_bitrate(bitrate);
        }
        return b;
    }

    builder
}

fn can_copy_audio(supported: &[String], input_codec: &str) -> bool {
    supported
        .iter()
        .any(|s| input_codec.contains(s) || s.contains(input_codec))
}

fn apply_container_settings(builder: FfmpegBuilder, fmt: &VideoFormat) -> FfmpegBuilder {
    builder.format(&fmt.container).args_vec(&fmt.special_params)
}