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