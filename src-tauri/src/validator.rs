use crate::formats::{audio, video, Stability};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
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
            ..Default::default()
        }
    }

    fn warn(&mut self, msg: impl Into<String>) {
        self.warnings.push(msg.into());
    }

    fn error(&mut self, msg: impl Into<String>) {
        self.errors.push(msg.into());
        self.is_valid = false;
    }

    fn check_stability(&mut self, stability: Stability, extension: &str) {
        match stability {
            Stability::Problematic => {
                self.error(format!("Format '{}' is problematic/legacy", extension));
            }
            Stability::Experimental => {
                self.warn(format!("Format '{}' is experimental", extension));
            }
            Stability::RequiresSetup => {
                self.warn(format!("Format '{}' may require external libs", extension));
            }
            Stability::Stable => {}
        }
    }
}

pub fn validate_conversion(
    input_format: &str,
    output_format: &str,
    media_type: &str,
    settings: serde_json::Value,
) -> ValidationResult {
    let mut result = ValidationResult::new();

    match media_type {
        "audio" => validate_audio(&mut result, input_format, output_format, &settings),
        "video" => validate_video(&mut result, output_format, &settings),
        _ => result.warn("Unknown media type"),
    }

    result
}

fn validate_audio(
    result: &mut ValidationResult,
    input_format: &str,
    output_format: &str,
    settings: &serde_json::Value,
) {
    let Some(fmt) = audio::get_format(output_format) else {
        result.error(format!("Unknown audio format: {}", output_format));
        return;
    };

    result.check_stability(fmt.stability.clone(), &fmt.extension);
    result.suggested_params.extend(fmt.special_params.clone());

    if let Some(input_fmt) = audio::get_format(input_format) {
        if input_fmt.lossy && !fmt.lossy {
            result.warn("Lossy source -> Lossless output (wasted space)");
        } else if !input_fmt.lossy && fmt.lossy {
            result.warn("Lossless source -> Lossy output (quality loss)");
        }
    }

    if let Some(sr) = settings.get("sampleRate").and_then(|v| v.as_u64()) {
        let sr = sr as u32;
        if !fmt.supports_sample_rate(sr) {
            result.warn(format!(
                "{}Hz unsupported for {}. Closest: {}Hz",
                sr, fmt.extension, fmt.recommended_sample_rate
            ));
        }
    }

    if let Some(ch) = settings.get("channels").and_then(|v| v.as_u64()) {
        let ch = ch as u32;
        if !fmt.supports_channels(ch) {
            result.error(format!("{} does not support {} channels", fmt.extension, ch));
        }
    }
}

fn validate_video(
    result: &mut ValidationResult,
    output_format: &str,
    settings: &serde_json::Value,
) {
    let Some(fmt) = video::get_format(output_format) else {
        result.error(format!("Unknown video format: {}", output_format));
        return;
    };

    result.check_stability(fmt.stability.clone(), &fmt.extension);
    result.suggested_params.extend(fmt.special_params.clone());

    let w = settings.get("width").and_then(|v| v.as_u64());
    let h = settings.get("height").and_then(|v| v.as_u64());

    if let (Some(w), Some(h)) = (w, h) {
        if fmt.requires_fixed_resolution {
            if w != 720 || (h != 576 && h != 480) {
                result.error(format!(
                    "{} requires 720x576 (PAL) or 720x480 (NTSC)",
                    fmt.extension
                ));
            }
        } else if let Some((max_w, max_h)) = fmt.max_resolution {
            if w > max_w as u64 || h > max_h as u64 {
                result.error(format!(
                    "Resolution {}x{} exceeds limits for {} (Max: {}x{})",
                    w, h, fmt.extension, max_w, max_h
                ));
            }
        }
    }

    if let Some(br) = settings.get("bitrate").and_then(|v| v.as_u64()) {
        if br > 50_000 {
            result.warn("Very high bitrate selected (>50 Mbps). Ensure disk space.");
        }
        if br < 100 {
            result.warn("Very low bitrate (<100 kbps) for video. Expect blockiness.");
        }
    }
}