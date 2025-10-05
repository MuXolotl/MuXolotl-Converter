use anyhow::{Context, Result};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::Manager;
use crate::formats::audio;
use crate::media;

pub async fn convert(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    settings: serde_json::Value,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.get("taskId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    println!("🎵 Converting audio: {} -> {} (task: {})", input, output, task_id);

    let format_info = audio::get_format(format)
        .context(format!("Unknown audio format: {}", format))?;

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;

    let mut args = vec![
        "-i".to_string(),
        input.to_string(),
        "-vn".to_string(),
        "-c:a".to_string(),
        format_info.codec.clone(),
    ];

    if let Some(container) = &format_info.container {
        args.extend_from_slice(&["-f".to_string(), container.clone()]);
    }

    if format_info.lossy {
        let bitrate = if let Some(br) = settings.get("bitrate").and_then(|b| b.as_u64()) {
            br as u32
        } else {
            let quality = settings.get("quality").and_then(|q| q.as_str()).unwrap_or("medium");
            match quality {
                "low" => format_info.bitrate_range.map(|(min, _)| min).unwrap_or(128),
                "high" => format_info.recommended_bitrate.unwrap_or(256),
                "ultra" => format_info.bitrate_range.map(|(_, max)| max).unwrap_or(320),
                _ => format_info.recommended_bitrate.unwrap_or(192),
            }
        };
        args.extend_from_slice(&["-b:a".to_string(), format!("{}k", bitrate)]);
    }

    let sample_rate = settings.get("sampleRate")
        .and_then(|sr| sr.as_u64())
        .unwrap_or(format_info.recommended_sample_rate as u64);
    args.extend_from_slice(&["-ar".to_string(), sample_rate.to_string()]);

    let channels = settings.get("channels").and_then(|ch| ch.as_u64()).unwrap_or(2);
    args.extend_from_slice(&["-ac".to_string(), channels.to_string()]);

    args.extend(format_info.special_params.clone());
    args.extend_from_slice(&["-progress".to_string(), "pipe:1".to_string(), "-y".to_string(), output.to_string()]);

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
    let task_id = settings.get("taskId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    println!("🎵 Extracting audio from video: {} -> {} (task: {})", input, output, task_id);

    let app_handle = window.app_handle();
    let copy_audio = settings.get("copyAudio").and_then(|c| c.as_bool()).unwrap_or(false);
    let media_info = media::detect_media_type(&app_handle, input).await?;

    let mut args = vec!["-i".to_string(), input.to_string(), "-vn".to_string()];

    if copy_audio {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
    } else {
        let format_info = audio::get_format(format)
            .context(format!("Unknown audio format: {}", format))?;

        args.extend_from_slice(&["-c:a".to_string(), format_info.codec.clone()]);

        if let Some(container) = &format_info.container {
            args.extend_from_slice(&["-f".to_string(), container.clone()]);
        }

        if format_info.lossy {
            if let Some(bitrate) = format_info.recommended_bitrate {
                args.extend_from_slice(&["-b:a".to_string(), format!("{}k", bitrate)]);
            }
        }

        args.extend(format_info.special_params.clone());
    }

    args.extend_from_slice(&["-progress".to_string(), "pipe:1".to_string(), "-y".to_string(), output.to_string()]);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}