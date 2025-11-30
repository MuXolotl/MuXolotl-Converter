use crate::utils::{create_async_hidden_command, create_hidden_command};
use serde::{Deserialize, Serialize};
use tokio::time::{timeout, Duration};

const GPU_DETECT_TIMEOUT: Duration = Duration::from_secs(10);
const ENCODER_CHECK_TIMEOUT: Duration = Duration::from_secs(5);

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GpuVendor {
    Nvidia,
    Intel,
    Amd,
    Apple,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub vendor: GpuVendor,
    pub name: String,
    pub encoder_h264: Option<String>,
    pub encoder_h265: Option<String>,
    pub decoder: Option<String>,
    pub available: bool,
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
        }
    }
}

impl GpuInfo {
    fn nvidia(name: String) -> Self {
        Self {
            vendor: GpuVendor::Nvidia,
            name,
            encoder_h264: Some("h264_nvenc".to_string()),
            encoder_h265: Some("hevc_nvenc".to_string()),
            decoder: Some("h264_cuvid".to_string()),
            available: true,
        }
    }

    fn intel(name: String) -> Self {
        Self {
            vendor: GpuVendor::Intel,
            name,
            encoder_h264: Some("h264_qsv".to_string()),
            encoder_h265: Some("hevc_qsv".to_string()),
            decoder: Some("h264_qsv".to_string()),
            available: true,
        }
    }

    fn amd(name: String) -> Self {
        Self {
            vendor: GpuVendor::Amd,
            name,
            encoder_h264: Some("h264_amf".to_string()),
            encoder_h265: Some("hevc_amf".to_string()),
            decoder: Some("h264_amf".to_string()),
            available: true,
        }
    }

    #[cfg(target_os = "macos")]
    fn apple(name: String) -> Self {
        Self {
            vendor: GpuVendor::Apple,
            name,
            encoder_h264: Some("h264_videotoolbox".to_string()),
            encoder_h265: Some("hevc_videotoolbox".to_string()),
            decoder: Some("h264".to_string()),
            available: true,
        }
    }

    /// Returns hwaccel args for FFmpeg
    pub fn hwaccel_args(&self) -> Vec<(&'static str, &'static str)> {
        if !self.available {
            return vec![];
        }

        match self.vendor {
            GpuVendor::Nvidia => vec![
                ("-hwaccel", "cuda"),
                ("-hwaccel_output_format", "cuda"),
            ],
            GpuVendor::Intel => vec![
                ("-hwaccel", "qsv"),
                ("-hwaccel_output_format", "qsv"),
            ],
            GpuVendor::Amd => {
                #[cfg(target_os = "windows")]
                return vec![("-hwaccel", "d3d11va")];
                #[cfg(not(target_os = "windows"))]
                return vec![("-hwaccel", "auto")];
            }
            GpuVendor::Apple => vec![("-hwaccel", "videotoolbox")],
            GpuVendor::None => vec![],
        }
    }
}

// ============================================================================
// Detection
// ============================================================================

pub async fn detect_gpu() -> GpuInfo {
    // Try NVIDIA first (most common for encoding)
    if let Some(gpu) = detect_nvidia().await {
        return gpu;
    }

    // Try AMD
    if let Some(gpu) = detect_amd().await {
        return gpu;
    }

    // Try Intel
    if let Some(gpu) = detect_intel().await {
        return gpu;
    }

    // Try Apple (macOS only)
    #[cfg(target_os = "macos")]
    if let Some(gpu) = detect_apple().await {
        return gpu;
    }

    #[cfg(debug_assertions)]
    eprintln!("⚠️ No GPU with encoding support detected, using CPU");

    GpuInfo::default()
}

async fn detect_nvidia() -> Option<GpuInfo> {
    let output = run_command_timeout("nvidia-smi", &["--query-gpu=name", "--format=csv,noheader"]).await?;
    
    if !output.status.success() {
        return None;
    }

    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        return None;
    }

    if !check_encoder("h264_nvenc").await {
        #[cfg(debug_assertions)]
        eprintln!("⚠️ NVIDIA GPU '{}' found but h264_nvenc not available", name);
        return None;
    }

    #[cfg(debug_assertions)]
    println!("✅ Detected NVIDIA GPU: {}", name);

    Some(GpuInfo::nvidia(name))
}

async fn detect_amd() -> Option<GpuInfo> {
    let name = get_gpu_name(&["amd", "radeon"]).await?;

    if !check_encoder("h264_amf").await {
        #[cfg(debug_assertions)]
        eprintln!("⚠️ AMD GPU '{}' found but h264_amf not available", name);
        return None;
    }

    #[cfg(debug_assertions)]
    println!("✅ Detected AMD GPU: {}", name);

    Some(GpuInfo::amd(name))
}

async fn detect_intel() -> Option<GpuInfo> {
    let name = get_gpu_name(&["intel", "hd graphics", "uhd graphics", "iris"]).await?;

    if !check_encoder("h264_qsv").await {
        #[cfg(debug_assertions)]
        eprintln!("⚠️ Intel GPU '{}' found but h264_qsv not available", name);
        return None;
    }

    #[cfg(debug_assertions)]
    println!("✅ Detected Intel GPU: {}", name);

    Some(GpuInfo::intel(name))
}

#[cfg(target_os = "macos")]
async fn detect_apple() -> Option<GpuInfo> {
    if !check_encoder("h264_videotoolbox").await {
        return None;
    }

    let name = get_gpu_name(&["apple"])
        .await
        .unwrap_or_else(|| "Apple GPU".to_string());

    #[cfg(debug_assertions)]
    println!("✅ Detected Apple GPU: {}", name);

    Some(GpuInfo::apple(name))
}

// ============================================================================
// Helpers
// ============================================================================

async fn check_encoder(encoder: &str) -> bool {
    let encoder = encoder.to_string();

    let future = tokio::task::spawn_blocking(move || {
        create_hidden_command("ffmpeg")
            .args(["-hide_banner", "-encoders"])
            .output()
    });

    match timeout(ENCODER_CHECK_TIMEOUT, future).await {
        Ok(Ok(Ok(output))) if output.status.success() => {
            String::from_utf8_lossy(&output.stdout).contains(&encoder)
        }
        _ => false,
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
        let output = run_command_timeout("wmic", &["path", "win32_VideoController", "get", "name"]).await?;
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