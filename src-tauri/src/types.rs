use serde::{Deserialize, Serialize};

// ============================================================================
// Quality
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    Low,
    #[default]
    Medium,
    High,
    Ultra,
    Custom,
}

impl Quality {
    pub fn as_str(&self) -> &'static str {
        match self {
            Quality::Low => "low",
            Quality::Medium => "medium",
            Quality::High => "high",
            Quality::Ultra => "ultra",
            Quality::Custom => "custom",
        }
    }

    pub fn video_crf(&self) -> &'static str {
        match self {
            Quality::Low => "28",
            Quality::Medium => "23",
            Quality::High => "19",
            Quality::Ultra => "15",
            Quality::Custom => "23",
        }
    }

    pub fn video_preset(&self) -> &'static str {
        match self {
            Quality::Low => "veryfast",
            Quality::Medium => "medium",
            Quality::High => "slow",
            Quality::Ultra => "veryslow",
            Quality::Custom => "medium",
        }
    }
}

// ============================================================================
// Metadata
// ============================================================================

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FileMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<String>,
}

impl FileMetadata {
    pub fn to_ffmpeg_args(&self) -> Vec<String> {
        let mut args = vec!["-map_metadata".to_string(), "-1".to_string()];

        let fields = [
            ("title", &self.title),
            ("artist", &self.artist),
            ("album", &self.album),
            ("genre", &self.genre),
            ("date", &self.year),
        ];

        for (key, value) in fields {
            if let Some(v) = value {
                if !v.is_empty() {
                    args.push("-metadata".to_string());
                    args.push(format!("{}={}", key, v));
                }
            }
        }

        args
    }
}

// ============================================================================
// Conversion Settings
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionSettings {
    // Use only snake_case
    #[serde(default)]
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
    
    #[serde(default)]
    pub copy_audio: bool,
    
    #[serde(default)]
    pub extract_audio_only: bool,
    
    pub metadata: Option<FileMetadata>,
}

impl Default for ConversionSettings {
    fn default() -> Self {
        Self {
            task_id: None,
            quality: Quality::Medium,
            bitrate: None,
            sample_rate: Some(44100),
            channels: Some(2),
            width: None,
            height: None,
            fps: None,
            video_codec: None,
            audio_codec: None,
            use_gpu: false,
            copy_audio: false,
            extract_audio_only: false,
            metadata: None,
        }
    }
}

impl ConversionSettings {
    pub fn task_id(&self) -> String {
        self.task_id.clone().unwrap_or_else(|| {
            format!("task_{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis())
        })
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate.unwrap_or(44100)
    }

    pub fn channels(&self) -> u32 {
        self.channels.unwrap_or(2)
    }

    #[allow(dead_code)]
    pub fn metadata_args(&self) -> Vec<String> {
        self.metadata
            .as_ref()
            .map(|m| m.to_ffmpeg_args())
            .unwrap_or_else(|| vec!["-map_metadata".to_string(), "-1".to_string()])
    }
}