use anyhow::{Context, Result};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::Manager;
use crate::formats::video;
use crate::media;
use crate::gpu::{GpuInfo, GpuVendor};
use crate::types::ConversionSettings;
use super::common::*;

fn add_gpu_params(args: &mut Vec<String>, vendor: &GpuVendor) {
    match vendor {
        GpuVendor::Nvidia => {
            args.extend_from_slice(&[
                "-hwaccel".to_string(), "cuda".to_string(),
                "-hwaccel_output_format".to_string(), "cuda".to_string(),
            ]);
        }
        GpuVendor::Intel => {
            args.extend_from_slice(&[
                "-hwaccel".to_string(), "qsv".to_string(),
                "-hwaccel_output_format".to_string(), "qsv".to_string(),
            ]);
        }
        GpuVendor::Amd => {
            #[cfg(target_os = "windows")]
            {
                args.extend_from_slice(&["-hwaccel".to_string(), "d3d11va".to_string()]);
            }
            #[cfg(not(target_os = "windows"))]
            {
                args.extend_from_slice(&["-hwaccel".to_string(), "auto".to_string()]);
            }
        }
        GpuVendor::Apple => {
            args.extend_from_slice(&["-hwaccel".to_string(), "videotoolbox".to_string()]);
        }
        _ => {}
    }
}

fn get_video_codec(
    format_info: &video::VideoFormat,
    gpu_info: &GpuInfo,
    use_gpu: bool,
    settings: &ConversionSettings,
) -> String {
    settings.video_codec.clone().unwrap_or_else(|| {
        let vendor = match gpu_info.vendor {
            GpuVendor::Nvidia => "nvidia",
            GpuVendor::Intel => "intel",
            GpuVendor::Amd => "amd",
            GpuVendor::Apple => "apple",
            _ => "none",
        };
        format_info
            .get_recommended_video_codec(vendor, use_gpu)
            .unwrap_or_else(|| "libx264".to_string())
    })
}

fn add_codec_params(args: &mut Vec<String>, codec: &str, quality: &str) {
    match codec {
        c if c.contains("nvenc") => {
            let cq = match quality {
                "low" => "28",
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
        }
        c if c.contains("qsv") => {
            let gq = match quality {
                "low" => "28",
                "high" => "19",
                "ultra" => "15",
                _ => "23",
            };
            args.extend_from_slice(&[
                "-preset".to_string(), "veryslow".to_string(),
                "-global_quality".to_string(), gq.to_string(),
            ]);
        }
        c if c.contains("amf") => {
            let qp = match quality {
                "low" => "28",
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
        }
        c if c.contains("videotoolbox") => {
            args.extend_from_slice(&[
                "-profile:v".to_string(), "high".to_string(),
                "-allow_sw".to_string(), "1".to_string(),
            ]);
        }
        c if c.contains("libvpx") => {
            let crf = match quality {
                "low" => "35",
                "high" => "24",
                "ultra" => "15",
                _ => "31",
            };
            let cpu = match quality {
                "low" => "5",
                "high" => "1",
                "ultra" => "0",
                _ => "2",
            };
            args.extend_from_slice(&[
                "-crf".to_string(), crf.to_string(),
                "-b:v".to_string(), "0".to_string(),
                "-cpu-used".to_string(), cpu.to_string(),
            ]);
            if c == "libvpx-vp9" {
                args.extend_from_slice(&[
                    "-row-mt".to_string(), "1".to_string(),
                    "-tile-columns".to_string(), "2".to_string(),
                ]);
            }
        }
        "libtheora" => {
            let tq = match quality {
                "low" => "3",
                "high" => "7",
                "ultra" => "10",
                _ => "5",
            };
            args.extend_from_slice(&["-q:v".to_string(), tq.to_string()]);
        }
        "mpeg2video" => {
            let br = match quality {
                "low" => "4000k",
                "high" => "8000k",
                "ultra" => "12000k",
                _ => "6000k",
            };
            args.extend_from_slice(&[
                "-b:v".to_string(), br.to_string(),
                "-maxrate".to_string(), br.to_string(),
                "-bufsize".to_string(), "2M".to_string(),
            ]);
        }
        c if c.contains("libx264") || c.contains("libx265") => {
            let preset = match quality {
                "low" => "veryfast",
                "high" => "slow",
                "ultra" => "veryslow",
                _ => "medium",
            };
            let crf = match quality {
                "low" => "28",
                "high" => "19",
                "ultra" => "15",
                _ => "23",
            };
            args.extend_from_slice(&[
                "-preset".to_string(), preset.to_string(),
                "-crf".to_string(), crf.to_string(),
            ]);
        }
        _ => {}
    }
}

fn add_resolution_params(
    args: &mut Vec<String>,
    filter: &mut Vec<String>,
    format: &str,
    settings: &ConversionSettings,
    media_info: &media::MediaInfo,
) {
    let (width, height) = match format {
        "dv" | "vob" => {
            let h = media_info.video_streams.get(0).map(|s| s.height).unwrap_or(576);
            (Some(720u32), Some(if h <= 480 { 480 } else { 576 }))
        }
        "3gp" => (Some(352), Some(288)),
        _ => (settings.width, settings.height),
    };

    if let (Some(w), Some(h)) = (width, height) {
        let even_w = w & !1;
        let even_h = h & !1;
        filter.push(format!("scale={}:{}", even_w, even_h));
    }

    if matches!(format, "dv" | "vob") {
        let fps = if height == Some(480) { "30000/1001" } else { "25" };
        args.extend_from_slice(&["-r".to_string(), fps.to_string()]);
    } else if let Some(fps) = settings.fps {
        args.extend_from_slice(&["-r".to_string(), fps.to_string()]);
    }
}

fn can_copy_audio(input: &str, format: &video::VideoFormat) -> bool {
    if format.audio_codecs.is_empty() {
        return false;
    }

    let normalized = input.to_lowercase();
    format.audio_codecs.iter().any(|supported| {
        let s = supported.to_lowercase();
        normalized == s || normalized.contains(&s) || s.contains(&normalized) ||
        (supported == "aac" && normalized.starts_with("aac")) ||
        (supported == "mp3" && normalized.contains("mp3")) ||
        (supported == "opus" && normalized.contains("opus")) ||
        (supported == "vorbis" && normalized.contains("vorbis")) ||
        (supported == "ac3" && normalized.contains("ac3"))
    })
}

fn handle_audio(
    args: &mut Vec<String>,
    format: &video::VideoFormat,
    settings: &ConversionSettings,
    media: &media::MediaInfo,
) {
    if media.audio_streams.is_empty() || format.audio_codecs.is_empty() {
        args.extend_from_slice(&["-an".to_string()]);
        return;
    }

    if let Some(ref codec) = settings.audio_codec {
        if format.supports_audio_codec(codec) {
            args.extend_from_slice(&["-c:a".to_string(), codec.to_string()]);
            return;
        }
        #[cfg(debug_assertions)]
        println!("⚠️ Audio codec '{}' not compatible, using default", codec);
    }

    let input_codec = media.audio_streams.get(0).map(|s| s.codec.as_str()).unwrap_or("");

    if can_copy_audio(input_codec, format) {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
        #[cfg(debug_assertions)]
        println!("✅ Copying audio: {}", input_codec);
    } else if let Some(default) = format.get_recommended_audio_codec() {
        args.extend_from_slice(&["-c:a".to_string(), default.clone()]);
        
        if !default.starts_with("pcm_") && default != "copy" {
            let bitrate = match default.as_str() {
                "libopus" => "128k",
                "libvorbis" | "aac" | "mp2" => "192k",
                "ac3" => "448k",
                _ => "192k",
            };
            args.extend_from_slice(&["-b:a".to_string(), bitrate.to_string()]);
        }
        
        #[cfg(debug_assertions)]
        println!("🔄 Re-encoding audio: {} -> {}", input_codec, default);
    }
}

fn add_compat_flags(args: &mut Vec<String>, format: &str, codec: &str) {
    match format {
        "mp4" | "m4v" | "mov" => {
            if !args.contains(&"-movflags".to_string()) {
                args.extend_from_slice(&["-movflags".to_string(), "+faststart".to_string()]);
            }
            if codec.contains("libx264") || codec.contains("h264") {
                args.extend_from_slice(&[
                    "-profile:v".to_string(), "high".to_string(),
                    "-level".to_string(), "4.0".to_string(),
                ]);
            }
        }
        "ts" => {
            args.extend_from_slice(&["-mpegts_copyts".to_string(), "1".to_string()]);
        }
        _ => {}
    }
}

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

    #[cfg(debug_assertions)]
    println!("🎬 Converting video: {} -> {} (task: {})", input, output, task_id);

    let format_info = video::get_format(format)
        .context(format!("Unknown video format: {}", format))?;

    let app_handle = window.app_handle();
    let media_info = media::detect_media_type(&app_handle, input).await?;

    let use_gpu = gpu_info.available && !matches!(format, "dv" | "vob");
    let quality = settings.quality_str();

    let mut args = Vec::new();
    let mut filter = Vec::new();

    if use_gpu {
        add_gpu_params(&mut args, &gpu_info.vendor);
        
        #[cfg(debug_assertions)]
        println!("✅ GPU acceleration enabled: {:?} (decode + encode)", gpu_info.vendor);
    }

    args.extend_from_slice(&["-i".to_string(), normalize_path(input)]);

    let codec = get_video_codec(&format_info, &gpu_info, use_gpu, &settings);
    
    if !format_info.supports_video_codec(&codec) {
        anyhow::bail!(
            "Codec '{}' not compatible with {}. Supported: {:?}",
            codec, format_info.extension, format_info.video_codecs
        );
    }

    args.extend_from_slice(&["-c:v".to_string(), codec.clone()]);
    add_codec_params(&mut args, &codec, quality);
    add_resolution_params(&mut args, &mut filter, format, &settings, &media_info);

    if codec.contains("h264") || codec.contains("h265") || 
       codec.contains("hevc") || codec == "mpeg4" || codec == "flv" {
        filter.push("format=yuv420p".to_string());
    }

    if !filter.is_empty() {
        args.extend_from_slice(&["-vf".to_string(), filter.join(",")]);
    }

    handle_audio(&mut args, &format_info, &settings, &media_info);
    args.extend_from_slice(&["-f".to_string(), format_info.container.clone()]);
    args.extend(format_info.special_params.clone());
    add_compat_flags(&mut args, format, &codec);

    args.extend_from_slice(&[
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-y".to_string(),
        normalize_path(output),
    ]);

    super::spawn_ffmpeg(window, task_id, media_info.duration, args, processes).await
}