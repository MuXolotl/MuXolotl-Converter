use crate::utils::create_hidden_command;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
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

impl MediaInfo {
    pub fn primary_video(&self) -> Option<&VideoStream> {
        self.video_streams.first()
    }

    pub fn primary_audio(&self) -> Option<&AudioStream> {
        self.audio_streams.first()
    }

    pub fn audio_codec(&self) -> Option<&str> {
        self.primary_audio().map(|a| a.codec.as_str())
    }
}

pub async fn detect_media_type(app_handle: &tauri::AppHandle, path: &str) -> Result<MediaInfo> {
    let ffprobe_path = crate::get_ffprobe_path(app_handle)
        .map_err(|e| anyhow::anyhow!("FFprobe not found: {}", e))?;

    let ffprobe_str = ffprobe_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid FFprobe path encoding"))?;

    let output = create_hidden_command(ffprobe_str)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .context("Failed to execute ffprobe")?;

    if !output.status.success() {
        anyhow::bail!("FFprobe failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    let json_str = String::from_utf8(output.stdout).context("Invalid UTF-8 in ffprobe output")?;
    let probe: serde_json::Value = serde_json::from_str(&json_str).context("Failed to parse ffprobe JSON")?;

    parse_probe_result(&probe, path)
}

fn parse_probe_result(probe: &serde_json::Value, path: &str) -> Result<MediaInfo> {
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
    Some(VideoStream {
        codec: stream.get("codec_name")?.as_str()?.to_string(),
        width: stream.get("width")?.as_u64()? as u32,
        height: stream.get("height")?.as_u64()? as u32,
        fps: parse_framerate(stream.get("r_frame_rate")?.as_str()?),
        bitrate: stream.get("bit_rate").and_then(|b| b.as_str()).and_then(|s| s.parse().ok()),
    })
}

fn parse_audio_stream(stream: &serde_json::Value) -> Option<AudioStream> {
    Some(AudioStream {
        codec: stream.get("codec_name")?.as_str()?.to_string(),
        sample_rate: stream.get("sample_rate")?.as_str()?.parse().ok()?,
        channels: stream.get("channels")?.as_u64()? as u32,
        bitrate: stream.get("bit_rate").and_then(|b| b.as_str()).and_then(|s| s.parse().ok()),
    })
}

fn parse_framerate(fps_str: &str) -> f64 {
    let parts: Vec<&str> = fps_str.split('/').collect();
    if parts.len() == 2 {
        let num: f64 = parts[0].parse().unwrap_or(0.0);
        let den: f64 = parts[1].parse().unwrap_or(1.0);
        if den != 0.0 {
            return num / den;
        }
    }
    0.0
}