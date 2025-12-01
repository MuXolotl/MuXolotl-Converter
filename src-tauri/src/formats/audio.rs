use super::{sort_formats_by_category, Category, Stability};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// AudioFormat
// ============================================================================

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
    // New: List of codecs that can be copied directly into this format
    #[serde(default)]
    pub compatible_sources: Vec<String>,
}

impl AudioFormat {
    #[inline]
    pub fn supports_sample_rate(&self, rate: u32) -> bool {
        self.sample_rates.contains(&rate)
    }

    #[inline]
    pub fn supports_channels(&self, channels: u32) -> bool {
        self.channels_support.contains(&channels)
    }

    pub fn get_bitrate_for_quality(&self, quality: &str) -> Option<u32> {
        if !self.lossy {
            return None;
        }

        let (min, max) = self.bitrate_range?;
        let recommended = self.recommended_bitrate.unwrap_or((min + max) / 2);

        Some(match quality {
            "low" => min,
            "medium" => recommended,
            "high" => ((recommended + max) / 2).min(max),
            "ultra" => max,
            _ => recommended,
        })
    }

    /// Checks if source codec can be copied without re-encoding
    /// Logic is now fully config-driven via 'compatible_sources' in TOML
    pub fn can_copy_codec(&self, source_codec: &str) -> bool {
        let source = source_codec.to_lowercase();
        let target = self.codec.to_lowercase();

        // 1. Same codec is usually copyable
        if source == target {
            return true;
        }

        // 2. Check compatibility list from config
        // "*" means accepts anything (like MKA)
        if self.compatible_sources.contains(&"*".to_string()) {
            return true;
        }

        self.compatible_sources.iter().any(|s| source.contains(s))
    }

    /// Returns best sample rate from supported list
    pub fn best_sample_rate(&self, requested: u32) -> u32 {
        if self.supports_sample_rate(requested) {
            requested
        } else {
            self.recommended_sample_rate
        }
    }

    /// Returns best channel count from supported list
    pub fn best_channels(&self, requested: u32) -> u32 {
        if self.supports_channels(requested) {
            requested
        } else {
            // Prefer stereo, then mono, then first supported
            self.channels_support
                .iter()
                .find(|&&c| c == 2)
                .or_else(|| self.channels_support.iter().find(|&&c| c == 1))
                .or_else(|| self.channels_support.first())
                .copied()
                .unwrap_or(2)
        }
    }
}

// ============================================================================
// TOML Parsing
// ============================================================================

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
    #[serde(default)]
    compatible_sources: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct AudioFormatsToml {
    format: Vec<TomlAudioFormat>,
}

impl From<TomlAudioFormat> for AudioFormat {
    fn from(t: TomlAudioFormat) -> Self {
        Self {
            extension: t.extension,
            name: t.name,
            category: t.category,
            codec: t.codec,
            container: if t.container.is_empty() {
                None
            } else {
                Some(t.container)
            },
            stability: t.stability,
            description: t.description,
            typical_use: t.typical_use,
            lossy: t.lossy,
            bitrate_range: if t.bitrate_range.len() == 2 {
                Some((t.bitrate_range[0], t.bitrate_range[1]))
            } else {
                None
            },
            recommended_bitrate: if t.recommended_bitrate == 0 {
                None
            } else {
                Some(t.recommended_bitrate)
            },
            sample_rates: t.sample_rates,
            recommended_sample_rate: t.recommended_sample_rate,
            channels_support: t.channels_support,
            special_params: t.special_params,
            compatible_sources: t.compatible_sources,
        }
    }
}

// ============================================================================
// Static Cache
// ============================================================================

lazy_static! {
    static ref AUDIO_FORMATS: HashMap<String, AudioFormat> = {
        let toml_str = include_str!("audio_formats.toml");
        let parsed: AudioFormatsToml =
            toml::from_str(toml_str).expect("Failed to parse audio_formats.toml");

        parsed
            .format
            .into_iter()
            .map(|f| (f.extension.clone(), f.into()))
            .collect()
    };
}

pub fn get_all_formats() -> Vec<AudioFormat> {
    let mut formats: Vec<AudioFormat> = AUDIO_FORMATS.values().cloned().collect();
    sort_formats_by_category(&mut formats, |f| &f.category);
    formats
}

#[inline]
pub fn get_format(extension: &str) -> Option<AudioFormat> {
    AUDIO_FORMATS.get(extension).cloned()
}