use super::builder::FfmpegBuilder;
use super::spawn_ffmpeg;
use crate::formats::video::{self, VideoFormat};
use crate::gpu::{GpuInfo, GpuVendor};
use crate::media::{self, MediaInfo};
use crate::types::ConversionSettings;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::process::Child;
use tokio::sync::Mutex;

// ============================================================================
// Video Conversion
// ============================================================================

pub async fn convert(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    gpu_info: GpuInfo,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.task_id();
    let fmt = video::get_format(format).context("Unknown video format")?;
    let media = media::detect_media_type(&window.app_handle(), input).await?;

    // Determine if GPU should be used
    let use_gpu = should_use_gpu(&gpu_info, &settings, format);

    // Determine video codec
    let video_codec = determine_video_codec(&fmt, &gpu_info, use_gpu, &settings);

    if !fmt.supports_video_codec(&video_codec) {
        anyhow::bail!("Codec '{}' not compatible with {}", video_codec, fmt.extension);
    }

    // Build command
    let mut builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite();

    // Add hwaccel before input if using GPU
    if use_gpu {
        builder = builder.hwaccel(&gpu_info);
    }

    builder = builder
        .input_file()
        .progress_pipe()
        .metadata(&settings.metadata)
        .video_codec(&video_codec)
        .apply_video_codec_preset(&video_codec, settings.quality);

    // Resolution handling
    builder = apply_resolution(builder, &fmt, &media, &settings);

    // FPS
    if let Some(fps) = settings.fps {
        builder = builder.fps(fps);
    }

    // Pixel format for compatibility
    if needs_yuv420p(&video_codec) {
        builder = builder.pixel_format("yuv420p");
    }

    // Audio handling
    builder = apply_audio_settings(builder, &fmt, &media, &settings);

    // Container-specific settings
    builder = apply_container_settings(builder, &fmt, format, &video_codec);

    let (args, output_path) = builder.build();
    spawn_ffmpeg(window, task_id, media.duration, args, output_path, processes).await
}

// ============================================================================
// Helpers
// ============================================================================

fn should_use_gpu(gpu: &GpuInfo, settings: &ConversionSettings, format: &str) -> bool {
    gpu.available && settings.use_gpu && !matches!(format, "dv" | "vob")
}

fn determine_video_codec(
    fmt: &VideoFormat,
    gpu: &GpuInfo,
    use_gpu: bool,
    settings: &ConversionSettings,
) -> String {
    // User-specified codec takes priority
    if let Some(codec) = &settings.video_codec {
        return codec.clone();
    }

    let vendor = match gpu.vendor {
        GpuVendor::Nvidia => "nvidia",
        GpuVendor::Intel => "intel",
        GpuVendor::Amd => "amd",
        GpuVendor::Apple => "apple",
        GpuVendor::None => "none",
    };

    fmt.get_recommended_video_codec(vendor, use_gpu)
        .unwrap_or_else(|| "libx264".to_string())
}

fn apply_resolution(
    builder: FfmpegBuilder,
    fmt: &VideoFormat,
    media: &MediaInfo,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    let (mut width, mut height) = (settings.width, settings.height);

    // Handle formats with strict resolution requirements
    if fmt.has_strict_resolution() {
        let source_height = media
            .primary_video()
            .map(|v| v.height)
            .unwrap_or(576);

        height = Some(if source_height <= 480 { 480 } else { 576 });
        width = Some(720);

        // DV/VOB also need specific framerates
        let fps = if height == Some(480) {
            "30000/1001"
        } else {
            "25"
        };
        return builder.resolution(width, height, true).arg("-r", fps);
    }

    builder.resolution(width, height, true)
}

fn needs_yuv420p(codec: &str) -> bool {
    ["h264", "hevc", "mpeg4", "flv"]
        .iter()
        .any(|c| codec.contains(c))
}

fn apply_audio_settings(
    builder: FfmpegBuilder,
    fmt: &VideoFormat,
    media: &MediaInfo,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    // No audio streams or format doesn't support audio
    if media.audio_streams.is_empty() || fmt.audio_codecs.is_empty() {
        return builder.disable_audio();
    }

    let input_codec = media.audio_codec().unwrap_or("");

    // User-specified audio codec
    if let Some(requested) = &settings.audio_codec {
        if fmt.supports_audio_codec(requested) {
            return builder.audio_codec(requested);
        }
    }

    // Try to copy if compatible
    if !input_codec.is_empty() && can_copy_audio(&fmt.audio_codecs, input_codec) {
        return builder.audio_codec("copy");
    }

    // Use recommended codec
    if let Some(rec) = fmt.get_recommended_audio_codec() {
        let mut b = builder.audio_codec(&rec);

        // Add bitrate for lossy codecs
        if !rec.starts_with("pcm") && rec != "copy" {
            let bitrate = match rec.as_str() {
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
    supported.iter().any(|s| {
        input_codec.contains(s) || s.contains(input_codec)
    })
}

fn apply_container_settings(
    builder: FfmpegBuilder,
    fmt: &VideoFormat,
    format: &str,
    _video_codec: &str,
) -> FfmpegBuilder {
    let mut builder = builder.format(&fmt.container);

    // MP4/MOV faststart for streaming
    if ["mp4", "mov", "m4v"].contains(&format) {
        builder = builder.flag("-movflags").arg("+faststart", "");
    }

    builder.args_vec(&fmt.special_params)
}