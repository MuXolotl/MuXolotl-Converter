use super::{Category, Stability};
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub extension: String,
    pub name: String,
    pub category: Category,
    pub video_codecs: Vec<String>,
    pub audio_codecs: Vec<String>,
    pub container: String,
    pub stability: Stability,
    pub description: String,
    pub typical_use: String,
    pub max_resolution: Option<(u32, u32)>,
    pub special_params: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum FormatCompatibility {
    Fast,
    Safe,
    Setup,
    Experimental,
    Problematic,
}

impl VideoFormat {
    pub fn supports_video_codec(&self, codec: &str) -> bool {
        self.video_codecs.iter().any(|c| {
            if c == codec { return true; }
            
            match c.as_str() {
                "h264" => {
                    codec == "libx264" || 
                    codec.starts_with("h264_") ||
                    codec == "h264"
                }
                "hevc" => {
                    codec == "libx265" ||
                    codec.starts_with("hevc_") ||
                    codec == "hevc"
                }
                "vp8" => {
                    codec == "libvpx" ||
                    codec.contains("vp8")
                }
                "vp9" => {
                    codec == "libvpx-vp9" ||
                    codec.contains("vp9")
                }
                "av1" => {
                    codec == "libaom-av1" ||
                    codec == "libsvtav1" ||
                    codec.contains("av1")
                }
                "theora" => {
                    codec == "libtheora" ||
                    codec == "theora"
                }
                "mpeg4" => {
                    codec == "mpeg4" ||
                    codec == "libxvid"
                }
                _ => codec.contains(c)
            }
        })
    }

    pub fn supports_audio_codec(&self, codec: &str) -> bool {
        self.audio_codecs.is_empty() ||
        self.audio_codecs.iter().any(|c| {
            c == codec ||
            codec.contains(c) ||
            (c == "aac" && codec.starts_with("aac")) ||
            (c == "opus" && codec.contains("opus")) ||
            (c == "vorbis" && codec.contains("vorbis"))
        })
    }

    pub fn get_default_video_codec(&self) -> Option<&str> {
        self.video_codecs.first().map(|s| s.as_str())
    }

    pub fn get_default_audio_codec(&self) -> Option<&str> {
        self.audio_codecs.first().map(|s| s.as_str())
    }

    pub fn get_recommended_video_codec(&self, gpu_vendor: &str, use_gpu: bool) -> Option<String> {
        if !use_gpu {
            return self.get_software_video_codec();
        }

        for codec in &self.video_codecs {
            match (codec.as_str(), gpu_vendor) {
                ("h264", "nvidia") => return Some("h264_nvenc".to_string()),
                ("h264", "intel") => return Some("h264_qsv".to_string()),
                ("h264", "amd") => return Some("h264_amf".to_string()),
                ("h264", "apple") => return Some("h264_videotoolbox".to_string()),
                ("hevc", "nvidia") => return Some("hevc_nvenc".to_string()),
                ("hevc", "intel") => return Some("hevc_qsv".to_string()),
                ("hevc", "amd") => return Some("hevc_amf".to_string()),
                ("hevc", "apple") => return Some("hevc_videotoolbox".to_string()),
                ("vp9", "nvidia") => return Some("vp9_nvenc".to_string()),
                ("vp9", "intel") => return Some("vp9_qsv".to_string()),
                _ => {}
            }
        }

        self.get_software_video_codec()
    }

    fn get_software_video_codec(&self) -> Option<String> {
        for codec in &self.video_codecs {
            match codec.as_str() {
                "h264" => return Some("libx264".to_string()),
                "hevc" => return Some("libx265".to_string()),
                "vp9" => return Some("libvpx-vp9".to_string()),
                "vp8" => return Some("libvpx".to_string()),
                "av1" => return Some("libaom-av1".to_string()),
                "theora" => return Some("libtheora".to_string()),
                "mpeg2video" => return Some("mpeg2video".to_string()),
                "mpeg4" => return Some("mpeg4".to_string()),
                "h263" => return Some("h263".to_string()),
                other => return Some(other.to_string()),
            }
        }
        None
    }

    pub fn get_recommended_audio_codec(&self) -> Option<String> {
        self.audio_codecs.first().map(|codec| {
            match codec.as_str() {
                "aac" => "aac".to_string(),
                "opus" => "libopus".to_string(),
                "vorbis" => "libvorbis".to_string(),
                "mp3" => "libmp3lame".to_string(),
                "ac3" => "ac3".to_string(),
                "pcm_s16le" => "pcm_s16le".to_string(),
                other => other.to_string(),
            }
        })
    }

    pub fn has_strict_resolution(&self) -> bool {
        matches!(self.extension.as_str(), "dv" | "vob" | "3gp")
    }

    pub fn is_resolution_compatible(&self, input_width: u32, input_height: u32) -> bool {
        if let Some((max_w, max_h)) = self.max_resolution {
            match self.extension.as_str() {
                "dv" => {
                    (input_width == 720 && input_height == 576) ||
                    (input_width == 720 && input_height == 480)
                }
                "vob" => {
                    (input_width == 720 && input_height == 576) ||
                    (input_width == 720 && input_height == 480)
                }
                "3gp" => {
                    input_width <= max_w && input_height <= max_h
                }
                _ => {
                    input_width <= max_w && input_height <= max_h
                }
            }
        } else {
            true
        }
    }

    pub fn get_compatibility_level(
        &self,
        video_codec: &str,
        audio_codec: &str,
        input_width: Option<u32>,
        input_height: Option<u32>,
    ) -> FormatCompatibility {
        let video_ok = self.supports_video_codec(video_codec);
        let audio_ok = if audio_codec.is_empty() {
            true
        } else if self.audio_codecs.is_empty() {
            false
        } else {
            self.supports_audio_codec(audio_codec)
        };

        let can_copy = video_ok && audio_ok;

        let resolution_ok = if let (Some(w), Some(h)) = (input_width, input_height) {
            self.is_resolution_compatible(w, h)
        } else {
            true
        };

        match self.stability {
            Stability::Stable => {
                if can_copy && resolution_ok {
                    FormatCompatibility::Fast
                } else if resolution_ok {
                    FormatCompatibility::Safe
                } else if self.has_strict_resolution() {
                    FormatCompatibility::Setup
                } else {
                    FormatCompatibility::Safe
                }
            }
            Stability::RequiresSetup => FormatCompatibility::Setup,
            Stability::Experimental => FormatCompatibility::Experimental,
            Stability::Problematic => FormatCompatibility::Problematic,
        }
    }
}

#[derive(Debug, Deserialize)]
struct TomlVideoFormat {
    extension: String,
    name: String,
    category: Category,
    video_codecs: Vec<String>,
    audio_codecs: Vec<String>,
    container: String,
    stability: Stability,
    description: String,
    typical_use: String,
    max_resolution: Vec<u32>,
    special_params: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct VideoFormatsToml {
    format: Vec<TomlVideoFormat>,
}

impl From<TomlVideoFormat> for VideoFormat {
    fn from(toml: TomlVideoFormat) -> Self {
        VideoFormat {
            extension: toml.extension,
            name: toml.name,
            category: toml.category,
            video_codecs: toml.video_codecs,
            audio_codecs: toml.audio_codecs,
            container: toml.container,
            stability: toml.stability,
            description: toml.description,
            typical_use: toml.typical_use,
            max_resolution: if toml.max_resolution.len() == 2 {
                Some((toml.max_resolution[0], toml.max_resolution[1]))
            } else {
                None
            },
            special_params: toml.special_params,
        }
    }
}

lazy_static! {
    static ref VIDEO_FORMATS: HashMap<String, VideoFormat> = {
        let toml_str = include_str!("../formats/video_formats.toml");
        let parsed: VideoFormatsToml = toml::from_str(toml_str)
            .expect("Failed to parse video_formats.toml");
        
        parsed.format
            .into_iter()
            .map(|f| {
                let ext = f.extension.clone();
                (ext, f.into())
            })
            .collect()
    };
}

pub fn get_all_formats() -> Vec<VideoFormat> {
    let mut formats: Vec<VideoFormat> = VIDEO_FORMATS.values().cloned().collect();
    super::sort_by_category(&mut formats, |f| &f.category);
    formats
}

pub fn get_format(extension: &str) -> Option<VideoFormat> {
    VIDEO_FORMATS.get(extension).cloned()
}