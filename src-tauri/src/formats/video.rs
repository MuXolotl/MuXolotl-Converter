use super::{sort_formats_by_category, Category, Stability};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FormatCompatibility {
    Fast,
    Safe,
    Setup,
    Experimental,
    Problematic,
}

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
    #[serde(default)]
    pub requires_fixed_resolution: bool,
    #[serde(default)]
    pub default_pixel_format: Option<String>,
    pub special_params: Vec<String>,
}

impl VideoFormat {
    pub fn supports_video_codec(&self, codec: &str) -> bool {
        self.video_codecs.iter().any(|c| codec_matches(c, codec))
    }

    #[inline]
    pub fn supports_audio_codec(&self, codec: &str) -> bool {
        self.audio_codecs.is_empty()
            || self.audio_codecs.iter().any(|c| {
                c == codec
                    || codec.contains(c)
                    || (c == "aac" && codec.starts_with("aac"))
                    || (c == "opus" && codec.contains("opus"))
                    || (c == "vorbis" && codec.contains("vorbis"))
            })
    }

    pub fn get_recommended_video_codec(&self, gpu_vendor: &str, use_gpu: bool) -> Option<String> {
        if use_gpu {
            for codec in &self.video_codecs {
                if let Some(gpu_codec) = get_gpu_codec(codec, gpu_vendor) {
                    return Some(gpu_codec);
                }
            }
        }
        self.get_software_codec()
    }

    fn get_software_codec(&self) -> Option<String> {
        self.video_codecs.first().map(|codec| {
            match codec.as_str() {
                "h264" => "libx264",
                "hevc" => "libx265",
                "vp9" => "libvpx-vp9",
                "vp8" => "libvpx",
                "av1" => "libaom-av1",
                "theora" => "libtheora",
                other => other,
            }
            .to_string()
        })
    }

    pub fn get_recommended_audio_codec(&self) -> Option<String> {
        self.audio_codecs.first().map(|codec| {
            match codec.as_str() {
                "aac" => "aac",
                "opus" => "libopus",
                "vorbis" => "libvorbis",
                "mp3" => "libmp3lame",
                "ac3" => "ac3",
                "pcm_s16le" => "pcm_s16le",
                other => other,
            }
            .to_string()
        })
    }

    pub fn is_resolution_compatible(&self, width: u32, height: u32) -> bool {
        if self.requires_fixed_resolution {
            return width == 720 && (height == 576 || height == 480);
        }
        match self.max_resolution {
            Some((max_w, max_h)) => width <= max_w && height <= max_h,
            None => true,
        }
    }

    pub fn get_compatibility_level(
        &self,
        video_codec: &str,
        audio_codec: &str,
        width: Option<u32>,
        height: Option<u32>,
    ) -> FormatCompatibility {
        match self.stability {
            Stability::Problematic => return FormatCompatibility::Problematic,
            Stability::Experimental => return FormatCompatibility::Experimental,
            Stability::RequiresSetup => return FormatCompatibility::Setup,
            Stability::Stable => {}
        }

        if let (Some(w), Some(h)) = (width, height) {
            if !self.is_resolution_compatible(w, h) && self.requires_fixed_resolution {
                return FormatCompatibility::Setup;
            }
        }

        let video_ok = self.supports_video_codec(video_codec);
        let audio_ok = audio_codec.is_empty()
            || self.audio_codecs.is_empty()
            || self.supports_audio_codec(audio_codec);

        if video_ok && audio_ok {
            FormatCompatibility::Fast
        } else {
            FormatCompatibility::Safe
        }
    }
}

fn codec_matches(container_codec: &str, actual_codec: &str) -> bool {
    if container_codec == actual_codec {
        return true;
    }

    match container_codec {
        "h264" => actual_codec == "libx264" || actual_codec.starts_with("h264_"),
        "hevc" => actual_codec == "libx265" || actual_codec.starts_with("hevc_"),
        "vp8" => actual_codec == "libvpx" || actual_codec.contains("vp8"),
        "vp9" => actual_codec == "libvpx-vp9" || actual_codec.contains("vp9"),
        "av1" => actual_codec.contains("av1"),
        "theora" => actual_codec == "libtheora" || actual_codec == "theora",
        "mpeg4" => actual_codec == "mpeg4" || actual_codec == "libxvid",
        "gif" => actual_codec == "gif",
        _ => actual_codec.contains(container_codec),
    }
}

fn get_gpu_codec(codec: &str, vendor: &str) -> Option<String> {
    let result = match (codec, vendor) {
        ("h264", "nvidia") => "h264_nvenc",
        ("h264", "intel") => "h264_qsv",
        ("h264", "amd") => "h264_amf",
        ("h264", "apple") => "h264_videotoolbox",
        ("hevc", "nvidia") => "hevc_nvenc",
        ("hevc", "intel") => "hevc_qsv",
        ("hevc", "amd") => "hevc_amf",
        ("hevc", "apple") => "hevc_videotoolbox",
        ("vp9", "nvidia") => "vp9_nvenc",
        ("vp9", "intel") => "vp9_qsv",
        _ => return None,
    };
    Some(result.to_string())
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
    #[serde(default)]
    requires_fixed_resolution: bool,
    #[serde(default)]
    default_pixel_format: Option<String>,
    special_params: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct VideoFormatsToml {
    format: Vec<TomlVideoFormat>,
}

impl From<TomlVideoFormat> for VideoFormat {
    fn from(t: TomlVideoFormat) -> Self {
        Self {
            extension: t.extension,
            name: t.name,
            category: t.category,
            video_codecs: t.video_codecs,
            audio_codecs: t.audio_codecs,
            container: t.container,
            stability: t.stability,
            description: t.description,
            typical_use: t.typical_use,
            max_resolution: if t.max_resolution.len() == 2 {
                Some((t.max_resolution[0], t.max_resolution[1]))
            } else {
                None
            },
            requires_fixed_resolution: t.requires_fixed_resolution,
            default_pixel_format: t.default_pixel_format,
            special_params: t.special_params,
        }
    }
}

lazy_static! {
    static ref VIDEO_FORMATS: HashMap<String, VideoFormat> = {
        let toml_str = include_str!("video_formats.toml");
        let parsed: VideoFormatsToml = toml::from_str(toml_str).expect("Failed to parse video_formats.toml");

        parsed.format.into_iter().map(|f| (f.extension.clone(), f.into())).collect()
    };
}

pub fn get_all_formats() -> Vec<VideoFormat> {
    let mut formats: Vec<VideoFormat> = VIDEO_FORMATS.values().cloned().collect();
    sort_formats_by_category(&mut formats, |f| &f.category);
    formats
}

#[inline]
pub fn get_format(extension: &str) -> Option<VideoFormat> {
    VIDEO_FORMATS.get(extension).cloned()
}