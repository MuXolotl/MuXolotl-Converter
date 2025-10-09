use serde::{Deserialize, Serialize};
use crate::utils::create_hidden_command;
use tokio::time::{timeout, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
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

const COMMAND_TIMEOUT_SECS: u64 = 5;

fn check_ffmpeg_encoder(encoder: &str) -> bool {
    create_hidden_command("ffmpeg")
        .args(&["-hide_banner", "-encoders"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).contains(encoder))
        .unwrap_or(false)
}

async fn run_command_with_timeout(program: &str, args: &[&str]) -> Option<std::process::Output> {
    let program = program.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    
    let future = tokio::task::spawn_blocking(move || {
        create_hidden_command(&program).args(&args).output()
    });
    
    match timeout(Duration::from_secs(COMMAND_TIMEOUT_SECS), future).await {
        Ok(Ok(Ok(output))) => Some(output),
        Ok(Ok(Err(e))) => {
            #[cfg(debug_assertions)]
            eprintln!("Command execution error: {}", e);
            None
        }
        Ok(Err(e)) => {
            #[cfg(debug_assertions)]
            eprintln!("Task join error: {}", e);
            None
        }
        Err(_) => {
            #[cfg(debug_assertions)]
            eprintln!("Command timed out after {} seconds", COMMAND_TIMEOUT_SECS);
            None
        }
    }
}

async fn detect_gpu_by_keywords(keywords: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = run_command_with_timeout(
            "wmic",
            &["path", "win32_VideoController", "get", "name"]
        ).await?;
        
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| keywords.iter().any(|kw| line.to_lowercase().contains(kw)))
            .map(|s| s.trim().to_string())
    }

    #[cfg(target_os = "linux")]
    {
        let output = run_command_with_timeout("lspci", &[]).await?;
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| {
                keywords.iter().any(|kw| line.to_lowercase().contains(kw)) &&
                line.to_lowercase().contains("vga")
            })
            .and_then(|line| line.split(':').nth(2).map(|s| s.trim().to_string()))
    }

    #[cfg(target_os = "macos")]
    {
        let output = run_command_with_timeout("system_profiler", &["SPDisplaysDataType"]).await?;
        let info = String::from_utf8_lossy(&output.stdout);
        
        if keywords.iter().any(|kw| info.to_lowercase().contains(kw)) {
            info.lines()
                .find(|line| line.contains("Chipset Model:"))
                .and_then(|line| line.split(':').nth(1).map(|s| s.trim().to_string()))
        } else {
            None
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    None
}

struct GpuDetector {
    vendor: GpuVendor,
    keywords: &'static [&'static str],
    h264_encoder: &'static str,
    h265_encoder: &'static str,
    decoder: &'static str,
}

const GPU_DETECTORS: &[GpuDetector] = &[
    GpuDetector {
        vendor: GpuVendor::Nvidia,
        keywords: &["nvidia"],
        h264_encoder: "h264_nvenc",
        h265_encoder: "hevc_nvenc",
        decoder: "h264_cuvid",
    },
    GpuDetector {
        vendor: GpuVendor::Intel,
        keywords: &["intel", "hd graphics", "uhd graphics", "iris"],
        h264_encoder: "h264_qsv",
        h265_encoder: "hevc_qsv",
        decoder: "h264_qsv",
    },
    GpuDetector {
        vendor: GpuVendor::Amd,
        keywords: &["amd", "radeon"],
        h264_encoder: "h264_amf",
        h265_encoder: "hevc_amf",
        decoder: "h264_amf",
    },
];

pub async fn detect_gpu() -> GpuInfo {
    // NVIDIA via nvidia-smi
    if let Some(output) = run_command_with_timeout("nvidia-smi", &["--query-gpu=name", "--format=csv,noheader"]).await {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() && (check_ffmpeg_encoder("h264_nvenc") || check_ffmpeg_encoder("nvenc_h264")) {
                return GpuInfo {
                    vendor: GpuVendor::Nvidia,
                    name,
                    encoder_h264: Some("h264_nvenc".to_string()),
                    encoder_h265: Some("hevc_nvenc".to_string()),
                    decoder: Some("h264_cuvid".to_string()),
                    available: true,
                };
            }
        }
    }

    // Fallback: keyword-based detection
    if let Some(gpu_name) = detect_gpu_by_keywords(&["nvidia"]).await {
        if check_ffmpeg_encoder("h264_nvenc") || check_ffmpeg_encoder("nvenc_h264") {
            return GpuInfo {
                vendor: GpuVendor::Nvidia,
                name: gpu_name,
                encoder_h264: Some("h264_nvenc".to_string()),
                encoder_h265: Some("hevc_nvenc".to_string()),
                decoder: Some("h264_cuvid".to_string()),
                available: true,
            };
        }
    }

    // Other vendors
    for detector in GPU_DETECTORS {
        if let Some(gpu_name) = detect_gpu_by_keywords(detector.keywords).await {
            if check_ffmpeg_encoder(detector.h264_encoder) {
                return GpuInfo {
                    vendor: detector.vendor.clone(),
                    name: gpu_name,
                    encoder_h264: Some(detector.h264_encoder.to_string()),
                    encoder_h265: Some(detector.h265_encoder.to_string()),
                    decoder: Some(detector.decoder.to_string()),
                    available: true,
                };
            }
        }
    }

    // Apple Silicon (macOS)
    #[cfg(target_os = "macos")]
    {
        if check_ffmpeg_encoder("h264_videotoolbox") {
            let gpu_name = run_command_with_timeout("system_profiler", &["SPDisplaysDataType"])
                .await
                .and_then(|output| {
                    String::from_utf8_lossy(&output.stdout)
                        .lines()
                        .find(|line| line.contains("Chipset Model:"))
                        .and_then(|line| line.split(':').nth(1))
                        .map(|s| s.trim().to_string())
                })
                .unwrap_or_else(|| "Apple GPU".to_string());

            return GpuInfo {
                vendor: GpuVendor::Apple,
                name: gpu_name,
                encoder_h264: Some("h264_videotoolbox".to_string()),
                encoder_h265: Some("hevc_videotoolbox".to_string()),
                decoder: Some("h264".to_string()),
                available: true,
            };
        }
    }

    GpuInfo::default()
}