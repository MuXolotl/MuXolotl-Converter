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
    
    let use_gpu = gpu_info.available && !matches!(format, "dv" | "vob");

    let mut args = Vec::new();
    let mut filter_chain = Vec::new();

    if use_gpu {
        match gpu_info.vendor {
            GpuVendor::Nvidia => {
                args.extend_from_slice(&[
                    "-hwaccel".to_string(), "cuda".to_string(),
                    "-hwaccel_output_format".to_string(), "cuda".to_string(),
                ]);
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

    let video_codec = get_video_codec(&format_info, &gpu_info, use_gpu, &settings);
    
    if !format_info.supports_video_codec(&video_codec) {
        anyhow::bail!(
            "Codec '{}' is not compatible with {} format. Supported codecs: {:?}",
            video_codec, format_info.extension, format_info.video_codecs
        );
    }
    
    args.extend_from_slice(&["-c:v".to_string(), video_codec.clone()]);
    add_codec_params(&mut args, &video_codec, &settings);

    let (target_width, target_height) = match format {
        "dv" => {
            let input_height = media_info.video_streams.get(0)
                .map(|s| s.height)
                .unwrap_or(576);
            
            if input_height <= 480 {
                (Some(720u64), Some(480u64))
            } else {
                (Some(720u64), Some(576u64))
            }
        }
        "vob" => {
            let input_height = media_info.video_streams.get(0)
                .map(|s| s.height)
                .unwrap_or(576);
            
            if input_height <= 480 {
                (Some(720u64), Some(480u64))
            } else {
                (Some(720u64), Some(576u64))
            }
        }
        "3gp" => {
            (Some(352u64), Some(288u64))
        }
        _ => {
            (
                settings.get("width").and_then(|w| w.as_u64()),
                settings.get("height").and_then(|h| h.as_u64())
            )
        }
    };

    if let (Some(width), Some(height)) = (target_width, target_height) {
        let even_width = if width % 2 == 0 { width } else { width - 1 };
        let even_height = if height % 2 == 0 { height } else { height - 1 };
        
        filter_chain.push(format!("scale={}:{}", even_width, even_height));
    }

    if matches!(format, "dv" | "vob") {
        let target_fps = if target_height == Some(480) { "30000/1001" } else { "25" };
        args.extend_from_slice(&["-r".to_string(), target_fps.to_string()]);
    } else if let Some(fps) = settings.get("fps").and_then(|f| f.as_u64()) {
        args.extend_from_slice(&["-r".to_string(), fps.to_string()]);
    }

    if needs_pixel_format_conversion(&video_codec) {
        filter_chain.push("format=yuv420p".to_string());
    }

    if !filter_chain.is_empty() {
        args.extend_from_slice(&["-vf".to_string(), filter_chain.join(",")]);
    }

    handle_audio_codec(&mut args, &format_info, &settings, &media_info);
    args.extend_from_slice(&["-f".to_string(), format_info.container.clone()]);
    args.extend(format_info.special_params.clone());
    add_compatibility_flags(&mut args, &format_info, &video_codec);
    
    args.extend_from_slice(&["-progress".to_string(), "pipe:1".to_string(), "-y".to_string(), output.to_string()]);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}

fn get_video_codec(
    format_info: &video::VideoFormat,
    gpu_info: &GpuInfo,
    use_gpu: bool,
    settings: &serde_json::Value,
) -> String {
    if let Some(codec) = settings.get("videoCodec").and_then(|c| c.as_str()) {
        return codec.to_string();
    }

    let gpu_vendor = match gpu_info.vendor {
        GpuVendor::Nvidia => "nvidia",
        GpuVendor::Intel => "intel",
        GpuVendor::Amd => "amd",
        GpuVendor::Apple => "apple",
        _ => "none",
    };

    format_info.get_recommended_video_codec(gpu_vendor, use_gpu)
        .unwrap_or_else(|| "libx264".to_string())
}

fn handle_audio_codec(
    args: &mut Vec<String>,
    format_info: &video::VideoFormat,
    settings: &serde_json::Value,
    media_info: &media::MediaInfo,
) {
    if let Some(audio_codec) = settings.get("audioCodec").and_then(|c| c.as_str()) {
        if format_info.supports_audio_codec(audio_codec) {
            args.extend_from_slice(&["-c:a".to_string(), audio_codec.to_string()]);
        } else {
            println!("⚠️ Audio codec '{}' not compatible with {}, using default", audio_codec, format_info.extension);
            if let Some(default_codec) = format_info.get_recommended_audio_codec() {
                args.extend_from_slice(&["-c:a".to_string(), default_codec]);
            }
        }
        return;
    }

    if media_info.audio_streams.is_empty() {
        args.extend_from_slice(&["-an".to_string()]);
        return;
    }

    if format_info.audio_codecs.is_empty() {
        args.extend_from_slice(&["-an".to_string()]);
        return;
    }

    let input_audio_codec = media_info.audio_streams.get(0)
        .map(|s| s.codec.as_str())
        .unwrap_or("");

    if format_info.supports_audio_codec(input_audio_codec) {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
    } else {
        if let Some(default_codec) = format_info.get_recommended_audio_codec() {
            args.extend_from_slice(&["-c:a".to_string(), default_codec.clone()]);
            
            if !default_codec.starts_with("pcm_") && default_codec != "copy" {
                let bitrate = match default_codec.as_str() {
                    "libopus" => "128k",
                    "libvorbis" => "192k",
                    "aac" => "192k",
                    "ac3" => "448k",
                    "mp2" => "192k",
                    _ => "192k",
                };
                args.extend_from_slice(&["-b:a".to_string(), bitrate.to_string()]);
            }
        }
    }
}

fn needs_pixel_format_conversion(codec: &str) -> bool {
    codec.contains("h264") || 
    codec.contains("h265") || 
    codec.contains("hevc") ||
    codec == "mpeg4" ||
    codec == "flv"
}

fn add_compatibility_flags(args: &mut Vec<String>, format_info: &video::VideoFormat, codec: &str) {
    match format_info.extension.as_str() {
        "mp4" | "m4v" | "mov" => {
            args.extend_from_slice(&[
                "-movflags".to_string(),
                "+faststart".to_string(),
            ]);
            
            if codec.contains("libx264") || codec.contains("h264") {
                args.extend_from_slice(&[
                    "-profile:v".to_string(),
                    "high".to_string(),
                    "-level".to_string(),
                    "4.0".to_string(),
                ]);
            }
        }
        "ts" => {
            args.extend_from_slice(&[
                "-mpegts_copyts".to_string(),
                "1".to_string(),
            ]);
        }
        _ => {}
    }
}

fn add_codec_params(args: &mut Vec<String>, codec: &str, settings: &serde_json::Value) {
    let quality = settings.get("quality").and_then(|q| q.as_str()).unwrap_or("medium");

    if codec.contains("nvenc") {
        let cq = match quality {
            "low" => "28",
            "medium" => "23",
            "high" => "19",
            "ultra" => "15",
            _ => "23",
        };
        args.extend_from_slice(&[
            "-preset".to_string(), "p7".to_string(),
            "-tune".to_string(), "hq".to_string(),
            "-rc".to_string(), "vbr".to_string(),
            "-cq".to_string(), cq.to_string(),
        ]);
    } else if codec.contains("qsv") {
        let global_quality = match quality {
            "low" => "28",
            "medium" => "23",
            "high" => "19",
            "ultra" => "15",
            _ => "23",
        };
        args.extend_from_slice(&[
            "-preset".to_string(), "veryslow".to_string(),
            "-global_quality".to_string(), global_quality.to_string(),
        ]);
    } else if codec.contains("amf") {
        let qp = match quality {
            "low" => "28",
            "medium" => "23",
            "high" => "19",
            "ultra" => "15",
            _ => "23",
        };
        args.extend_from_slice(&[
            "-quality".to_string(), "quality".to_string(),
            "-rc".to_string(), "cqp".to_string(),
            "-qp_i".to_string(), qp.to_string(),
            "-qp_p".to_string(), qp.to_string(),
        ]);
    } else if codec.contains("videotoolbox") {
        args.extend_from_slice(&[
            "-profile:v".to_string(), "high".to_string(),
            "-allow_sw".to_string(), "1".to_string(),
        ]);
    } else if codec.contains("libvpx") {
        let crf = match quality {
            "low" => "35",
            "medium" => "31",
            "high" => "24",
            "ultra" => "15",
            _ => "31",
        };
        
        let cpu_used = match quality {
            "low" => "5",
            "medium" => "2",
            "high" => "1",
            "ultra" => "0",
            _ => "2",
        };
        
        args.extend_from_slice(&[
            "-crf".to_string(), crf.to_string(),
            "-b:v".to_string(), "0".to_string(),
            "-cpu-used".to_string(), cpu_used.to_string(),
        ]);
        
        if codec == "libvpx-vp9" {
            args.extend_from_slice(&[
                "-row-mt".to_string(), "1".to_string(),
                "-tile-columns".to_string(), "2".to_string(),
            ]);
        }
    } else if codec == "libtheora" {
        let theora_quality = match quality {
            "low" => "3",
            "medium" => "5",
            "high" => "7",
            "ultra" => "10",
            _ => "5",
        };
        args.extend_from_slice(&[
            "-q:v".to_string(), theora_quality.to_string(),
        ]);
    } else if codec == "mpeg2video" {
        let bitrate = match quality {
            "low" => "4000k",
            "medium" => "6000k",
            "high" => "8000k",
            "ultra" => "12000k",
            _ => "6000k",
        };
        args.extend_from_slice(&[
            "-b:v".to_string(), bitrate.to_string(),
            "-maxrate".to_string(), bitrate.to_string(),
            "-bufsize".to_string(), "2M".to_string(),
        ]);
    } else if codec.contains("libx264") || codec.contains("libx265") {
        let preset = match quality {
            "low" => "veryfast",
            "medium" => "medium",
            "high" => "slow",
            "ultra" => "veryslow",
            _ => "medium",
        };
        let crf = match quality {
            "low" => "28",
            "medium" => "23",
            "high" => "19",
            "ultra" => "15",
            _ => "23",
        };
        args.extend_from_slice(&[
            "-preset".to_string(), preset.to_string(),
            "-crf".to_string(), crf.to_string(),
        ]);
    }
}