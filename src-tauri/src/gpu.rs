use serde::{Deserialize, Serialize};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

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

fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    cmd
}

fn check_ffmpeg_encoder(encoder: &str) -> bool {
    create_hidden_command("ffmpeg")
        .args(&["-hide_banner", "-encoders"])
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                let encoders = String::from_utf8_lossy(&output.stdout);
                Some(encoders.contains(encoder))
            } else {
                None
            }
        })
        .unwrap_or(false)
}

fn detect_gpu_by_keywords(keywords: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = create_hidden_command("wmic")
            .args(&["path", "win32_VideoController", "get", "name"])
            .output()
            .ok()?;
        
        let devices = String::from_utf8_lossy(&output.stdout);
        for line in devices.lines() {
            if keywords.iter().any(|kw| line.to_lowercase().contains(kw)) {
                return Some(line.trim().to_string());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = create_hidden_command("lspci").output().ok()?;
        let devices = String::from_utf8_lossy(&output.stdout);
        for line in devices.lines() {
            if keywords.iter().any(|kw| line.to_lowercase().contains(kw)) && 
               line.to_lowercase().contains("vga") {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() > 2 {
                    return Some(parts[2].trim().to_string());
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = create_hidden_command("system_profiler")
            .arg("SPDisplaysDataType")
            .output()
            .ok()?;
        
        let info = String::from_utf8_lossy(&output.stdout);
        if keywords.iter().any(|kw| info.to_lowercase().contains(kw)) {
            for line in info.lines() {
                if line.contains("Chipset Model:") {
                    let parts: Vec<&str> = line.split(':').collect();
                    if parts.len() > 1 {
                        return Some(parts[1].trim().to_string());
                    }
                }
            }
        }
    }

    None
}

pub async fn detect_gpu() -> GpuInfo {
    // NVIDIA
    if let Some(gpu_name) = create_hidden_command("nvidia-smi")
        .args(&["--query-gpu=name", "--format=csv,noheader"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .and_then(|out| {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if name.is_empty() { None } else { Some(name) }
        })
        .or_else(|| detect_gpu_by_keywords(&["nvidia"]))
    {
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

    // Intel
    if let Some(gpu_name) = detect_gpu_by_keywords(&["intel", "hd graphics", "uhd graphics", "iris"]) {
        if check_ffmpeg_encoder("h264_qsv") {
            return GpuInfo {
                vendor: GpuVendor::Intel,
                name: gpu_name,
                encoder_h264: Some("h264_qsv".to_string()),
                encoder_h265: Some("hevc_qsv".to_string()),
                decoder: Some("h264_qsv".to_string()),
                available: true,
            };
        }
    }

    // AMD
    if let Some(gpu_name) = detect_gpu_by_keywords(&["amd", "radeon"]) {
        if check_ffmpeg_encoder("h264_amf") {
            return GpuInfo {
                vendor: GpuVendor::Amd,
                name: gpu_name,
                encoder_h264: Some("h264_amf".to_string()),
                encoder_h265: Some("hevc_amf".to_string()),
                decoder: Some("h264_amf".to_string()),
                available: true,
            };
        }
    }

    // Apple
    #[cfg(target_os = "macos")]
    {
        if check_ffmpeg_encoder("h264_videotoolbox") {
            let gpu_name = create_hidden_command("system_profiler")
                .arg("SPDisplaysDataType")
                .output()
                .ok()
                .and_then(|output| {
                    let info = String::from_utf8_lossy(&output.stdout);
                    for line in info.lines() {
                        if line.contains("Chipset Model:") {
                            let parts: Vec<&str> = line.split(':').collect();
                            if parts.len() > 1 {
                                return Some(parts[1].trim().to_string());
                            }
                        }
                    }
                    None
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