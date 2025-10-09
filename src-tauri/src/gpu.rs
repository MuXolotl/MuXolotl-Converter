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

const TIMEOUT_SECS: u64 = 10;

fn check_encoder(encoder: &str) -> bool {
    create_hidden_command("ffmpeg")
        .args(&["-hide_banner", "-encoders"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).contains(encoder))
        .unwrap_or(false)
}

async fn run_with_timeout(program: &str, args: &[&str]) -> Option<std::process::Output> {
    let program = program.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    
    let future = tokio::task::spawn_blocking(move || {
        create_hidden_command(&program).args(&args).output()
    });
    
    timeout(Duration::from_secs(TIMEOUT_SECS), future)
        .await
        .ok()?
        .ok()?
        .ok()
}

async fn get_gpu_name(keywords: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = run_with_timeout("wmic", &["path", "win32_VideoController", "get", "name"]).await?;
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| keywords.iter().any(|kw| line.to_lowercase().contains(kw)))
            .map(|s| s.trim().to_string())
    }

    #[cfg(target_os = "linux")]
    {
        let output = run_with_timeout("lspci", &[]).await?;
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
        let output = run_with_timeout("system_profiler", &["SPDisplaysDataType"]).await?;
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| line.contains("Chipset Model:"))
            .and_then(|line| line.split(':').nth(1).map(|s| s.trim().to_string()))
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    None
}

pub async fn detect_gpu() -> GpuInfo {
    // NVIDIA via nvidia-smi
    if let Some(output) = run_with_timeout("nvidia-smi", &["--query-gpu=name", "--format=csv,noheader"]).await {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() && check_encoder("h264_nvenc") {
                #[cfg(debug_assertions)]
                println!("✅ Detected NVIDIA GPU: {}", name);
                
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

    // AMD
    if let Some(name) = get_gpu_name(&["amd", "radeon"]).await {
        if check_encoder("h264_amf") {
            #[cfg(debug_assertions)]
            println!("✅ Detected AMD GPU: {}", name);
            
            return GpuInfo {
                vendor: GpuVendor::Amd,
                name,
                encoder_h264: Some("h264_amf".to_string()),
                encoder_h265: Some("hevc_amf".to_string()),
                decoder: Some("h264_amf".to_string()),
                available: true,
            };
        } else {
            #[cfg(debug_assertions)]
            println!("⚠️ Found AMD GPU '{}' but h264_amf encoder not available in FFmpeg", name);
        }
    }

    // Intel
    if let Some(name) = get_gpu_name(&["intel", "hd graphics", "uhd graphics", "iris"]).await {
        if check_encoder("h264_qsv") {
            #[cfg(debug_assertions)]
            println!("✅ Detected Intel GPU: {}", name);
            
            return GpuInfo {
                vendor: GpuVendor::Intel,
                name,
                encoder_h264: Some("h264_qsv".to_string()),
                encoder_h265: Some("hevc_qsv".to_string()),
                decoder: Some("h264_qsv".to_string()),
                available: true,
            };
        } else {
            #[cfg(debug_assertions)]
            println!("⚠️ Found Intel GPU '{}' but h264_qsv encoder not available in FFmpeg", name);
        }
    }

    // Apple VideoToolbox (macOS only)
    #[cfg(target_os = "macos")]
    {
        if check_encoder("h264_videotoolbox") {
            let name = get_gpu_name(&["apple"]).await
                .unwrap_or_else(|| "Apple GPU".to_string());
            
            #[cfg(debug_assertions)]
            println!("✅ Detected Apple GPU: {}", name);
            
            return GpuInfo {
                vendor: GpuVendor::Apple,
                name,
                encoder_h264: Some("h264_videotoolbox".to_string()),
                encoder_h265: Some("hevc_videotoolbox".to_string()),
                decoder: Some("h264".to_string()),
                available: true,
            };
        }
    }

    #[cfg(debug_assertions)]
    println!("⚠️ No GPU with encoding support detected, using CPU");

    GpuInfo::default()
}