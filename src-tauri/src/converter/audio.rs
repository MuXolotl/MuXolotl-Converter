use super::builder::FfmpegBuilder;
use super::spawn_ffmpeg;
use crate::formats::audio::{self, AudioFormat};
use crate::media;
use crate::types::ConversionSettings;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::process::Child;
use tokio::sync::Mutex;

// ===== Audio Conversion =====

pub async fn convert(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.task_id();
    println!("🎵 [{}] Starting audio conversion", task_id);
    println!("🎵 [{}] Input: {}", task_id, input);
    println!("🎵 [{}] Output: {}", task_id, output);
    println!("🎵 [{}] Format: {}", task_id, format);

    let fmt = audio::get_format(format).context(format!("Unknown audio format: {}", format))?;
    let media = media::detect_media_type(&window.app_handle(), input).await?;

    println!("🎵 [{}] Duration: {}s", task_id, media.duration);

    let builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite()
        .input_file()
        .progress_pipe()
        .disable_video()
        .metadata(&settings.metadata)
        .audio_codec(&fmt.codec);

    let builder = apply_audio_settings(builder, &fmt, &settings);
    let builder = apply_container_and_params(builder, &fmt);

    let (args, output_path) = builder.build();
    
    println!("🎵 [{}] FFmpeg args ready", task_id);
    
    spawn_ffmpeg(window, task_id, media.duration, args, output_path, processes).await
}

// ===== Audio Extraction from Video =====

pub async fn extract_from_video(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.task_id();
    println!("🎵 [{}] Starting audio extraction", task_id);

    let fmt = audio::get_format(format).context(format!("Unknown audio format: {}", format))?;
    let media = media::detect_media_type(&window.app_handle(), input).await?;

    if media.audio_streams.is_empty() {
        anyhow::bail!("No audio streams found in video file");
    }

    let mut builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite()
        .input_file()
        .progress_pipe()
        .disable_video()
        .metadata(&settings.metadata);

    let source_codec = &media.audio_streams[0].codec;
    if settings.copy_audio && fmt.can_copy_codec(source_codec) {
        builder = builder.audio_codec("copy");
    } else {
        builder = builder.audio_codec(&fmt.codec);
        builder = apply_audio_settings(builder, &fmt, &settings);
        builder = apply_container_and_params(builder, &fmt);
    }

    let (args, output_path) = builder.build();
    spawn_ffmpeg(window, task_id, media.duration, args, output_path, processes).await
}

// ===== Helpers =====

fn apply_audio_settings(
    builder: FfmpegBuilder,
    fmt: &AudioFormat,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    let sample_rate = fmt.best_sample_rate(settings.sample_rate());
    let channels = fmt.best_channels(settings.channels());

    let mut builder = builder.sample_rate(sample_rate).channels(channels);

    if fmt.lossy {
        builder = apply_lossy_settings(builder, fmt, settings);
    } else {
        builder = apply_lossless_settings(builder, fmt, settings);
    }

    builder
}

fn apply_lossy_settings(
    builder: FfmpegBuilder,
    fmt: &AudioFormat,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    let quality = settings.quality.as_str();

    match fmt.codec.as_str() {
        "libvorbis" => {
            let q = match quality {
                "low" => "3",
                "high" => "7",
                "ultra" => "9",
                _ => "5",
            };
            builder.arg("-q:a", q)
        }
        "libopus" => {
            let bitrate = settings
                .bitrate
                .or_else(|| fmt.get_bitrate_for_quality(quality))
                .unwrap_or(128);
            builder.arg("-vbr", "on").audio_bitrate(bitrate)
        }
        _ => {
            let bitrate = settings
                .bitrate
                .or_else(|| fmt.get_bitrate_for_quality(quality))
                .unwrap_or(192);
            builder.audio_bitrate(bitrate)
        }
    }
}

fn apply_lossless_settings(
    builder: FfmpegBuilder,
    fmt: &AudioFormat,
    settings: &ConversionSettings,
) -> FfmpegBuilder {
    let quality = settings.quality.as_str();

    match fmt.codec.as_str() {
        "flac" | "wavpack" => {
            let level = match quality {
                "low" => "0",
                "high" => "8",
                "ultra" => "12",
                _ => "5",
            };
            builder.arg("-compression_level", level)
        }
        _ => builder,
    }
}

fn apply_container_and_params(builder: FfmpegBuilder, fmt: &AudioFormat) -> FfmpegBuilder {
    let mut builder = builder;

    if let Some(container) = &fmt.container {
        builder = builder.format(container);
    }

    builder.args_vec(&fmt.special_params)
}