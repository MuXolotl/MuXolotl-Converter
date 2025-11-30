use anyhow::{Context, Result};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::Manager;
use crate::formats::audio;
use crate::media;
use crate::types::ConversionSettings;
use super::builder::FfmpegCommand;
use super::common::*;

fn apply_audio_settings(
    mut cmd: FfmpegCommand, 
    fmt: &audio::AudioFormat, 
    settings: &ConversionSettings
) -> FfmpegCommand {
    let sr = get_sample_rate(settings.get_sample_rate(), &fmt.sample_rates, fmt.recommended_sample_rate);
    cmd = cmd.sample_rate(Some(sr));

    let ch = get_channels(settings.get_channels(), &fmt.channels_support);
    cmd = cmd.channels(Some(ch));

    let quality = settings.quality_str();
    if fmt.lossy {
        match fmt.codec.as_str() {
            "libvorbis" => {
                let q = match quality { "low"=>"3", "high"=>"7", "ultra"=>"9", _=>"5" };
                cmd = cmd.arg("-q:a", q);
            },
            "libopus" => {
                let br = settings.get_bitrate().unwrap_or(fmt.get_bitrate_for_quality(quality).unwrap_or(128));
                cmd = cmd.arg("-vbr", "on").audio_bitrate(Some(br));
            },
            "flac" | "wavpack" => {
                let lvl = match quality { "low"=>"0", "high"=>"8", "ultra"=>"12", _=>"5" };
                cmd = cmd.arg("-compression_level", lvl);
            },
            _ => {
                let br = settings.get_bitrate().unwrap_or(fmt.get_bitrate_for_quality(quality).unwrap_or(192));
                cmd = cmd.audio_bitrate(Some(br));
            }
        }
    }
    cmd
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
    let fmt_info = audio::get_format(format).context("Unknown audio format")?;
    let media_info = media::detect_media_type(&window.app_handle(), input).await?;

    let mut cmd = FfmpegCommand::new(input, output)
        .input_opts()
        .overwrite()
        .hide_banner()
        .disable_video()
        .audio_codec(&fmt_info.codec)
        .progress_pipe();

    cmd = cmd.apply_metadata(&settings.metadata);

    if let Some(container) = &fmt_info.container {
        cmd = cmd.format(container);
    }

    cmd = apply_audio_settings(cmd, &fmt_info, &settings);
    cmd = cmd.raw_args(&fmt_info.special_params);

    let (args, path) = cmd.build();
    super::spawn_ffmpeg(window, task_id, media_info.duration, args, path, processes).await
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
    let fmt_info = audio::get_format(format).context("Unknown audio format")?;
    let media_info = media::detect_media_type(&window.app_handle(), input).await?;

    if media_info.audio_streams.is_empty() {
        anyhow::bail!("No audio streams found in video file");
    }

    let mut cmd = FfmpegCommand::new(input, output)
        .input_opts()
        .overwrite()
        .hide_banner()
        .disable_video()
        .progress_pipe();

    cmd = cmd.apply_metadata(&settings.metadata);

    let src_codec = &media_info.audio_streams[0].codec;
    if settings.copy_audio && fmt_info.can_copy_codec(src_codec) {
        cmd = cmd.audio_codec("copy");
    } else {
        cmd = cmd.audio_codec(&fmt_info.codec);
        if let Some(c) = &fmt_info.container { cmd = cmd.format(c); }
        cmd = apply_audio_settings(cmd, &fmt_info, &settings);
        cmd = cmd.raw_args(&fmt_info.special_params);
    }

    let (args, path) = cmd.build();
    super::spawn_ffmpeg(window, task_id, media_info.duration, args, path, processes).await
}