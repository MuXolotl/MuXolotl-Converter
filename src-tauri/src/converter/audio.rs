use anyhow::{Context, Result};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::Manager;
use crate::formats::audio;
use crate::media;

fn add_quality_params(
    args: &mut Vec<String>,
    format_info: &audio::AudioFormat,
    quality: &str,
    settings: &serde_json::Value,
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

fn get_bitrate(format_info: &audio::AudioFormat, quality: &str, settings: &serde_json::Value) -> u32 {
    settings
        .get("bitrate")
        .and_then(|b| b.as_u64())
        .map(|br| br as u32)
        .filter(|&br| format_info.validate_bitrate(br).is_ok())
        .or_else(|| {
            settings
                .get("bitrate")
                .and_then(|b| b.as_u64())
                .map(|br| {
                    println!("⚠️ Invalid bitrate {}, using default", br);
                    br
                });
            None
        })
        .unwrap_or_else(|| format_info.get_bitrate_for_quality(quality).unwrap_or(192))
}

fn add_audio_params(
    args: &mut Vec<String>,
    format_info: &audio::AudioFormat,
    settings: &serde_json::Value,
) {
    let sample_rate = settings
        .get("sampleRate")
        .and_then(|sr| sr.as_u64())
        .map(|sr| sr as u32)
        .unwrap_or(format_info.recommended_sample_rate);

    let final_sample_rate = if format_info.supports_sample_rate(sample_rate) {
        sample_rate
    } else {
        println!(
            "⚠️ Sample rate {}Hz not supported by {}, using {}Hz",
            sample_rate, format_info.extension, format_info.recommended_sample_rate
        );
        format_info.recommended_sample_rate
    };

    args.extend_from_slice(&["-ar".to_string(), final_sample_rate.to_string()]);

    let channels = settings
        .get("channels")
        .and_then(|ch| ch.as_u64())
        .map(|ch| ch as u32)
        .unwrap_or(2);

    let final_channels = if format_info.supports_channels(channels) {
        channels
    } else {
        let fallback = format_info.channels_support
            .iter()
            .find(|&&ch| ch == 2)
            .or_else(|| format_info.channels_support.first())
            .copied()
            .unwrap_or(2);

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
    settings: &serde_json::Value,
) -> Vec<String> {
    let mut args = vec![
        "-i".to_string(),
        input.to_string(),
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
        output.to_string(),
    ]);

    args
}

pub async fn convert(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: serde_json::Value,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings
        .get("taskId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    println!("🎵 Converting audio: {} -> {} (task: {})", input, output, task_id);

    let format_info = audio::get_format(format)
        .context(format!("Unknown audio format: {}", format))?;

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;

    let quality = settings.get("quality").and_then(|q| q.as_str()).unwrap_or("medium");
    let args = build_base_args(input, output, &format_info, quality, &settings);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}

pub async fn extract_from_video(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: serde_json::Value,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings
        .get("taskId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    println!("🎵 Extracting audio from video: {} -> {} (task: {})", input, output, task_id);

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;

    if media_info.audio_streams.is_empty() {
        anyhow::bail!("No audio streams found in video file");
    }

    let format_info = audio::get_format(format)
        .context(format!("Unknown audio format: {}", format))?;

    if !format_info.is_suitable_for_extraction() {
        println!("⚠️ Format '{}' may not be ideal for audio extraction", format_info.extension);
    }

    let mut args = vec!["-i".to_string(), input.to_string(), "-vn".to_string()];

    let copy_audio = settings.get("copyAudio").and_then(|c| c.as_bool()).unwrap_or(false);
    let source_codec = &media_info.audio_streams[0].codec;

    if copy_audio && format_info.can_copy_codec(source_codec) {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
        println!("✅ Copying audio stream ({})", source_codec);
    } else {
        if copy_audio {
            println!("⚠️ Cannot copy '{}' to '{}', transcoding required", source_codec, format_info.extension);
        }

        args.extend_from_slice(&["-c:a".to_string(), format_info.get_ffmpeg_codec()]);

        if let Some(container) = format_info.get_container_format() {
            args.extend_from_slice(&["-f".to_string(), container]);
        }

        let quality = settings.get("quality").and_then(|q| q.as_str()).unwrap_or("medium");
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
        output.to_string(),
    ]);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}