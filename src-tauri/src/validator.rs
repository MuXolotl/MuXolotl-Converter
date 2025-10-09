use serde::{Deserialize, Serialize};
use crate::formats;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub suggested_params: Vec<String>,
    pub alternative_codec: Option<String>,
}

impl ValidationResult {
    fn new() -> Self {
        Self {
            is_valid: true,
            warnings: Vec::new(),
            errors: Vec::new(),
            suggested_params: Vec::new(),
            alternative_codec: None,
        }
    }

    fn warn(&mut self, msg: impl Into<String>) {
        self.warnings.push(msg.into());
    }

    fn error(&mut self, msg: impl Into<String>) {
        self.errors.push(msg.into());
        self.is_valid = false;
    }
}

pub fn validate_conversion(
    input_format: &str,
    output_format: &str,
    media_type: &str,
    settings: serde_json::Value,
) -> ValidationResult {
    match media_type {
        "audio" => validate_audio(input_format, output_format, settings),
        "video" => validate_video(output_format, settings),
        _ => ValidationResult::new(),
    }
}

fn validate_audio(input: &str, output: &str, settings: serde_json::Value) -> ValidationResult {
    let mut result = ValidationResult::new();

    let Some(fmt) = formats::audio::get_format(output) else {
        result.error(format!("Unknown format: {}", output));
        return result;
    };

    match fmt.stability {
        formats::Stability::Problematic => {
            result.error(format!("Format '{}' is problematic. Conversion may fail.", fmt.extension));
        }
        formats::Stability::Experimental => {
            result.warn(format!("Format '{}' is experimental.", fmt.extension));
        }
        formats::Stability::RequiresSetup => {
            result.warn(format!("Format '{}' requires special setup.", fmt.extension));
            result.suggested_params.extend(fmt.special_params.clone());
        }
        _ => {}
    }

    if let Some(input_fmt) = formats::audio::get_format(input) {
        if input_fmt.lossy && !fmt.lossy {
            result.warn("Lossy→Lossless conversion will NOT improve quality.");
        } else if !input_fmt.lossy && fmt.lossy {
            result.warn("Lossless→Lossy conversion will reduce quality permanently.");
        }
    }

    if let Some(sr) = settings.get("sampleRate").and_then(|s| s.as_u64()) {
        if !fmt.supports_sample_rate(sr as u32) {
            result.warn(format!(
                "Sample rate {}Hz not supported. Recommended: {}Hz",
                sr, fmt.recommended_sample_rate
            ));
        }
    }

    if let Some(ch) = settings.get("channels").and_then(|c| c.as_u64()) {
        if !fmt.supports_channels(ch as u32) {
            result.error(format!(
                "Format '{}' doesn't support {} channel(s).",
                fmt.extension, ch
            ));
        }
    }

    if fmt.lossy {
        if let Some(br) = settings.get("bitrate").and_then(|b| b.as_u64()) {
            if let Err(err) = fmt.validate_bitrate(br as u32) {
                result.warn(err);
            }
        }
    }

    match fmt.extension.as_str() {
        "amr" => result.warn("AMR is for voice/telephony, not music."),
        "ac3" | "dts" if settings.get("channels").and_then(|c| c.as_u64()).unwrap_or(2) < 3 => {
            result.warn(format!("{} is for surround sound. For stereo, use AAC/MP3.", fmt.extension.to_uppercase()));
        }
        "ape" | "tak" | "tta" => result.warn(format!("{} has limited player support.", fmt.name)),
        "shn" => result.warn("Shorten is obsolete. Use FLAC instead."),
        "ra" => result.warn("RealAudio has poor modern support."),
        "spx" => result.warn("Speex is for speech. Use Opus for music."),
        "wma" => result.warn("WMA has limited support outside Windows."),
        _ => {}
    }

    if !fmt.special_params.is_empty() {
        result.suggested_params.extend(fmt.special_params.clone());
    }

    result
}

fn validate_video(output: &str, settings: serde_json::Value) -> ValidationResult {
    let mut result = ValidationResult::new();

    let Some(fmt) = formats::video::get_format(output) else {
        result.error(format!("Unknown format: {}", output));
        return result;
    };

    match fmt.stability {
        formats::Stability::Problematic => {
            result.error(format!("Format '{}' is problematic.", fmt.extension));
        }
        formats::Stability::Experimental => {
            result.warn(format!("Format '{}' is experimental.", fmt.extension));
        }
        formats::Stability::RequiresSetup => {
            result.warn(format!("Format '{}' requires special setup.", fmt.extension));
            result.suggested_params.extend(fmt.special_params.clone());
        }
        _ => {}
    }

    if let Some(max_res) = fmt.max_resolution {
        if let (Some(w), Some(h)) = (
            settings.get("width").and_then(|w| w.as_u64()),
            settings.get("height").and_then(|h| h.as_u64()),
        ) {
            if w > max_res.0 as u64 || h > max_res.1 as u64 {
                result.error(format!(
                    "Resolution {}x{} exceeds max {}x{} for {}",
                    w, h, max_res.0, max_res.1, fmt.extension
                ));
            }

            if w % 2 != 0 || h % 2 != 0 {
                result.warn("Odd dimensions will be auto-adjusted to even values.");
            }
        }
    }

    if let Some(codec) = settings.get("videoCodec").and_then(|c| c.as_str()) {
        if !fmt.supports_video_codec(codec) {
            result.error(format!(
                "{} doesn't support '{}' codec.",
                fmt.extension, codec
            ));

            if let Some(default) = fmt.get_default_video_codec() {
                result.alternative_codec = Some(default.to_string());
            }
        }
    }

    if let Some(audio_codec) = settings.get("audioCodec").and_then(|c| c.as_str()) {
        if !fmt.supports_audio_codec(audio_codec) {
            result.error(format!(
                "{} doesn't support '{}' audio codec.",
                fmt.extension, audio_codec
            ));
        }
    }

    if !fmt.special_params.is_empty() {
        result.suggested_params.extend(fmt.special_params.clone());
    }

    result
}