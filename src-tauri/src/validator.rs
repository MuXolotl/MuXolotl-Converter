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

    fn add_warning(&mut self, msg: impl Into<String>) {
        self.warnings.push(msg.into());
    }

    fn add_error(&mut self, msg: impl Into<String>) {
        self.errors.push(msg.into());
        self.is_valid = false;
    }

    fn extend_params(&mut self, params: Vec<String>) {
        self.suggested_params.extend(params);
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

fn validate_audio(
    input_format: &str,
    output_format: &str,
    settings: serde_json::Value,
) -> ValidationResult {
    let mut result = ValidationResult::new();

    let Some(output) = formats::audio::get_format(output_format) else {
        result.add_error(format!("Unknown output format: {}", output_format));
        return result;
    };

    // Stability check
    match output.stability {
        formats::Stability::Problematic => {
            result.add_error(format!(
                "Format '{}' is marked as problematic. Conversion may fail or produce poor results.",
                output.extension
            ));
        }
        formats::Stability::Experimental => {
            result.add_warning(format!("Format '{}' is experimental. Use with caution.", output.extension));
        }
        formats::Stability::RequiresSetup => {
            result.add_warning(format!("Format '{}' requires special setup or libraries.", output.extension));
            result.extend_params(output.special_params.clone());
        }
        _ => {}
    }

    // Checking the conversion quality
    if let Some(input) = formats::audio::get_format(input_format) {
        match (input.lossy, output.lossy) {
            (true, false) => {
                result.add_warning(
                    "Converting lossy→lossless will NOT improve quality. File size will increase unnecessarily."
                );
            }
            (false, true) => {
                result.add_warning("Converting lossless→lossy will reduce quality permanently.");
            }
            _ => {}
        }
    }

    // Checking the sample rate
    if let Some(sr) = settings.get("sampleRate").and_then(|s| s.as_u64()) {
        let sample_rate = sr as u32;
        if !output.supports_sample_rate(sample_rate) {
            result.add_warning(format!(
                "Sample rate {}Hz not supported by {}. Recommended: {}Hz",
                sample_rate, output.extension, output.recommended_sample_rate
            ));
        }
    }

    // Checking channels
    if let Some(ch) = settings.get("channels").and_then(|c| c.as_u64()) {
        let channels = ch as u32;
        if !output.supports_channels(channels) {
            result.add_error(format!(
                "Format '{}' does not support {} channel(s). Supported: {:?}",
                output.extension, channels, output.channels_support
            ));
        }
    }

    // Checking bitrate
    if output.lossy {
        if let Some(br) = settings.get("bitrate").and_then(|b| b.as_u64()) {
            if let Err(err) = output.validate_bitrate(br as u32) {
                result.add_warning(err);
            }
        }
    }

    // Specific warnings
    match output.extension.as_str() {
        "amr" => result.add_warning("AMR is designed for voice/telephony. Not suitable for music."),
        "ac3" | "dts" if settings.get("channels").and_then(|c| c.as_u64()).unwrap_or(2) < 3 => {
            result.add_warning(format!(
                "{} is designed for surround sound (3+ channels). For stereo, consider AAC or MP3.",
                output.extension.to_uppercase()
            ));
        }
        "ape" | "tak" | "tta" => {
            result.add_warning(format!("{} is a niche format with limited player support.", output.name));
        }
        "shn" => result.add_warning("Shorten (SHN) is an obsolete format. Consider FLAC instead."),
        "ra" => result.add_warning("RealAudio is a legacy format. Modern players may not support it."),
        "spx" => result.add_warning("Speex is optimized for speech, not music. Consider Opus for better quality."),
        "wma" => result.add_warning("WMA has limited support outside Windows ecosystem."),
        _ => {}
    }

    if !output.special_params.is_empty() {
        result.extend_params(output.special_params.clone());
    }

    result
}

fn validate_video(output_format: &str, settings: serde_json::Value) -> ValidationResult {
    let mut result = ValidationResult::new();

    let Some(output) = formats::video::get_format(output_format) else {
        result.add_error(format!("Unknown output format: {}", output_format));
        return result;
    };

    // Stability check
    match output.stability {
        formats::Stability::Problematic => {
            result.add_error(format!("Format '{}' is problematic. Conversion may fail.", output.extension));
        }
        formats::Stability::Experimental => {
            result.add_warning(format!("Format '{}' is experimental.", output.extension));
        }
        formats::Stability::RequiresSetup => {
            result.add_warning(format!("Format '{}' requires special setup.", output.extension));
            result.extend_params(output.special_params.clone());
        }
        _ => {}
    }

    // Checking resolution
    if let Some(max_res) = output.max_resolution {
        if let (Some(width), Some(height)) = (
            settings.get("width").and_then(|w| w.as_u64()),
            settings.get("height").and_then(|h| h.as_u64()),
        ) {
            if width > max_res.0 as u64 || height > max_res.1 as u64 {
                result.add_error(format!(
                    "Resolution {}x{} exceeds max {}x{} for {}",
                    width, height, max_res.0, max_res.1, output.extension
                ));
            }

            if width % 2 != 0 || height % 2 != 0 {
                result.add_warning("Odd dimensions will be adjusted to even values automatically.");
            }
        }
    }

    // Checking the video codec
    if let Some(codec) = settings.get("videoCodec").and_then(|c| c.as_str()) {
        if !output.supports_video_codec(codec) {
            result.add_error(format!(
                "{} doesn't support '{}' video codec. Allowed: {:?}",
                output.extension, codec, output.video_codecs
            ));

            if let Some(default) = output.get_default_video_codec() {
                result.alternative_codec = Some(default.to_string());
            }
        }
    } else if let Some(default) = output.get_default_video_codec() {
        result.add_warning(format!("Video will use {} codec (default for {}).", default, output.extension));
    }

    // Checking the audio codec
    if let Some(audio_codec) = settings.get("audioCodec").and_then(|c| c.as_str()) {
        if !output.supports_audio_codec(audio_codec) {
            result.add_error(format!(
                "{} doesn't support '{}' audio codec. Allowed: {:?}",
                output.extension, audio_codec, output.audio_codecs
            ));
        }
    } else if !output.audio_codecs.is_empty() {
        if let Some(default) = output.get_default_audio_codec() {
            result.add_warning(format!("Audio will use {} codec.", default));
        }
    }

    if !output.special_params.is_empty() {
        result.extend_params(output.special_params.clone());
    }

    result
}