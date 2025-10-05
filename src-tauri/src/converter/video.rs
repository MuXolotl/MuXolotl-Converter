use anyhow::{Context, Result};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::Manager;
use crate::formats::video;
use crate::media;
use crate::gpu::{GpuInfo, GpuVendor};

pub async fn convert(
    window: tauri::Window,
    input: &str,
    output: &str,
    format: &str,
    gpu_info: GpuInfo,
    settings: serde_json::Value,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let task_id = settings.get("taskId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    println!("🎬 Converting video: {} -> {} (task: {})", input, output, task_id);

    let format_info = video::get_format(format)
        .context(format!("Unknown video format: {}", format))?;

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;
    
    let use_gpu = settings.get("useGpu").and_then(|g| g.as_bool()).unwrap_or(true) && gpu_info.available;

    let mut args = Vec::new();

    if use_gpu {
        match gpu_info.vendor {
            GpuVendor::Nvidia => {
                args.extend_from_slice(&[
                    "-hwaccel".to_string(), "cuda".to_string(),
                    "-hwaccel_output_format".to_string(), "cuda".to_string(),
                ]);
                if let Some(decoder) = &gpu_info.decoder {
                    args.extend_from_slice(&["-c:v".to_string(), decoder.clone()]);
                }
            }
            GpuVendor::Intel => {
                args.extend_from_slice(&["-hwaccel".to_string(), "qsv".to_string()]);
            }
            GpuVendor::Amd => {
                args.extend_from_slice(&["-hwaccel".to_string(), "auto".to_string()]);
            }
            GpuVendor::Apple => {
                args.extend_from_slice(&["-hwaccel".to_string(), "videotoolbox".to_string()]);
            }
            _ => {}
        }
    }

    args.extend_from_slice(&["-i".to_string(), input.to_string()]);

    let video_codec = get_video_codec(&gpu_info, use_gpu, &settings);
    args.extend_from_slice(&["-c:v".to_string(), video_codec.clone()]);

    add_codec_params(&mut args, &video_codec, &settings);

    args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
    args.extend_from_slice(&["-f".to_string(), format_info.container.clone()]);

    args.extend(format_info.special_params.clone());
    args.extend_from_slice(&["-progress".to_string(), "pipe:1".to_string(), "-y".to_string(), output.to_string()]);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}

fn get_video_codec(gpu_info: &GpuInfo, use_gpu: bool, settings: &serde_json::Value) -> String {
    if let Some(codec) = settings.get("videoCodec").and_then(|c| c.as_str()) {
        return codec.to_string();
    }

    if use_gpu {
        match gpu_info.vendor {
            GpuVendor::Nvidia => gpu_info.encoder_h264.clone().unwrap_or_else(|| "libx264".to_string()),
            GpuVendor::Intel => "h264_qsv".to_string(),
            GpuVendor::Amd => "h264_amf".to_string(),
            GpuVendor::Apple => "h264_videotoolbox".to_string(),
            _ => "libx264".to_string(),
        }
    } else {
        "libx264".to_string()
    }
}

fn add_codec_params(args: &mut Vec<String>, codec: &str, settings: &serde_json::Value) {
    let quality = settings.get("quality").and_then(|q| q.as_str()).unwrap_or("medium");

    if codec.contains("nvenc") {
        args.extend_from_slice(&[
            "-preset".to_string(), "p7".to_string(),
            "-tune".to_string(), "hq".to_string(),
            "-rc".to_string(), "vbr".to_string(),
            "-cq".to_string(), "19".to_string(),
        ]);
    } else if codec.contains("qsv") {
        args.extend_from_slice(&[
            "-preset".to_string(), "veryslow".to_string(),
            "-global_quality".to_string(), "20".to_string(),
        ]);
    } else if codec.contains("amf") {
        args.extend_from_slice(&[
            "-quality".to_string(), "quality".to_string(),
            "-rc".to_string(), "vbr_peak".to_string(),
        ]);
    } else if codec.contains("videotoolbox") {
        args.extend_from_slice(&["-profile:v".to_string(), "high".to_string()]);
    } else {
        let preset = match quality {
            "low" => "veryfast",
            "medium" => "medium",
            "high" => "slow",
            "ultra" => "veryslow",
            _ => "medium",
        };
        args.extend_from_slice(&[
            "-preset".to_string(), preset.to_string(),
            "-crf".to_string(), "23".to_string(),
        ]);
    }
}