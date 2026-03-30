use crate::error::{AppError, AppResult, ErrorCode};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

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

fn get_plain_binary_name(name: &str) -> &'static str {
    #[cfg(target_os = "windows")]
    match name {
        "ffmpeg" => return "ffmpeg.exe",
        "ffprobe" => return "ffprobe.exe",
        _ => return "",
    }

    #[cfg(not(target_os = "windows"))]
    match name {
        "ffmpeg" => return "ffmpeg",
        "ffprobe" => return "ffprobe",
        _ => return "",
    }
}

pub fn get_binary_path(app_handle: &AppHandle, name: &str) -> AppResult<PathBuf> {
    let suffix = get_binary_suffix();
    let full_name = format!("{}{}", name, suffix);
    let plain_name = get_plain_binary_name(name);

    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. Tauri resource directory (production bundles: macOS .app, Linux .deb/AppImage)
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join("binaries").join(&full_name));
        candidates.push(resource_dir.join(&full_name));
        if !plain_name.is_empty() {
            candidates.push(resource_dir.join("binaries").join(plain_name));
            candidates.push(resource_dir.join(plain_name));
        }
    }

    // 2. Next to the executable itself (Windows NSIS/MSI install)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(&full_name));
            candidates.push(exe_dir.join("binaries").join(&full_name));
            if !plain_name.is_empty() {
                candidates.push(exe_dir.join(plain_name));
                candidates.push(exe_dir.join("binaries").join(plain_name));
            }
        }
    }

    // 3. Current working directory (dev mode)
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("binaries").join(&full_name));
        candidates.push(cwd.join("src-tauri").join("binaries").join(&full_name));
        candidates.push(
            cwd.join("..")
                .join("src-tauri")
                .join("binaries")
                .join(&full_name),
        );
        if !plain_name.is_empty() {
            candidates.push(cwd.join("binaries").join(plain_name));
        }
    }

    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    let searched = candidates
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join("; ");

    Err(AppError::new(
        ErrorCode::BinaryNotFound,
        format!(
            "Binary '{}' not found. Searched: {}",
            name, searched
        ),
    )
    .with_details(format!(
        "Expected filename: '{}' or '{}'. Searched paths: {}",
        full_name, plain_name, searched
    )))
}

pub fn get_ffmpeg_path(app: &AppHandle) -> AppResult<PathBuf> {
    get_binary_path(app, "ffmpeg")
}

pub fn get_ffprobe_path(app: &AppHandle) -> AppResult<PathBuf> {
    get_binary_path(app, "ffprobe")
}

pub fn check_binaries(app: &AppHandle) -> AppResult<bool> {
    let ffmpeg = get_ffmpeg_path(app)?;
    let ffprobe = get_ffprobe_path(app)?;

    let check = |path: PathBuf| -> bool {
        crate::utils::create_hidden_command(path.to_str().unwrap_or("ffmpeg"))
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
            "FFmpeg binaries found but failed to execute.",
        ))
    }
}