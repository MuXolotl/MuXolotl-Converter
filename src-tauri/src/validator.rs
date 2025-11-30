use serde::{Deserialize, Serialize};
use crate::formats::{self, Stability};

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
        Self { is_valid: true, warnings: vec![], errors: vec![], suggested_params: vec![], alternative_codec: None }
    }
    fn warn(&mut self, msg: String) { self.warnings.push(msg); }
    fn error(&mut self, msg: String) { self.errors.push(msg); self.is_valid = false; }
    
    fn check_stability(&mut self, stability: Stability, ext: &str) {
        match stability {
            Stability::Problematic => self.error(format!("Format '{}' is problematic.", ext)),
            Stability::Experimental => self.warn(format!("Format '{}' is experimental.", ext)),
            Stability::RequiresSetup => self.warn(format!("Format '{}' requires additional setup.", ext)),
            _ => {}
        }
    }
}

pub fn validate_conversion(
    input_fmt: &str, output_fmt: &str, media_type: &str, settings: serde_json::Value
) -> ValidationResult {
    let mut res = ValidationResult::new();
    
    if media_type == "audio" {
        if let Some(fmt) = formats::audio::get_format(output_fmt) {
            // FIX: Clone stability to avoid partial move
            res.check_stability(fmt.stability.clone(), &fmt.extension);
            res.suggested_params.extend(fmt.special_params.clone());

            // Lossy checks
            if let Some(in_fmt) = formats::audio::get_format(input_fmt) {
                if in_fmt.lossy && !fmt.lossy { res.warn("Lossy -> Lossless won't improve quality.".into()); }
                else if !in_fmt.lossy && fmt.lossy { res.warn("Lossless -> Lossy reduces quality permanently.".into()); }
            }

            // Settings checks
            if let Some(sr) = settings.get("sampleRate").and_then(|v| v.as_u64()).map(|v| v as u32) {
                if !fmt.supports_sample_rate(sr) {
                    res.warn(format!("{}Hz not supported by {}. Recommended: {}Hz", sr, fmt.extension, fmt.recommended_sample_rate));
                }
            }
            if let Some(ch) = settings.get("channels").and_then(|v| v.as_u64()).map(|v| v as u32) {
                if !fmt.supports_channels(ch) { res.error(format!("{} doesn't support {} channels.", fmt.extension, ch)); }
            }
        } else {
            res.error(format!("Unknown format: {}", output_fmt));
        }
    } else if media_type == "video" {
        if let Some(fmt) = formats::video::get_format(output_fmt) {
            // FIX: Clone stability here too
            res.check_stability(fmt.stability.clone(), &fmt.extension);
            res.suggested_params.extend(fmt.special_params.clone());

            // Resolution checks
            if let Some((mw, mh)) = fmt.max_resolution {
                let w = settings.get("width").and_then(|v| v.as_u64());
                let h = settings.get("height").and_then(|v| v.as_u64());
                if let (Some(w), Some(h)) = (w, h) {
                    if w > mw as u64 || h > mh as u64 {
                        res.error(format!("Resolution exceeds max {}x{} for {}", mw, mh, fmt.extension));
                    }
                }
            }

            // Codec checks
            if let Some(c) = settings.get("videoCodec").and_then(|s| s.as_str()) {
                if !fmt.supports_video_codec(c) {
                    res.error(format!("{} does not support video codec '{}'", fmt.extension, c));
                    res.alternative_codec = fmt.get_default_video_codec().map(|s| s.to_string());
                }
            }
        } else {
            res.error(format!("Unknown format: {}", output_fmt));
        }
    }

    res
}