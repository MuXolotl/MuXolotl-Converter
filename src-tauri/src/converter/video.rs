use super::builder::FfmpegBuilder;
use super::spawn_ffmpeg;
use crate::formats::video::{self, VideoFormat};
use crate::gpu::{GpuInfo, GpuVendor};
use crate::media::{self, MediaInfo};
use crate::types::{ConversionSettings, Quality};
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::process::Child;
use tokio::sync::Mutex;

// ===== Video Conversion =====

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

    let use_gpu = should_use_gpu(&gpu_info, &settings, &fmt);
    let video_codec = determine_video_codec(&fmt, &gpu_info, use_gpu, &settings);

    if !fmt.supports_video_codec(&video_codec) {
        anyhow::bail!("Codec '{}' not compatible with {}", video_codec, fmt.extension);
    }

    let mut builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite();

    builder = builder
        .input_file()
        .progress_pipe()
        .metadata(&settings.metadata)
        .video_codec(&video_codec)
        .apply_video_codec_preset(&video_codec, settings.quality);

    // --- Smart Bitrate for AMD AMF ---
    if video_codec.contains("amf") && settings.bitrate.is_none() {
        let width = settings.width.unwrap_or_else(|| media.primary_video().map(|v| v.width).unwrap_or(1920));
        let height = settings.height.unwrap_or_else(|| media.primary_video().map(|v| v.height).unwrap_or(1080));
        let fps = settings.fps.unwrap_or_else(|| media.primary_video().map(|v| v.fps.round() as u32).unwrap_or(30));
        
        let target_bitrate = calculate_auto_bitrate(width, height, fps, settings.quality);
        builder = builder.arg("-b:v", &format!("{}k", target_bitrate));
        builder = builder.arg("-maxrate", &format!("{}k", (target_bitrate as f64 * 1.5) as u32));
        builder = builder.arg("-bufsize", &format!("{}k", target_bitrate * 2));
    }

    // Resolution
    builder = apply_resolution(builder, &fmt, &media, &settings);

    // FPS
    if let Some(fps) = settings.fps {
        builder = builder.fps(fps);
    }

    // Pixel Format Logic
    if video_codec.contains("amf") {
        builder = builder.pixel_format("nv12"); // Hardware requirement for AMD
    } else if let Some(pix_fmt) = &fmt.default_pixel_format {
        builder = builder.pixel_format(pix_fmt); // Config driven requirement
    }

    // Audio & Container
    builder = apply_audio_settings(builder, &fmt, &media, &settings);
    builder = apply_container_settings(builder, &fmt, format, &video_codec);

    let (args, output_path) = builder.build();
    spawn_ffmpeg(window, task_id, media.duration, args, output_path, processes).await
}

// ===== Bitrate Calculator =====

fn calculate_auto_bitrate(width: u32, height: u32, fps: u32, quality: Quality) -> u32 {
    let pixels = width as f64 * height as f64;
    
    let bpp = match quality {
        Quality::Low => 0.05,
        Quality::Medium => 0.10,
        Quality::High => 0.18,
        Quality::Ultra => 0.30,
        Quality::Custom => 0.12,
    };

    let bitrate = (pixels * fps as f64 * bpp) / 1000.0;
    
    bitrate as u32
}

// ===== Helpers =====

fn should_use_gpu(gpu: &GpuInfo, settings: &ConversionSettings, fmt: &VideoFormat) -> bool {
    // Disable GPU for formats that require fixed resolution (DV/VOB) as they are legacy
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

    if fmt.requires_fixed_resolution {
        let source_height = media
            .primary_video()
            .map(|v| v.height)
            .unwrap_or(576);

        // NTSC (480) vs PAL (576) logic
        height = Some(if source_height <= 480 { 480 } else { 576 });
        width = Some(720);

        let fps = if height == Some(480) { "30000/1001" } else { "25" };
        return builder.resolution(width, height, true).arg("-r", fps);
    }

    builder.resolution(width, height, true)
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
        let mut b = builder.audio_codec(&rec);
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
    _format: &str,
    _video_codec: &str,
) -> FfmpegBuilder {
    let builder = builder.format(&fmt.container);
    builder.args_vec(&fmt.special_params)
}