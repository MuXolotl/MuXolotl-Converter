use super::builder::FfmpegBuilder;
use super::spawn_ffmpeg;
use crate::codec_registry;
use crate::formats::audio::{self, AudioFormat};
use crate::media;
use crate::types::ConversionSettings;
use crate::utils;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::process::Child;
use tokio::sync::Mutex;

pub async fn convert(
    window: tauri::WebviewWindow,
    input: &str,
    output: &str,
    format: &str,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    // Pre-flight validation: ensure input file still exists
    utils::validate_input_path(input)?;

    let task_id = settings.task_id();
    let fmt = audio::get_format(format).context(format!("Unknown audio format: {}", format))?;
    let media = media::detect_media_type(window.app_handle(), input).await?;

    // Resolve actual codec (check availability)
    let codec = resolve_audio_codec(&fmt)?;

    let mut builder = FfmpegBuilder::new(input, output)
        .hide_banner()
        .overwrite()
        .input_file()
        .progress_pipe()
        .disable_video()
        .metadata(&settings.metadata)
        .audio_codec(&codec);

    if codec != "copy" {
        builder = apply_audio_settings(builder, &fmt, &settings);
        builder = apply_container_and_params(builder, &fmt);
    } else {
        builder = apply_container_and_params(builder, &fmt);
    }

    let (args, output_path) = builder.build();

    spawn_ffmpeg(
        window,
        task_id,
        media.duration,
        args,
        output_path,
        processes,
    )
    .await
}

pub async fn extract_from_video(
    window: tauri::WebviewWindow,
    input: &str,
    output: &str,
    format: &str,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    // Pre-flight validation: ensure input file still exists
    utils::validate_input_path(input)?;

    let task_id = settings.task_id();
    let fmt = audio::get_format(format).context(format!("Unknown audio format: {}", format))?;
    let media = media::detect_media_type(window.app_handle(), input).await?;

    if media.audio_streams.is_empty() {
        anyhow::bail!("No audio streams found in input file");
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
        let codec = resolve_audio_codec(&fmt)?;
        builder = builder.audio_codec(&codec);
        if codec != "copy" {
            builder = apply_audio_settings(builder, &fmt, &settings);
        }
    }

    builder = apply_container_and_params(builder, &fmt);

    let (args, output_path) = builder.build();

    spawn_ffmpeg(
        window,
        task_id,
        media.duration,
        args,
        output_path,
        processes,
    )
    .await
}

/// Check if the target codec is available; try fallback if not.
fn resolve_audio_codec(fmt: &AudioFormat) -> Result<String> {
    let codec = &fmt.codec;

    // "copy" is always available
    if codec == "copy" {
        return Ok(codec.clone());
    }

    // If registry not initialized, trust the format definition
    if !codec_registry::is_initialized() {
        return Ok(codec.clone());
    }

    // Check primary codec
    if codec_registry::is_encoder_available(codec) {
        return Ok(codec.clone());
    }

    // Try fallback
    if let Some(fallback) = codec_registry::get_audio_fallback(codec) {
        tracing::warn!(
            codec = %codec,
            fallback = %fallback,
            "Audio encoder not available, using fallback"
        );
        return Ok(fallback.to_string());
    }

    // No fallback available
    anyhow::bail!(
        "Audio encoder '{}' is not available in this FFmpeg build. \
         Format '{}' cannot be used.",
        codec,
        fmt.extension
    )
}

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
                "medium" => "5",
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
                "medium" => "5",
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
