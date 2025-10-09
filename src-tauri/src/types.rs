use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    Low,
    Medium,
    High,
    Ultra,
    Custom,
}

impl Quality {
    pub fn as_str(&self) -> &str {
        match self {
            Quality::Low => "low",
            Quality::Medium => "medium",
            Quality::High => "high",
            Quality::Ultra => "ultra",
            Quality::Custom => "custom",
        }
    }
}

impl Default for Quality {
    fn default() -> Self {
        Quality::Medium
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionSettings {
    pub task_id: Option<String>,
    #[serde(default)]
    pub quality: Quality,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    #[serde(default)]
    pub use_gpu: bool,
    pub audio_action: Option<String>,
    #[serde(default)]
    pub copy_audio: bool,
}

impl ConversionSettings {
    pub fn task_id(&self) -> String {
        self.task_id.clone().unwrap_or_else(|| "unknown".to_string())
    }

    pub fn quality_str(&self) -> &str {
        self.quality.as_str()
    }

    pub fn get_bitrate(&self) -> Option<u32> {
        self.bitrate
    }

    pub fn get_sample_rate(&self) -> u32 {
        self.sample_rate.unwrap_or(44100)
    }

    pub fn get_channels(&self) -> u32 {
        self.channels.unwrap_or(2)
    }
}