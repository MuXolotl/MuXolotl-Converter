use super::{Category, Stability};
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFormat {
    pub extension: String,
    pub name: String,
    pub category: Category,
    pub codec: String,
    #[serde(default)]
    pub container: Option<String>,
    pub stability: Stability,
    pub description: String,
    pub typical_use: String,
    pub lossy: bool,
    #[serde(default)]
    pub bitrate_range: Option<(u32, u32)>,
    #[serde(default)]
    pub recommended_bitrate: Option<u32>,
    pub sample_rates: Vec<u32>,
    pub recommended_sample_rate: u32,
    pub channels_support: Vec<u32>,
    pub special_params: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct TomlAudioFormat {
    extension: String,
    name: String,
    category: Category,
    codec: String,
    container: String,
    stability: Stability,
    description: String,
    typical_use: String,
    lossy: bool,
    bitrate_range: Vec<u32>,
    recommended_bitrate: u32,
    sample_rates: Vec<u32>,
    recommended_sample_rate: u32,
    channels_support: Vec<u32>,
    special_params: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct AudioFormatsToml {
    format: Vec<TomlAudioFormat>,
}

impl From<TomlAudioFormat> for AudioFormat {
    fn from(toml: TomlAudioFormat) -> Self {
        AudioFormat {
            extension: toml.extension,
            name: toml.name,
            category: toml.category,
            codec: toml.codec,
            container: if toml.container.is_empty() { None } else { Some(toml.container) },
            stability: toml.stability,
            description: toml.description,
            typical_use: toml.typical_use,
            lossy: toml.lossy,
            bitrate_range: if toml.bitrate_range.len() == 2 {
                Some((toml.bitrate_range[0], toml.bitrate_range[1]))
            } else {
                None
            },
            recommended_bitrate: if toml.recommended_bitrate == 0 {
                None
            } else {
                Some(toml.recommended_bitrate)
            },
            sample_rates: toml.sample_rates,
            recommended_sample_rate: toml.recommended_sample_rate,
            channels_support: toml.channels_support,
            special_params: toml.special_params,
        }
    }
}

lazy_static! {
    static ref AUDIO_FORMATS: HashMap<String, AudioFormat> = {
        let toml_str = include_str!("../formats/audio_formats.toml");
        let parsed: AudioFormatsToml = toml::from_str(toml_str)
            .expect("Failed to parse audio_formats.toml");
        
        parsed.format
            .into_iter()
            .map(|f| {
                let ext = f.extension.clone();
                (ext, f.into())
            })
            .collect()
    };
}

pub fn get_all_formats() -> Vec<AudioFormat> {
    let mut formats: Vec<AudioFormat> = AUDIO_FORMATS.values().cloned().collect();
    super::sort_by_category(&mut formats, |f| &f.category);
    formats
}

pub fn get_format(extension: &str) -> Option<AudioFormat> {
    AUDIO_FORMATS.get(extension).cloned()
}