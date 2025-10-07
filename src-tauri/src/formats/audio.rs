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
    pub fn supports_sample_rate(&self, sample_rate: u32) -> bool {
        self.sample_rates.contains(&sample_rate)
    }

    pub fn supports_channels(&self, channels: u32) -> bool {
        self.channels_support.contains(&channels)
    }

    pub fn validate_bitrate(&self, bitrate: u32) -> Result<(), String> {
        if !self.lossy {
            return Ok(());
        }

        if let Some((min, max)) = self.bitrate_range {
            if bitrate < min {
                return Err(format!(
                    "Bitrate {}kbps is below minimum {}kbps for {}",
                    bitrate, min, self.extension
                ));
            }
            if bitrate > max {
                return Err(format!(
                    "Bitrate {}kbps exceeds maximum {}kbps for {}",
                    bitrate, max, self.extension
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

    pub fn get_ffmpeg_codec(&self) -> String {
        match self.codec.as_str() {
            "aac" => "aac".to_string(),
            "libmp3lame" => "libmp3lame".to_string(),
            "libvorbis" => "libvorbis".to_string(),
            "libopus" => "libopus".to_string(),
            "flac" => "flac".to_string(),
            "alac" => "alac".to_string(),
            "pcm_s16le" => "pcm_s16le".to_string(),
            "pcm_s16be" => "pcm_s16be".to_string(),
            "wavpack" => "wavpack".to_string(),
            "ac3" => "ac3".to_string(),
            "dca" => "dca".to_string(),
            "wmav2" => "wmav2".to_string(),
            "libopencore_amrnb" => "libopencore_amrnb".to_string(),
            other => other.to_string(),
        }
    }

    pub fn is_suitable_for_extraction(&self) -> bool {
        !matches!(
            self.extension.as_str(),
            "shn" | "ra" | "tak"
        )
    }

    pub fn get_container_format(&self) -> Option<String> {
        self.container.clone()
    }

    pub fn can_copy_codec(&self, source_codec: &str) -> bool {
        let normalized_source = source_codec.to_lowercase();
        let normalized_target = self.codec.to_lowercase();

        if normalized_source == normalized_target {
            return true;
        }

        match self.extension.as_str() {
            "mp3" => normalized_source.contains("mp3"),
            "aac" | "m4a" => {
                normalized_source.contains("aac") || 
                normalized_source.contains("alac")
            }
            "ogg" => {
                normalized_source.contains("vorbis") || 
                normalized_source.contains("opus")
            }
            "opus" => normalized_source.contains("opus"),
            "flac" => normalized_source.contains("flac"),
            "wav" => normalized_source.starts_with("pcm_"),
            "wma" => normalized_source.starts_with("wmav"),
            "ac3" => normalized_source.contains("ac3"),
            "dts" => normalized_source.contains("dts") || normalized_source.contains("dca"),
            "amr" => normalized_source.starts_with("amr"),
            "alac" => normalized_source.contains("alac"),
            "aiff" => normalized_source.starts_with("pcm_"),
            "wv" => normalized_source.contains("wavpack"),
            "ape" => normalized_source.contains("ape"),
            "tta" => normalized_source.contains("tta"),
            "mka" => true,
            _ => false,
        }
    }

    pub fn get_quality_args(&self, quality: &str) -> Vec<String> {
        let mut args = Vec::new();

        match self.codec.as_str() {
            "libvorbis" => {
                let q = match quality {
                    "low" => "3",
                    "medium" => "5",
                    "high" => "7",
                    "ultra" => "9",
                    _ => "5",
                };
                args.extend_from_slice(&["-q:a".to_string(), q.to_string()]);
            }
            "libopus" => {
                args.extend_from_slice(&["-vbr".to_string(), "on".to_string()]);
            }
            "flac" => {
                let compression = match quality {
                    "low" => "0",
                    "medium" => "5",
                    "high" => "8",
                    "ultra" => "12",
                    _ => "8",
                };
                args.extend_from_slice(&[
                    "-compression_level".to_string(),
                    compression.to_string(),
                ]);
            }
            "wavpack" => {
                let compression = match quality {
                    "low" => "0",
                    "medium" => "4",
                    "high" => "8",
                    "ultra" => "8",
                    _ => "8",
                };
                args.extend_from_slice(&[
                    "-compression_level".to_string(),
                    compression.to_string(),
                ]);
            }
            _ => {}
        }

        args
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
            container: if toml.container.is_empty() {
                None
            } else {
                Some(toml.container)
            },
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