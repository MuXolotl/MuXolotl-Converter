use crate::error::{AppError, AppResult, ErrorCode};
use std::path::PathBuf;
use tauri::AppHandle;

/// Platform-specific binary suffix
fn get_binary_suffix() -> &'static str {
    #[cfg(target_os = "windows")]
    return "-x86_64-pc-windows-msvc.exe";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "-x86_64-apple-darwin";

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "-aarch64-apple-darwin";

    #[cfg(target_os = "linux")]
    return "-x86_64-unknown-linux-gnu";
}

/// Resolves the path to a bundled binary
pub fn get_binary_path(app_handle: &AppHandle, name: &str) -> AppResult<PathBuf> {
    let suffix = get_binary_suffix();
    let full_name = format!("{}{}", name, suffix);

    // 1. Try Tauri resource resolver (production)
    let resource_path = format!("binaries/{}", full_name);
    if let Some(path) = app_handle.path_resolver().resolve_resource(&resource_path) {
        if path.exists() {
            return Ok(path);
        }
    }

    // 2. Development fallback paths
    if let Ok(cwd) = std::env::current_dir() {
        let candidates = [
            cwd.join("src-tauri/binaries").join(&full_name),
            cwd.join("binaries").join(&full_name),
        ];

        for path in candidates {
            if path.exists() {
                return Ok(path);
            }
        }
    }

    Err(AppError::new(
        ErrorCode::BinaryNotFound,
        format!("Binary '{}' not found. Expected: {}", name, full_name),
    ))
}

pub fn get_ffmpeg_path(app: &AppHandle) -> AppResult<PathBuf> {
    get_binary_path(app, "ffmpeg")
}

pub fn get_ffprobe_path(app: &AppHandle) -> AppResult<PathBuf> {
    get_binary_path(app, "ffprobe")
}

/// Verifies that FFmpeg binaries are executable
pub fn check_binaries(app: &AppHandle) -> AppResult<bool> {
    let ffmpeg = get_ffmpeg_path(app)?;
    let ffprobe = get_ffprobe_path(app)?;

    let check = |path: PathBuf| -> bool {
        std::process::Command::new(path)
            .arg("-version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };

    if check(ffmpeg) && check(ffprobe) {
        Ok(true)
    } else {
        Err(AppError::new(
            ErrorCode::BinaryNotFound,
            "FFmpeg binaries failed execution check",
        ))
    }
}