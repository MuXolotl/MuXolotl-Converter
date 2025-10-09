use anyhow::{Context, Result};
use std::sync::Arc;
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::Manager;
use crate::formats::audio;
use crate::media;
use crate::types::ConversionSettings;

fn normalize_path(path: &str) -> String {
    PathBuf::from(path)
        .to_str()
        .unwrap_or(path)
        .to_string()
}

fn add_quality_params(
    args: &mut Vec<String>,
    format_info: &audio::AudioFormat,
    quality: &str,
    settings: &ConversionSettings,
) {
    if format_info.lossy {
        match format_info.codec.as_str() {
            "libvorbis" => {
                args.extend(format_info.get_quality_args(quality));
            }
            "libopus" => {
                let bitrate = get_bitrate(format_info, quality, settings);
                args.extend_from_slice(&["-b:a".to_string(), format!("{}k", bitrate)]);
                args.extend(format_info.get_quality_args(quality));
            }
            _ => {
                let bitrate = get_bitrate(format_info, quality, settings);
                args.extend_from_slice(&["-b:a".to_string(), format!("{}k", bitrate)]);
            }
        }
    } else {
        args.extend(format_info.get_quality_args(quality));
    }
}

fn get_bitrate(format_info: &audio::AudioFormat, quality: &str, settings: &ConversionSettings) -> u32 {
    if let Some(br) = settings.get_bitrate() {
        if format_info.validate_bitrate(br).is_ok() {
            return br;
        }
        #[cfg(debug_assertions)]
        println!("⚠️ Invalid bitrate {}, using default", br);
    }
    
    format_info.get_bitrate_for_quality(quality).unwrap_or(192)
}

fn add_audio_params(
    args: &mut Vec<String>,
    format_info: &audio::AudioFormat,
    settings: &ConversionSettings,
) {
    let sample_rate = settings.get_sample_rate();

    let final_sample_rate = if format_info.supports_sample_rate(sample_rate) {
        sample_rate
    } else {
        #[cfg(debug_assertions)]
        println!(
            "⚠️ Sample rate {}Hz not supported by {}, using {}Hz",
            sample_rate, format_info.extension, format_info.recommended_sample_rate
        );
        format_info.recommended_sample_rate
    };

    args.extend_from_slice(&["-ar".to_string(), final_sample_rate.to_string()]);

    let channels = settings.get_channels();

    let final_channels = if format_info.supports_channels(channels) {
        channels
    } else {
        let fallback = format_info.channels_support
            .iter()
            .find(|&&ch| ch == 2)
            .or_else(|| format_info.channels_support.first())
            .copied()
            .unwrap_or(2);

        #[cfg(debug_assertions)]
        println!(
            "⚠️ {} channels not supported by {}, using {} channels",
            channels, format_info.extension, fallback
        );
        fallback
    };

    args.extend_from_slice(&["-ac".to_string(), final_channels.to_string()]);
}

fn build_base_args(
    input: &str,
    output: &str,
    format_info: &audio::AudioFormat,
    quality: &str,
    settings: &ConversionSettings,
) -> Vec<String> {
    let normalized_input = normalize_path(input);
    let normalized_output = normalize_path(output);

    let mut args = vec![
        "-i".to_string(),
        normalized_input,
        "-vn".to_string(),
        "-c:a".to_string(),
        format_info.get_ffmpeg_codec(),
    ];

    if let Some(container) = format_info.get_container_format() {
        args.extend_from_slice(&["-f".to_string(), container]);
    }

    add_quality_params(&mut args, format_info, quality, settings);
    add_audio_params(&mut args, format_info, settings);

    if !matches!(format_info.codec.as_str(), "libvorbis" | "libopus" | "flac" | "wavpack") {
        args.extend(format_info.special_params.clone());
    }

    args.extend_from_slice(&[
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-y".to_string(),
        normalized_output,
    ]);

    args
}

pub async fn convert(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.task_id();

    #[cfg(debug_assertions)]
    println!("🎵 Converting audio: {} -> {} (task: {})", input, output, task_id);

    let format_info = audio::get_format(format)
        .context(format!("Unknown audio format: {}", format))?;

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;

    let quality = settings.quality_str();
    let args = build_base_args(input, output, &format_info, quality, &settings);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}

pub async fn extract_from_video(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: ConversionSettings,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.task_id();

    #[cfg(debug_assertions)]
    println!("🎵 Extracting audio from video: {} -> {} (task: {})", input, output, task_id);

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;

    if media_info.audio_streams.is_empty() {
        anyhow::bail!("No audio streams found in video file");
    }

    let format_info = audio::get_format(format)
        .context(format!("Unknown audio format: {}", format))?;

    if !format_info.is_suitable_for_extraction() {
        #[cfg(debug_assertions)]
        println!("⚠️ Format '{}' may not be ideal for audio extraction", format_info.extension);
    }

    let normalized_input = normalize_path(input);
    let normalized_output = normalize_path(output);

    let mut args = vec!["-i".to_string(), normalized_input, "-vn".to_string()];

    let copy_audio = settings.copy_audio;
    let source_codec = &media_info.audio_streams[0].codec;

    if copy_audio && format_info.can_copy_codec(source_codec) {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
        #[cfg(debug_assertions)]
        println!("✅ Copying audio stream ({})", source_codec);
    } else {
        if copy_audio {
            #[cfg(debug_assertions)]
            println!("⚠️ Cannot copy '{}' to '{}', transcoding required", source_codec, format_info.extension);
        }

        args.extend_from_slice(&["-c:a".to_string(), format_info.get_ffmpeg_codec()]);

        if let Some(container) = format_info.get_container_format() {
            args.extend_from_slice(&["-f".to_string(), container]);
        }

        let quality = settings.quality_str();
        add_quality_params(&mut args, &format_info, quality, &settings);
        add_audio_params(&mut args, &format_info, &settings);

        if !matches!(format_info.codec.as_str(), "libvorbis" | "libopus" | "flac" | "wavpack") {
            args.extend(format_info.special_params.clone());
        }
    }

    args.extend_from_slice(&[
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-y".to_string(),
        normalized_output,
    ]);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}