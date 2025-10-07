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

impl AudioFormat {
    #[inline]
    pub fn supports_sample_rate(&self, sample_rate: u32) -> bool {
        self.sample_rates.contains(&sample_rate)
    }

    #[inline]
    pub fn supports_channels(&self, channels: u32) -> bool {
        self.channels_support.contains(&channels)
    }

    pub fn validate_bitrate(&self, bitrate: u32) -> Result<(), String> {
        if !self.lossy {
            return Ok(());
        }

        if let Some((min, max)) = self.bitrate_range {
            if bitrate < min || bitrate > max {
                return Err(format!(
                    "Bitrate {}kbps out of range [{}-{}] for {}",
                    bitrate, min, max, self.extension
                ));
            }
        }
        Ok(())
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

    #[inline]
    pub fn get_ffmpeg_codec(&self) -> String {
        self.codec.clone()
    }

    #[inline]
    pub fn is_suitable_for_extraction(&self) -> bool {
        !matches!(self.extension.as_str(), "shn" | "ra" | "tak")
    }

    #[inline]
    pub fn get_container_format(&self) -> Option<String> {
        self.container.clone()
    }

    pub fn can_copy_codec(&self, source_codec: &str) -> bool {
        let source = source_codec.to_lowercase();
        let target = self.codec.to_lowercase();

        if source == target {
            return true;
        }

        match self.extension.as_str() {
            "mp3" => source.contains("mp3"),
            "aac" | "m4a" => source.contains("aac") || source.contains("alac"),
            "ogg" => source.contains("vorbis") || source.contains("opus"),
            "opus" => source.contains("opus"),
            "flac" => source.contains("flac"),
            "wav" => source.starts_with("pcm_"),
            "wma" => source.starts_with("wmav"),
            "ac3" => source.contains("ac3"),
            "dts" => source.contains("dts") || source.contains("dca"),
            "amr" => source.starts_with("amr"),
            "alac" => source.contains("alac"),
            "aiff" => source.starts_with("pcm_"),
            "wv" => source.contains("wavpack"),
            "ape" => source.contains("ape"),
            "tta" => source.contains("tta"),
            "mka" => true,
            _ => false,
        }
    }

    pub fn get_quality_args(&self, quality: &str) -> Vec<String> {
        match self.codec.as_str() {
            "libvorbis" => {
                let q = match quality {
                    "low" => "3",
                    "high" => "7",
                    "ultra" => "9",
                    _ => "5",
                };
                vec!["-q:a".to_string(), q.to_string()]
            }
            "libopus" => vec!["-vbr".to_string(), "on".to_string()],
            "flac" => {
                let comp = match quality {
                    "low" => "0",
                    "high" => "8",
                    "ultra" => "12",
                    _ => "5",
                };
                vec!["-compression_level".to_string(), comp.to_string()]
            }
            "wavpack" => {
                let comp = match quality {
                    "low" => "0",
                    "ultra" | "high" => "8",
                    _ => "4",
                };
                vec!["-compression_level".to_string(), comp.to_string()]
            }
            _ => Vec::new(),
        }
    }
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

#[inline]
pub fn get_format(extension: &str) -> Option<AudioFormat> {
    AUDIO_FORMATS.get(extension).cloned()
}