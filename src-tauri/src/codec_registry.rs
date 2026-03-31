use crate::utils::create_hidden_command;
use std::collections::HashSet;
use std::sync::OnceLock;

static AVAILABLE_ENCODERS: OnceLock<HashSet<String>> = OnceLock::new();
static AVAILABLE_DECODERS: OnceLock<HashSet<String>> = OnceLock::new();

/// Initialize the codec registry by querying FFmpeg for available encoders and decoders.
/// Should be called once at app startup after FFmpeg binary is located.
pub fn init(ffmpeg_path: &str) {
    let _ = AVAILABLE_ENCODERS.get_or_init(|| parse_ffmpeg_list(ffmpeg_path, "-encoders"));
    let _ = AVAILABLE_DECODERS.get_or_init(|| parse_ffmpeg_list(ffmpeg_path, "-decoders"));

    let enc_count = AVAILABLE_ENCODERS.get().map_or(0, |s| s.len());
    let dec_count = AVAILABLE_DECODERS.get().map_or(0, |s| s.len());
    eprintln!(
        "[CodecRegistry] Loaded {} encoders, {} decoders",
        enc_count, dec_count
    );
}

/// Check if a specific encoder is available in this FFmpeg build
pub fn is_encoder_available(name: &str) -> bool {
    AVAILABLE_ENCODERS
        .get()
        .map_or(true, |s| s.contains(name)) // Default true if registry not initialized
}

/// Check if a specific decoder is available in this FFmpeg build
#[allow(dead_code)]
pub fn is_decoder_available(name: &str) -> bool {
    AVAILABLE_DECODERS
        .get()
        .map_or(true, |s| s.contains(name))
}

/// Check if the registry has been initialized
pub fn is_initialized() -> bool {
    AVAILABLE_ENCODERS.get().is_some()
}

/// Get the software encoder name for a given codec type.
/// Returns the encoder FFmpeg would use (e.g., "h264" → "libx264").
pub fn get_software_encoder(codec_type: &str) -> Option<&'static str> {
    match codec_type {
        "h264" => Some("libx264"),
        "hevc" => Some("libx265"),
        "vp9" => Some("libvpx-vp9"),
        "vp8" => Some("libvpx"),
        "av1" => Some("libaom-av1"),
        "theora" => Some("libtheora"),
        "mpeg2video" => Some("mpeg2video"),
        "mpeg4" => Some("mpeg4"),
        _ => None,
    }
}

/// For an audio codec name, get a fallback if the primary isn't available.
pub fn get_audio_fallback(codec: &str) -> Option<&'static str> {
    match codec {
        "libmp3lame" if !is_encoder_available("libmp3lame") => {
            // Some FFmpeg builds have native mp3 encoder
            if is_encoder_available("mp3") {
                Some("mp3")
            } else {
                None
            }
        }
        "libvorbis" if !is_encoder_available("libvorbis") => {
            if is_encoder_available("vorbis") {
                Some("vorbis")
            } else {
                None
            }
        }
        _ => None,
    }
}

fn parse_ffmpeg_list(ffmpeg_path: &str, flag: &str) -> HashSet<String> {
    let output = create_hidden_command(ffmpeg_path)
        .args(["-hide_banner", flag])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_codec_list(&stdout)
        }
        Ok(out) => {
            eprintln!(
                "[CodecRegistry] FFmpeg {} failed: {}",
                flag,
                String::from_utf8_lossy(&out.stderr)
            );
            HashSet::new()
        }
        Err(e) => {
            eprintln!("[CodecRegistry] Failed to run FFmpeg {}: {}", flag, e);
            HashSet::new()
        }
    }
}

/// Parse the output of `ffmpeg -encoders` or `ffmpeg -decoders`.
///
/// Format after the separator line:
/// ```text
///  V..... libx264          libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
///  A..... aac              AAC (Advanced Audio Coding)
/// ```
fn parse_codec_list(output: &str) -> HashSet<String> {
    let mut codecs = HashSet::new();
    let mut past_separator = false;

    for line in output.lines() {
        if line.contains("------") {
            past_separator = true;
            continue;
        }
        if !past_separator {
            continue;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // First token = flags (e.g., "V....."), second token = codec name
        let mut tokens = trimmed.split_whitespace();
        if let (Some(_flags), Some(name)) = (tokens.next(), tokens.next()) {
            if !name.is_empty() && name != "=" {
                codecs.insert(name.to_string());
            }
        }
    }

    codecs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_encoder_list() {
        let sample = r#"Encoders:
 V..... = Video
 A..... = Audio
 ------
 V..... libx264          libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V..... libx265          libx265 H.265 / HEVC (codec hevc)
 V..... h264_nvenc       NVIDIA NVENC H.264 encoder (codec h264)
 A..... aac              AAC (Advanced Audio Coding) (codec aac)
 A..... libmp3lame       libmp3lame MP3 (codec mp3)
 A..... libopus          libopus Opus (codec opus)
"#;
        let result = parse_codec_list(sample);
        assert!(result.contains("libx264"));
        assert!(result.contains("libx265"));
        assert!(result.contains("h264_nvenc"));
        assert!(result.contains("aac"));
        assert!(result.contains("libmp3lame"));
        assert!(result.contains("libopus"));
        assert_eq!(result.len(), 6);
    }
}