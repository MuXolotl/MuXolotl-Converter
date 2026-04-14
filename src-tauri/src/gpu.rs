use crate::codec_map;
use crate::utils::create_hidden_command;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::time::{timeout, Duration};

const GPU_DETECT_TIMEOUT: Duration = Duration::from_secs(10);
const ENCODER_TEST_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GpuVendor {
    Nvidia,
    Intel,
    Amd,
    Apple,
    None,
}

impl GpuVendor {
    /// Get the string identifier used by codec_map for encoder lookups.
    fn as_str(&self) -> Option<&'static str> {
        match self {
            GpuVendor::Nvidia => Some("nvidia"),
            GpuVendor::Intel => Some("intel"),
            GpuVendor::Amd => Some("amd"),
            GpuVendor::Apple => Some("apple"),
            GpuVendor::None => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub vendor: GpuVendor,
    pub name: String,
    pub encoder_h264: Option<String>,
    pub encoder_h265: Option<String>,
    pub decoder: Option<String>,
    pub available: bool,
    /// Map of encoder name → actually works on this hardware
    pub encoders: HashMap<String, bool>,
}

impl Default for GpuInfo {
    fn default() -> Self {
        Self {
            vendor: GpuVendor::None,
            name: "CPU Only".to_string(),
            encoder_h264: None,
            encoder_h265: None,
            decoder: None,
            available: false,
            encoders: HashMap::new(),
        }
    }
}

impl GpuInfo {
    /// Check if a specific encoder is tested and available
    pub fn is_encoder_available(&self, encoder: &str) -> bool {
        self.encoders.get(encoder).copied().unwrap_or(false)
    }

    /// Get the best GPU encoder for a given codec type (h264, hevc, vp9, av1).
    /// Returns None if no GPU encoder is available for this codec.
    pub fn get_encoder_for(&self, codec: &str) -> Option<String> {
        let vendor_str = self.vendor.as_str()?;
        codec_map::gpu_encoder_for_codec(codec, vendor_str)
            .filter(|enc| self.is_encoder_available(enc))
            .map(|s| s.to_string())
    }
}

/// Candidate GPU encoders per vendor — only real, existing encoders
fn get_candidates(vendor: GpuVendor) -> Vec<&'static str> {
    match vendor {
        GpuVendor::Nvidia => vec![
            "h264_nvenc",  // Kepler+ (GTX 600+)
            "hevc_nvenc",  // Maxwell 2nd gen+ (GTX 950+)
            "av1_nvenc",   // Ada Lovelace+ (RTX 40xx+)
        ],
        GpuVendor::Intel => vec![
            "h264_qsv",   // Sandy Bridge+
            "hevc_qsv",   // Skylake+
            "vp9_qsv",    // Ice Lake+
            "av1_qsv",    // Arc / Alchemist+
        ],
        GpuVendor::Amd => vec![
            "h264_amf",   // GCN 1.0+ (HD 7000+)
            "hevc_amf",   // Polaris+ (RX 400+)
            "av1_amf",    // RDNA3+ (RX 7000+)
        ],
        GpuVendor::Apple => vec![
            "h264_videotoolbox",  // All Macs
            "hevc_videotoolbox",  // A10+, all M-series
        ],
        GpuVendor::None => vec![],
    }
}

// ============ Main detection entry point ============

/// GPU detection priority: NVIDIA > AMD > Intel > Apple.
/// NVIDIA first because NVENC is the most widely available and reliable.
/// AMD before Intel because AMF is more common on desktop GPUs.
/// Apple last because it only applies to macOS.
pub async fn detect_gpu(ffmpeg_path: Option<String>) -> GpuInfo {
    // Try each vendor in priority order
    if let Some(gpu) = try_detect(GpuVendor::Nvidia, ffmpeg_path.clone()).await {
        return gpu;
    }
    if let Some(gpu) = try_detect(GpuVendor::Amd, ffmpeg_path.clone()).await {
        return gpu;
    }
    if let Some(gpu) = try_detect(GpuVendor::Intel, ffmpeg_path.clone()).await {
        return gpu;
    }
    #[cfg(target_os = "macos")]
    if let Some(gpu) = try_detect(GpuVendor::Apple, ffmpeg_path.clone()).await {
        return gpu;
    }

    GpuInfo::default()
}

async fn try_detect(vendor: GpuVendor, ffmpeg_path: Option<String>) -> Option<GpuInfo> {
    // Step 1: Check if GPU hardware is present
    let name = match vendor {
        GpuVendor::Nvidia => detect_nvidia_name().await?,
        GpuVendor::Intel => get_gpu_name(&["intel", "hd graphics", "uhd graphics", "iris"]).await?,
        GpuVendor::Amd => get_gpu_name(&["amd", "radeon"]).await?,
        #[cfg(target_os = "macos")]
        GpuVendor::Apple => get_gpu_name(&["apple"]).await.unwrap_or_else(|| "Apple GPU".to_string()),
        #[cfg(not(target_os = "macos"))]
        GpuVendor::Apple => return None,
        GpuVendor::None => return None,
    };

    // Step 2: Test each candidate encoder on real hardware
    let candidates = get_candidates(vendor);
    if candidates.is_empty() {
        return None;
    }

    let encoders = test_encoders_parallel(&candidates, ffmpeg_path).await;

    // At least one encoder must work
    let any_available = encoders.values().any(|&v| v);
    if !any_available {
        return None;
    }

    // Step 3: Build GpuInfo with tested results
    let encoder_h264 = find_first_available(&encoders, &["h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox"]);
    let encoder_h265 = find_first_available(&encoders, &["hevc_nvenc", "hevc_qsv", "hevc_amf", "hevc_videotoolbox"]);

    let decoder = match vendor {
        GpuVendor::Nvidia => Some("h264_cuvid".to_string()),
        GpuVendor::Intel => Some("h264_qsv".to_string()),
        GpuVendor::Amd => Some("h264_amf".to_string()),
        GpuVendor::Apple => Some("h264".to_string()),
        GpuVendor::None => None,
    };

    // Log results
    for (enc, ok) in &encoders {
        if *ok {
            tracing::info!(encoder = %enc, vendor = ?vendor, "GPU encoder available");
        } else {
            tracing::debug!(encoder = %enc, vendor = ?vendor, "GPU encoder unavailable");
        }
    }

    Some(GpuInfo {
        vendor,
        name,
        encoder_h264,
        encoder_h265,
        decoder,
        available: true,
        encoders,
    })
}

fn find_first_available(encoders: &HashMap<String, bool>, candidates: &[&str]) -> Option<String> {
    candidates
        .iter()
        .find(|&&name| encoders.get(name).copied().unwrap_or(false))
        .map(|s| s.to_string())
}

// ============ Encoder testing ============

/// Test multiple encoders in parallel for speed
async fn test_encoders_parallel(candidates: &[&str], ffmpeg_path: Option<String>) -> HashMap<String, bool> {
    let mut handles = Vec::new();

    for &enc in candidates {
        let encoder_name = enc.to_string();
        let path_clone = ffmpeg_path.clone();
        handles.push(tokio::spawn(async move {
            let available = test_encoder_real(&encoder_name, path_clone.as_deref()).await;
            (encoder_name, available)
        }));
    }

    let mut results = HashMap::new();
    for handle in handles {
        if let Ok((name, available)) = handle.await {
            results.insert(name, available);
        }
    }

    results
}

/// Actually test if an encoder works by trying a minimal encode.
/// This catches: wrong GPU generation, missing drivers, FFmpeg not compiled with support.
async fn test_encoder_real(encoder: &str, ffmpeg_path: Option<&str>) -> bool {
    let encoder_owned = encoder.to_string();
    let cmd_str = ffmpeg_path.unwrap_or("ffmpeg").to_string();
    let null_output = if cfg!(windows) { "NUL" } else { "/dev/null" };

    let future = tokio::task::spawn_blocking(move || {
        create_hidden_command(&cmd_str)
            .args([
                "-hide_banner",
                "-loglevel", "error",
                "-f", "lavfi",
                "-i", "nullsrc=s=256x256:d=0.1:r=1",
                "-frames:v", "1",
                "-an",
                "-c:v", &encoder_owned,
                "-f", "null",
                null_output,
            ])
            .output()
    });

    match timeout(ENCODER_TEST_TIMEOUT, future).await {
        Ok(Ok(Ok(output))) => output.status.success(),
        _ => false,
    }
}

// ============ GPU name detection ============

async fn detect_nvidia_name() -> Option<String> {
    let output = run_command_timeout(
        "nvidia-smi",
        &["--query-gpu=name", "--format=csv,noheader"],
    )
    .await?;

    if !output.status.success() {
        return None;
    }

    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

async fn run_command_timeout(program: &str, args: &[&str]) -> Option<std::process::Output> {
    let program = program.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    let future = tokio::task::spawn_blocking(move || {
        create_hidden_command(&program).args(&args).output()
    });

    timeout(GPU_DETECT_TIMEOUT, future).await.ok()?.ok()?.ok()
}

async fn get_gpu_name(keywords: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output =
            run_command_timeout("wmic", &["path", "win32_VideoController", "get", "name"]).await?;
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| keywords.iter().any(|kw| line.to_lowercase().contains(kw)))
            .map(|s| s.trim().to_string())
    }

    #[cfg(target_os = "linux")]
    {
        let output = run_command_timeout("lspci", &[]).await?;
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| {
                let lower = line.to_lowercase();
                keywords.iter().any(|kw| lower.contains(kw)) && lower.contains("vga")
            })
            .and_then(|line| line.split(':').nth(2).map(|s| s.trim().to_string()))
    }

    #[cfg(target_os = "macos")]
    {
        let output = run_command_timeout("system_profiler", &["SPDisplaysDataType"]).await?;
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| line.contains("Chipset Model:"))
            .and_then(|line| line.split(':').nth(1).map(|s| s.trim().to_string()))
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    None
}