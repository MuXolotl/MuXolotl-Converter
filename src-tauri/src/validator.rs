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

    // Проверка стабильности
    match output.stability {
        formats::Stability::Problematic => {
            result.add_warning(format!("Format '{}' has known issues. Conversion may fail.", output.extension));
        }
        formats::Stability::Experimental => {
            result.add_warning(format!("Format '{}' is experimental. Use with caution.", output.extension));
        }
        formats::Stability::RequiresSetup => {
            result.extend_params(output.special_params.clone());
        }
        _ => {}
    }

    // Lossy/lossless конверсия
    if let Some(input) = formats::audio::get_format(input_format) {
        if input.lossy && !output.lossy {
            result.add_warning("Converting from lossy to lossless will not improve quality.");
        } else if !input.lossy && output.lossy {
            result.add_warning("Converting from lossless to lossy will reduce quality.");
        }
    }

    // Sample rate
    if let Some(sample_rate) = settings.get("sampleRate").and_then(|s| s.as_u64()) {
        if !output.sample_rates.contains(&(sample_rate as u32)) {
            result.add_warning(format!(
                "Sample rate {}Hz may not be optimal for {}. Recommended: {}Hz",
                sample_rate, output.extension, output.recommended_sample_rate
            ));
        }
    }

    // Специфичные форматы
    match output_format {
        "amr" => {
            result.extend_params(vec!["-ar".to_string(), "8000".to_string()]);
            if settings.get("sampleRate").and_then(|s| s.as_u64()) != Some(8000) {
                result.add_error("AMR format requires 8000Hz sample rate.");
            }
        }
        "ac3" if settings.get("channels").and_then(|c| c.as_u64()) == Some(2) => {
            result.add_warning("AC3 is typically used for 5.1 surround sound.");
        }
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

    // Стабильность
    match output.stability {
        formats::Stability::Problematic => {
            result.add_warning(format!("Format '{}' has known issues. Conversion may fail.", output.extension));
        }
        formats::Stability::Experimental => {
            result.add_warning(format!("Format '{}' is experimental. Use with caution.", output.extension));
        }
        formats::Stability::RequiresSetup => {
            result.extend_params(output.special_params.clone());
        }
        _ => {}
    }

    // Разрешение
    if let Some(max_res) = output.max_resolution {
        if let (Some(width), Some(height)) = (
            settings.get("width").and_then(|w| w.as_u64()),
            settings.get("height").and_then(|h| h.as_u64()),
        ) {
            if width > max_res.0 as u64 || height > max_res.1 as u64 {
                result.add_error(format!(
                    "Resolution {}x{} exceeds maximum {}x{} for {}",
                    width, height, max_res.0, max_res.1, output.extension
                ));
            }
        }
    }

    // Специфичные форматы
    match output_format {
        "webm" => {
            if let Some(codec) = settings.get("videoCodec").and_then(|c| c.as_str()) {
                if !["vp8", "vp9", "av1"].contains(&codec) {
                    result.add_error("WebM only supports VP8, VP9, or AV1 video codecs.");
                    result.alternative_codec = Some("vp9".to_string());
                }
            }
            if let Some(audio_codec) = settings.get("audioCodec").and_then(|c| c.as_str()) {
                if !["opus", "vorbis"].contains(&audio_codec) {
                    result.add_error("WebM only supports Opus or Vorbis audio codecs.");
                }
            }
        }
        "vob" => {
            result.extend_params(vec!["-target".to_string(), "dvd".to_string()]);
            if let (Some(width), Some(height)) = (
                settings.get("width").and_then(|w| w.as_u64()),
                settings.get("height").and_then(|h| h.as_u64()),
            ) {
                if width != 720 || (height != 576 && height != 480) {
                    result.add_warning("VOB format should use 720x576 (PAL) or 720x480 (NTSC).");
                }
            }
        }
        "3gp" => {
            result.extend_params(vec!["-strict".to_string(), "experimental".to_string()]);
            if let (Some(width), Some(height)) = (
                settings.get("width").and_then(|w| w.as_u64()),
                settings.get("height").and_then(|h| h.as_u64()),
            ) {
                if width > 352 || height > 288 {
                    result.add_warning("3GP typically uses 352x288 resolution for compatibility.");
                }
            }
        }
        _ => {}
    }

    if !output.special_params.is_empty() {
        result.extend_params(output.special_params.clone());
    }

    result
}