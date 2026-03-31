use crate::codec_registry;
use crate::formats::{audio, video, Stability};
use crate::gpu::GpuInfo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub info: Vec<String>,
    pub suggested_params: Vec<String>,
    pub alternative_codec: Option<String>,
    pub can_copy_video: bool,
    pub can_copy_audio: bool,
}

impl ValidationResult {
    fn new() -> Self {
        Self {
            is_valid: true,
            ..Default::default()
        }
    }

    fn info(&mut self, msg: impl Into<String>) {
        self.info.push(msg.into());
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

/// Extended validation context (optional fields for smart recommendations)
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ValidationContext {
    pub input_format: String,
    pub output_format: String,
    pub media_type: String,
    pub settings: serde_json::Value,
    #[serde(default)]
    pub input_video_codec: Option<String>,
    #[serde(default)]
    pub input_audio_codec: Option<String>,
    #[serde(default)]
    pub input_width: Option<u32>,
    #[serde(default)]
    pub input_height: Option<u32>,
    #[serde(default)]
    pub gpu_vendor: Option<String>,
    #[serde(default)]
    pub gpu_name: Option<String>,
    #[serde(default)]
    pub gpu_available: Option<bool>,
}

pub fn validate(ctx: &ValidationContext) -> ValidationResult {
    let mut result = ValidationResult::new();

    match ctx.media_type.as_str() {
        "audio" => validate_audio(&mut result, ctx),
        "video" => validate_video(&mut result, ctx),
        _ => result.warn("Unknown media type"),
    }

    result
}

// ============ Audio validation ============

fn validate_audio(result: &mut ValidationResult, ctx: &ValidationContext) {
    let Some(fmt) = audio::get_format(&ctx.output_format) else {
        result.error(format!("Unknown audio format: {}", ctx.output_format));
        return;
    };

    result.check_stability(fmt.stability.clone(), &fmt.extension);
    result.suggested_params.extend(fmt.special_params.clone());

    // Check encoder availability
    if fmt.codec != "copy" && codec_registry::is_initialized() {
        if !codec_registry::is_encoder_available(&fmt.codec) {
            if let Some(fallback) = codec_registry::get_audio_fallback(&fmt.codec) {
                result.warn(format!(
                    "Encoder '{}' not found, will use '{}'",
                    fmt.codec, fallback
                ));
                result.alternative_codec = Some(fallback.to_string());
            } else {
                result.error(format!(
                    "Encoder '{}' not available in this FFmpeg build",
                    fmt.codec
                ));
            }
        }
    }

    // Lossy/lossless conversion warnings
    if let Some(input_fmt) = audio::get_format(&ctx.input_format) {
        if input_fmt.lossy && !fmt.lossy {
            result.warn("Lossy → Lossless: no quality improvement, larger file size");
        } else if !input_fmt.lossy && fmt.lossy {
            result.warn("Lossless → Lossy: irreversible quality loss");
        }
    }

    // Audio codec copy detection
    if let Some(input_codec) = &ctx.input_audio_codec {
        if fmt.can_copy_codec(input_codec) {
            result.can_copy_audio = true;
            result.info("Audio stream copy possible — no re-encoding needed".to_string());
        }
    }

    // Sample rate validation
    if let Some(sr) = ctx.settings.get("sampleRate").and_then(|v| v.as_u64()) {
        let sr = sr as u32;
        if !fmt.supports_sample_rate(sr) {
            result.warn(format!(
                "{}Hz unsupported for {}. Closest: {}Hz",
                sr, fmt.extension, fmt.recommended_sample_rate
            ));
        }
    }

    // Channel validation
    if let Some(ch) = ctx.settings.get("channels").and_then(|v| v.as_u64()) {
        let ch = ch as u32;
        if !fmt.supports_channels(ch) {
            result.error(format!(
                "{} does not support {} channels",
                fmt.extension, ch
            ));
        }
    }
}

// ============ Video validation ============

fn validate_video(result: &mut ValidationResult, ctx: &ValidationContext) {
    let Some(fmt) = video::get_format(&ctx.output_format) else {
        result.error(format!("Unknown video format: {}", ctx.output_format));
        return;
    };

    result.check_stability(fmt.stability.clone(), &fmt.extension);
    result.suggested_params.extend(fmt.special_params.clone());

    let use_gpu = ctx
        .settings
        .get("useGpu")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // --- Video stream copy detection ---
    check_video_copy(result, ctx, &fmt);

    // --- GPU codec availability ---
    if use_gpu {
        check_gpu_codec(result, ctx, &fmt);
    }

    // --- Resolution validation ---
    validate_resolution(result, ctx, &fmt);

    // --- Input-aware recommendations ---
    recommend_for_input(result, ctx, &fmt);

    // --- Bitrate sanity check ---
    if let Some(br) = ctx.settings.get("bitrate").and_then(|v| v.as_u64()) {
        if br > 50_000 {
            result.warn("Very high bitrate (>50 Mbps). Ensure disk space.");
        }
        if br < 100 {
            result.warn("Very low bitrate (<100 kbps). Expect blockiness.");
        }
    }

    // --- Encoder availability ---
    check_video_encoder(result, &fmt, use_gpu, ctx);
}

fn check_video_copy(
    result: &mut ValidationResult,
    ctx: &ValidationContext,
    fmt: &video::VideoFormat,
) {
    let Some(input_codec) = &ctx.input_video_codec else {
        return;
    };

    let no_resize = ctx
        .settings
        .get("width")
        .and_then(|v| v.as_u64())
        .is_none()
        && ctx
            .settings
            .get("height")
            .and_then(|v| v.as_u64())
            .is_none();
    let no_fps = ctx
        .settings
        .get("fps")
        .and_then(|v| v.as_u64())
        .is_none();
    let no_explicit_codec = ctx
        .settings
        .get("videoCodec")
        .and_then(|v| v.as_str())
        .is_none();
    let no_fixed_res = !fmt.requires_fixed_resolution;

    if no_resize && no_fps && no_explicit_codec && no_fixed_res {
        if fmt.supports_video_codec(input_codec) {
            result.can_copy_video = true;
            result.info(
                "⚡ Stream copy possible — no re-encoding, very fast!".to_string(),
            );
        }
    }

    // Also check audio copy
    if let Some(audio_codec) = &ctx.input_audio_codec {
        if !audio_codec.is_empty() && fmt.supports_audio_codec(audio_codec) {
            result.can_copy_audio = true;
        }
    }
}

fn check_gpu_codec(
    result: &mut ValidationResult,
    ctx: &ValidationContext,
    fmt: &video::VideoFormat,
) {
    let gpu_available = ctx.gpu_available.unwrap_or(false);
    let gpu_vendor = ctx.gpu_vendor.as_deref().unwrap_or("none");
    let gpu_name = ctx.gpu_name.as_deref().unwrap_or("Unknown");

    if !gpu_available || gpu_vendor == "none" {
        return;
    }

    // Check if the output format's preferred codecs have GPU support
    let mut has_any_gpu = false;
    for video_codec in &fmt.video_codecs {
        let gpu_encoder = match (video_codec.as_str(), gpu_vendor) {
            ("h264", "nvidia") => Some("h264_nvenc"),
            ("hevc", "nvidia") => Some("hevc_nvenc"),
            ("av1", "nvidia") => Some("av1_nvenc"),
            ("h264", "intel") => Some("h264_qsv"),
            ("hevc", "intel") => Some("hevc_qsv"),
            ("vp9", "intel") => Some("vp9_qsv"),
            ("av1", "intel") => Some("av1_qsv"),
            ("h264", "amd") => Some("h264_amf"),
            ("hevc", "amd") => Some("hevc_amf"),
            ("av1", "amd") => Some("av1_amf"),
            ("h264", "apple") => Some("h264_videotoolbox"),
            ("hevc", "apple") => Some("hevc_videotoolbox"),
            _ => None,
        };

        if gpu_encoder.is_some() {
            has_any_gpu = true;
            break;
        }
    }

    if !has_any_gpu {
        let codec_names = fmt
            .video_codecs
            .iter()
            .map(|c| c.to_uppercase())
            .collect::<Vec<_>>()
            .join("/");
        result.info(format!(
            "No GPU encoder for {} — {} will use CPU (software encoding)",
            codec_names, gpu_name
        ));
    }
}

fn validate_resolution(
    result: &mut ValidationResult,
    ctx: &ValidationContext,
    fmt: &video::VideoFormat,
) {
    let w = ctx.settings.get("width").and_then(|v| v.as_u64());
    let h = ctx.settings.get("height").and_then(|v| v.as_u64());

    if let (Some(w), Some(h)) = (w, h) {
        if fmt.requires_fixed_resolution {
            if w != 720 || (h != 576 && h != 480) {
                result.error(format!(
                    "{} requires 720×576 (PAL) or 720×480 (NTSC)",
                    fmt.extension
                ));
            }
        } else if let Some((max_w, max_h)) = fmt.max_resolution {
            if w > max_w as u64 || h > max_h as u64 {
                result.error(format!(
                    "Resolution {}×{} exceeds limits for {} (Max: {}×{})",
                    w, h, fmt.extension, max_w, max_h
                ));
            }
        }
    }
}

fn recommend_for_input(
    result: &mut ValidationResult,
    ctx: &ValidationContext,
    fmt: &video::VideoFormat,
) {
    // --- 4K content recommendation ---
    if let (Some(w), Some(h)) = (ctx.input_width, ctx.input_height) {
        let is_4k = w >= 3840 || h >= 2160;
        let is_1440p = w >= 2560 || h >= 1440;

        if is_4k {
            let has_efficient = fmt
                .video_codecs
                .iter()
                .any(|c| c == "hevc" || c == "av1" || c == "vp9");
            if !has_efficient {
                result.info(
                    "4K source: consider MKV or WebM with HEVC/AV1 for 50% smaller files"
                        .to_string(),
                );
            } else {
                result.info(
                    "4K content: HEVC/AV1 will provide excellent compression".to_string(),
                );
            }
        } else if is_1440p {
            let has_efficient = fmt
                .video_codecs
                .iter()
                .any(|c| c == "hevc" || c == "av1");
            if has_efficient {
                result.info("1440p+ content: HEVC/AV1 recommended for better compression".to_string());
            }
        }

        // --- Resolution downscale detected ---
        let target_w = ctx.settings.get("width").and_then(|v| v.as_u64());
        let target_h = ctx.settings.get("height").and_then(|v| v.as_u64());
        if let (Some(tw), Some(th)) = (target_w, target_h) {
            if (tw as u32) < w / 2 || (th as u32) < h / 2 {
                result.info(format!(
                    "Large downscale ({}×{} → {}×{}): lower bitrate is fine",
                    w, h, tw, th
                ));
            }
        }
    }

    // --- HDR detection hint ---
    if let Some(codec) = &ctx.input_video_codec {
        let possibly_hdr = codec == "hevc" || codec == "av1" || codec == "vp9";
        if possibly_hdr {
            let output_supports_hdr = fmt
                .video_codecs
                .iter()
                .any(|c| c == "hevc" || c == "av1" || c == "vp9");
            if !output_supports_hdr {
                result.warn(
                    "Source may contain HDR. This format doesn't support HDR — colors may look washed out"
                        .to_string(),
                );
            }
        }
    }
}

fn check_video_encoder(
    result: &mut ValidationResult,
    fmt: &video::VideoFormat,
    _use_gpu: bool,
    _ctx: &ValidationContext,
) {
    if !codec_registry::is_initialized() {
        return;
    }

    // Check if at least one software encoder is available for this format
    let any_sw_available = fmt.video_codecs.iter().any(|codec| {
        let sw_name = match codec.as_str() {
            "h264" => "libx264",
            "hevc" => "libx265",
            "vp9" => "libvpx-vp9",
            "vp8" => "libvpx",
            "av1" => "libaom-av1",
            "theora" => "libtheora",
            other => other,
        };
        codec_registry::is_encoder_available(sw_name)
    });

    if !any_sw_available {
        let names = fmt
            .video_codecs
            .iter()
            .map(|c| c.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        result.error(format!(
            "No encoder available for codecs: {}. Check FFmpeg installation.",
            names
        ));
    }
}