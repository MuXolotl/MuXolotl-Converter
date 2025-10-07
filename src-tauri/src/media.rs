use serde::{Deserialize, Serialize};
use std::process::Command;
use anyhow::{Context, Result};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Audio,
    Video,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoStream {
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub bitrate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioStream {
    pub codec: String,
    pub sample_rate: u32,
    pub channels: u32,
    pub bitrate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    pub media_type: MediaType,
    pub duration: f64,
    pub file_size: u64,
    pub format_name: String,
    pub video_streams: Vec<VideoStream>,
    pub audio_streams: Vec<AudioStream>,
}

pub async fn detect_media_type(app_handle: &tauri::AppHandle, path: &str) -> Result<MediaInfo> {
    let ffprobe_path = crate::get_ffprobe_path(app_handle)
        .map_err(|e| anyhow::anyhow!("FFprobe not found: {}", e))?;

    let mut cmd = Command::new(&ffprobe_path);
    cmd.args(&[
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        path,
    ]);
    
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = cmd.output().context("Failed to execute ffprobe")?;

    if !output.status.success() {
        anyhow::bail!("FFprobe failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    let json_str = String::from_utf8(output.stdout).context("Invalid UTF-8 in ffprobe output")?;
    let probe_result: serde_json::Value = serde_json::from_str(&json_str)
        .context("Failed to parse ffprobe JSON")?;

    parse_media_info(&probe_result, path)
}

fn parse_media_info(probe: &serde_json::Value, path: &str) -> Result<MediaInfo> {
    let format = probe.get("format").context("No format information")?;

    let duration = format
        .get("duration")
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let format_name = format
        .get("format_name")
        .and_then(|f| f.as_str())
        .unwrap_or("unknown")
        .to_string();

    let streams = probe
        .get("streams")
        .and_then(|s| s.as_array())
        .context("No streams found")?;

    let mut video_streams = Vec::new();
    let mut audio_streams = Vec::new();

    for stream in streams {
        match stream.get("codec_type").and_then(|c| c.as_str()) {
            Some("video") => {
                if let Some(video) = parse_video_stream(stream) {
                    video_streams.push(video);
                }
            }
            Some("audio") => {
                if let Some(audio) = parse_audio_stream(stream) {
                    audio_streams.push(audio);
                }
            }
            _ => {}
        }
    }

    let media_type = if !video_streams.is_empty() {
        MediaType::Video
    } else if !audio_streams.is_empty() {
        MediaType::Audio
    } else {
        MediaType::Unknown
    };

    Ok(MediaInfo {
        media_type,
        duration,
        file_size,
        format_name,
        video_streams,
        audio_streams,
    })
}

fn parse_video_stream(stream: &serde_json::Value) -> Option<VideoStream> {
    let codec = stream.get("codec_name")?.as_str()?.to_string();
    let width = stream.get("width")?.as_u64()? as u32;
    let height = stream.get("height")?.as_u64()? as u32;

    let fps = stream
        .get("r_frame_rate")
        .and_then(|f| f.as_str())
        .and_then(|s| {
            let parts: Vec<&str> = s.split('/').collect();
            if parts.len() == 2 {
                let num = parts[0].parse::<f64>().ok()?;
                let den = parts[1].parse::<f64>().ok()?;
                Some(if den != 0.0 { num / den } else { 0.0 })
            } else {
                None
            }
        })
        .unwrap_or(0.0);

    let bitrate = stream
        .get("bit_rate")
        .and_then(|b| b.as_str())
        .and_then(|s| s.parse::<u64>().ok());

    Some(VideoStream {
        codec,
        width,
        height,
        fps,
        bitrate,
    })
}

fn parse_audio_stream(stream: &serde_json::Value) -> Option<AudioStream> {
    let codec = stream.get("codec_name")?.as_str()?.to_string();
    let sample_rate = stream.get("sample_rate")?.as_str()?.parse::<u32>().ok()?;
    let channels = stream.get("channels")?.as_u64()? as u32;
    let bitrate = stream
        .get("bit_rate")
        .and_then(|b| b.as_str())
        .and_then(|s| s.parse::<u64>().ok());

    Some(AudioStream {
        codec,
        sample_rate,
        channels,
        bitrate,
    })
}