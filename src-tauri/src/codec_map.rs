//! Single source of truth for codec-to-encoder mappings.
//!
//! Centralizes all codec mapping logic that was previously scattered
//! across gpu.rs, validator.rs, formats/video.rs, and converter/video.rs:
//!
//! - Codec + GPU vendor → GPU encoder name
//! - Codec type → software encoder name
//! - GPU encoder name → software fallback
//! - GPU encoder detection

/// Get the GPU encoder name for a given codec type and GPU vendor.
///
/// Returns `None` if no GPU encoder exists for this combination.
pub fn gpu_encoder_for_codec(codec: &str, vendor: &str) -> Option<&'static str> {
    match (codec, vendor) {
        // NVIDIA NVENC
        ("h264", "nvidia") => Some("h264_nvenc"),
        ("hevc", "nvidia") => Some("hevc_nvenc"),
        ("av1", "nvidia") => Some("av1_nvenc"),

        // Intel Quick Sync Video
        ("h264", "intel") => Some("h264_qsv"),
        ("hevc", "intel") => Some("hevc_qsv"),
        ("vp9", "intel") => Some("vp9_qsv"),
        ("av1", "intel") => Some("av1_qsv"),

        // AMD AMF
        ("h264", "amd") => Some("h264_amf"),
        ("hevc", "amd") => Some("hevc_amf"),
        ("av1", "amd") => Some("av1_amf"),

        // Apple VideoToolbox
        ("h264", "apple") => Some("h264_videotoolbox"),
        ("hevc", "apple") => Some("hevc_videotoolbox"),

        _ => None,
    }
}

/// Get the software encoder name for a given codec type.
///
/// Maps abstract codec names (like "h264", "hevc") to the actual
/// FFmpeg software encoder names (like "libx264", "libx265").
///
/// Returns `None` for codecs that are already encoder names
/// (e.g., "mpeg2video", "dvvideo") — callers should use
/// `unwrap_or(codec)` to handle these cases.
pub fn software_encoder_for_codec(codec: &str) -> Option<&'static str> {
    match codec {
        "h264" => Some("libx264"),
        "hevc" => Some("libx265"),
        "vp9" => Some("libvpx-vp9"),
        "vp8" => Some("libvpx"),
        "av1" => Some("libaom-av1"),
        "theora" => Some("libtheora"),
        _ => None,
    }
}

/// Check if an encoder name is a GPU hardware encoder.
pub fn is_gpu_encoder(name: &str) -> bool {
    name.contains("nvenc")
        || name.contains("qsv")
        || name.contains("amf")
        || name.contains("videotoolbox")
}

/// Get the software fallback for a GPU encoder.
///
/// Given a GPU encoder name (e.g., "h264_nvenc"), returns the
/// corresponding software encoder (e.g., "libx264").
///
/// Returns `None` if the encoder is not a GPU encoder or
/// no software fallback is known.
pub fn software_fallback_for_encoder(encoder: &str) -> Option<&'static str> {
    if !is_gpu_encoder(encoder) {
        return None;
    }

    match encoder {
        e if e.contains("h264") => Some("libx264"),
        e if e.contains("hevc") => Some("libx265"),
        e if e.contains("av1") => Some("libaom-av1"),
        e if e.contains("vp9") => Some("libvpx-vp9"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpu_encoder_for_codec() {
        assert_eq!(gpu_encoder_for_codec("h264", "nvidia"), Some("h264_nvenc"));
        assert_eq!(gpu_encoder_for_codec("hevc", "intel"), Some("hevc_qsv"));
        assert_eq!(gpu_encoder_for_codec("av1", "amd"), Some("av1_amf"));
        assert_eq!(gpu_encoder_for_codec("h264", "apple"), Some("h264_videotoolbox"));
        assert_eq!(gpu_encoder_for_codec("theora", "nvidia"), None);
        assert_eq!(gpu_encoder_for_codec("h264", "unknown"), None);
    }

    #[test]
    fn test_software_encoder_for_codec() {
        assert_eq!(software_encoder_for_codec("h264"), Some("libx264"));
        assert_eq!(software_encoder_for_codec("hevc"), Some("libx265"));
        assert_eq!(software_encoder_for_codec("vp9"), Some("libvpx-vp9"));
        assert_eq!(software_encoder_for_codec("vp8"), Some("libvpx"));
        assert_eq!(software_encoder_for_codec("av1"), Some("libaom-av1"));
        assert_eq!(software_encoder_for_codec("theora"), Some("libtheora"));
        assert_eq!(software_encoder_for_codec("mpeg2video"), None);
        assert_eq!(software_encoder_for_codec("dvvideo"), None);
    }

    #[test]
    fn test_is_gpu_encoder() {
        assert!(is_gpu_encoder("h264_nvenc"));
        assert!(is_gpu_encoder("hevc_qsv"));
        assert!(is_gpu_encoder("av1_amf"));
        assert!(is_gpu_encoder("h264_videotoolbox"));
        assert!(!is_gpu_encoder("libx264"));
        assert!(!is_gpu_encoder("mpeg2video"));
        assert!(!is_gpu_encoder("copy"));
    }

    #[test]
    fn test_software_fallback_for_encoder() {
        assert_eq!(software_fallback_for_encoder("h264_nvenc"), Some("libx264"));
        assert_eq!(software_fallback_for_encoder("hevc_qsv"), Some("libx265"));
        assert_eq!(software_fallback_for_encoder("av1_amf"), Some("libaom-av1"));
        assert_eq!(software_fallback_for_encoder("vp9_qsv"), Some("libvpx-vp9"));
        assert_eq!(software_fallback_for_encoder("libx264"), None);
        assert_eq!(software_fallback_for_encoder("copy"), None);
    }
}