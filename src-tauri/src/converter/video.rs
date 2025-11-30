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
use super::builder::FfmpegCommand;

// --- Helper: Codec Specific Params ---
fn apply_codec_params(cmd: FfmpegCommand, codec: &str, quality: &str) -> FfmpegCommand {
    match codec {
        c if c.contains("nvenc") => {
            let cq = match quality { "low" => "28", "high" => "19", "ultra" => "15", _ => "23" };
            cmd.arg("-preset", "p7").arg("-tune", "hq").arg("-rc", "vbr").arg("-cq", cq)
        },
        c if c.contains("qsv") => {
            let gq = match quality { "low" => "28", "high" => "19", "ultra" => "15", _ => "23" };
            cmd.arg("-preset", "veryslow").arg("-global_quality", gq)
        },
        c if c.contains("amf") => {
            let qp = match quality { "low" => "28", "high" => "19", "ultra" => "15", _ => "23" };
            cmd.arg("-quality", "quality").arg("-rc", "cqp").arg("-qp_i", qp).arg("-qp_p", qp)
        },
        c if c.contains("videotoolbox") => {
            cmd.arg("-profile:v", "high").arg("-allow_sw", "1")
        },
        c if c.contains("libx264") || c.contains("libx265") => {
            let preset = match quality { "low" => "veryfast", "high" => "slow", "ultra" => "veryslow", _ => "medium" };
            let crf = match quality { "low" => "28", "high" => "19", "ultra" => "15", _ => "23" };
            cmd.arg("-preset", preset).arg("-crf", crf)
        },
        c if c.contains("libvpx") => {
            let crf = match quality { "low" => "35", "high" => "24", "ultra" => "15", _ => "31" };
            let cpu = match quality { "low" => "5", "high" => "1", "ultra" => "0", _ => "2" };
            let mut c = cmd.arg("-crf", crf).arg("-b:v", "0").arg("-cpu-used", cpu);
            if codec == "libvpx-vp9" { c = c.arg("-row-mt", "1").arg("-tile-columns", "2"); }
            c
        },
        "mpeg2video" => {
            let br = match quality { "low" => "4000k", "high" => "8000k", "ultra" => "12000k", _ => "6000k" };
            cmd.arg("-b:v", br).arg("-maxrate", br).arg("-bufsize", "2M")
        },
        _ => cmd,
    }
}

// --- Helper: Determine Codec ---
fn determine_video_codec(format: &video::VideoFormat, gpu: &GpuInfo, use_gpu: bool, settings: &ConversionSettings) -> String {
    if let Some(manual) = &settings.video_codec { return manual.clone(); }
    let gpu_vendor_str = match gpu.vendor {
        GpuVendor::Nvidia => "nvidia",
        GpuVendor::Intel => "intel",
        GpuVendor::Amd => "amd",
        GpuVendor::Apple => "apple",
        _ => "none",
    };
    format.get_recommended_video_codec(gpu_vendor_str, use_gpu).unwrap_or_else(|| "libx264".to_string())
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
    let app_handle = window.app_handle();
    
    let format_info = video::get_format(format).context("Unknown video format")?;
    let media_info = media::detect_media_type(&app_handle, input).await?;

    let use_gpu = gpu_info.available && settings.use_gpu && !matches!(format, "dv" | "vob");
    let codec = determine_video_codec(&format_info, &gpu_info, use_gpu, &settings);

    if !format_info.supports_video_codec(&codec) {
        anyhow::bail!("Codec '{}' not compatible with {}", codec, format_info.extension);
    }

    let mut cmd = FfmpegCommand::new(input, output)
        .input_opts()
        .overwrite()
        .hide_banner()
        .progress_pipe();

    cmd = cmd.apply_metadata(&settings.metadata);

    if use_gpu { cmd = cmd.apply_hw_accel(&gpu_info); }
    cmd = cmd.video_codec(&codec);
    cmd = apply_codec_params(cmd, &codec, settings.quality_str());

    let (mut w, mut h) = (settings.width, settings.height);
    
    if matches!(format, "dv" | "vob") {
        h = Some(if media_info.video_streams.first().map(|s| s.height).unwrap_or(576) <= 480 { 480 } else { 576 });
        w = Some(720);
        cmd = cmd.arg("-r", if h == Some(480) { "30000/1001" } else { "25" });
    } else if let Some(fps) = settings.fps {
        cmd = cmd.fps(Some(fps));
    }

    if ["h264", "hevc", "mpeg4", "flv"].iter().any(|x| codec.contains(x)) {
        cmd = cmd.pixel_format("yuv420p");
    }

    cmd = cmd.resolution(w, h, true);

    if !media_info.audio_streams.is_empty() && !format_info.audio_codecs.is_empty() {
        let requested = settings.audio_codec.as_deref();
        let input_ac = media_info.audio_streams.first().map(|s| s.codec.as_str()).unwrap_or("");
        
        if let Some(req) = requested {
            if format_info.supports_audio_codec(req) { cmd = cmd.audio_codec(req); }
        } else if input_ac != "" && format_info.audio_codecs.iter().any(|s| input_ac.contains(s) || s.contains(input_ac)) {
            cmd = cmd.audio_codec("copy");
        } else if let Some(rec) = format_info.get_recommended_audio_codec() {
            cmd = cmd.audio_codec(&rec);
            if !rec.starts_with("pcm") && rec != "copy" {
                let br = match rec.as_str() { "libopus" => "128", "ac3" => "448", _ => "192" };
                cmd = cmd.audio_bitrate(br.parse().ok());
            }
        }
    } else {
        cmd = cmd.disable_audio();
    }

    if let Some(c) = &settings.video_codec { if c.contains("libx264") && ["mp4", "mov"].contains(&format) {
        cmd = cmd.arg("-profile:v", "high").arg("-level", "4.0");
    }}
    if ["mp4", "mov", "m4v"].contains(&format) { cmd = cmd.flag("-movflags").arg("+faststart", ""); }
    
    cmd = cmd.format(&format_info.container)
             .raw_args(&format_info.special_params);

    let (args, output_path) = cmd.build();
    super::spawn_ffmpeg(window, task_id, media_info.duration, args, output_path, processes).await
}