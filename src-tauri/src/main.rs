#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod gpu;
mod media;
mod formats;
mod converter;
mod validator;

use tauri::Manager;
use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::{Mutex, OnceCell};
use std::collections::HashMap;
use tokio::process::Child;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static GPU_CACHE: OnceCell<gpu::GpuInfo> = OnceCell::const_new();
static AUDIO_FORMATS_CACHE: OnceCell<Vec<formats::audio::AudioFormat>> = OnceCell::const_new();
static VIDEO_FORMATS_CACHE: OnceCell<Vec<formats::video::VideoFormat>> = OnceCell::const_new();

pub struct AppState {
    active_processes: Arc<Mutex<HashMap<String, Child>>>,
}

#[cfg(target_os = "windows")]
const BINARY_SUFFIX: &str = "-x86_64-pc-windows-msvc.exe";

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const BINARY_SUFFIX: &str = "-x86_64-apple-darwin";

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const BINARY_SUFFIX: &str = "-aarch64-apple-darwin";

#[cfg(target_os = "linux")]
const BINARY_SUFFIX: &str = "-x86_64-unknown-linux-gnu";

fn get_binary_path(app_handle: &tauri::AppHandle, binary_name: &str) -> Result<PathBuf, String> {
    let full_name = format!("{}{}", binary_name, BINARY_SUFFIX);
    let resource_path = format!("binaries/{}", full_name);

    // Checking bundled binary
    if let Some(sidecar_path) = app_handle.path_resolver().resolve_resource(&resource_path) {
        if sidecar_path.exists() {
            println!("✅ Found bundled {} at: {:?}", binary_name, sidecar_path);
            return Ok(sidecar_path);
        }
    }

    // Dev mode
    #[cfg(debug_assertions)]
    {
        let dev_path = std::env::current_dir()
            .ok()
            .and_then(|p| {
                [
                    p.join("src-tauri").join("binaries").join(&full_name),
                    p.join("binaries").join(&full_name),
                ]
                .into_iter()
                .find(|p| p.exists())
            });

        if let Some(path) = dev_path {
            println!("✅ Found dev {} at: {:?}", binary_name, path);
            return Ok(path);
        }
    }

    Err(format!(
        "{} binary '{}' not found. Please ensure binaries are in 'src-tauri/binaries/' directory.",
        binary_name, full_name
    ))
}

pub fn get_ffmpeg_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    get_binary_path(app_handle, "ffmpeg")
}

pub fn get_ffprobe_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    get_binary_path(app_handle, "ffprobe")
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            active_processes: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            detect_gpu,
            detect_media_type,
            get_audio_formats,
            get_video_formats,
            get_recommended_formats,
            validate_conversion,
            convert_audio,
            convert_video,
            extract_audio,
            cancel_conversion,
            open_folder,
        ])
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            // Asynchronous GPU initialization
            tauri::async_runtime::spawn(async move {
                let gpu_info = GPU_CACHE.get_or_init(|| async { gpu::detect_gpu().await }).await;
                let _ = window.emit("gpu-detected", &gpu_info);
            });

            // Preloading formats
            tauri::async_runtime::spawn(async {
                let _ = AUDIO_FORMATS_CACHE.get_or_init(|| async { formats::audio::get_all_formats() }).await;
                let _ = VIDEO_FORMATS_CACHE.get_or_init(|| async { formats::video::get_all_formats() }).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn check_ffmpeg(app_handle: tauri::AppHandle) -> Result<bool, String> {
    println!("🔍 Checking for bundled FFmpeg and FFprobe...");

    let ffmpeg_path = get_ffmpeg_path(&app_handle).map_err(|e| {
        format!(
            "FFmpeg not found: {}\n\n📦 Please download FFmpeg binaries and place them in 'src-tauri/binaries/' directory.",
            e
        )
    })?;

    let ffprobe_path = get_ffprobe_path(&app_handle).map_err(|e| {
        format!(
            "FFprobe not found: {}\n\n📦 Please download FFprobe binaries and place them in 'src-tauri/binaries/' directory.",
            e
        )
    })?;

    let ffmpeg_result = tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&ffmpeg_path);
        cmd.arg("-version");

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
    })
    .await;

    let ffprobe_result = tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&ffprobe_path);
        cmd.arg("-version");

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
    })
    .await;

    match (ffmpeg_result, ffprobe_result) {
        (Ok(Ok(ff)), Ok(Ok(fp))) if ff.status.success() && fp.status.success() => {
            println!("✅ Bundled FFmpeg and FFprobe are working correctly");
            Ok(true)
        }
        (Ok(Ok(ff)), _) if !ff.status.success() => Err(format!(
            "FFmpeg binary is corrupted or incompatible.\n\nError: {}\n\n📦 Please re-download FFmpeg binaries.",
            String::from_utf8_lossy(&ff.stderr)
        )),
        (_, Ok(Ok(fp))) if !fp.status.success() => Err(format!(
            "FFprobe binary is corrupted or incompatible.\n\nError: {}\n\n📦 Please re-download FFprobe binaries.",
            String::from_utf8_lossy(&fp.stderr)
        )),
        _ => Err(
            "Failed to execute FFmpeg/FFprobe binaries. They may be corrupted.\n\n📦 Please re-download the binaries."
                .to_string(),
        ),
    }
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = std::process::Command::new("explorer");
            cmd.arg(&path);
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = cmd.spawn();
        }

        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(&path).spawn();
        }

        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open").arg(&path).spawn();
        }
    });

    Ok(())
}

#[tauri::command]
async fn detect_gpu() -> gpu::GpuInfo {
    GPU_CACHE.get_or_init(|| async { gpu::detect_gpu().await }).await.clone()
}

#[tauri::command]
async fn detect_media_type(app_handle: tauri::AppHandle, path: String) -> Result<media::MediaInfo, String> {
    media::detect_media_type(&app_handle, &path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_audio_formats() -> Vec<formats::audio::AudioFormat> {
    AUDIO_FORMATS_CACHE
        .get_or_init(|| async { formats::audio::get_all_formats() })
        .await
        .clone()
}

#[tauri::command]
async fn get_video_formats() -> Vec<formats::video::VideoFormat> {
    VIDEO_FORMATS_CACHE
        .get_or_init(|| async { formats::video::get_all_formats() })
        .await
        .clone()
}

#[tauri::command]
async fn get_recommended_formats(
    video_codec: String,
    audio_codec: String,
    media_type: String,
    width: Option<u32>,
    height: Option<u32>,
) -> serde_json::Value {
    use serde_json::json;

    if media_type == "video" {
        let all_formats = VIDEO_FORMATS_CACHE
            .get_or_init(|| async { formats::video::get_all_formats() })
            .await;

        let (mut fast, mut safe, mut setup, mut experimental, mut problematic) =
            (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());

        for format in all_formats.iter() {
            let compat = format.get_compatibility_level(&video_codec, &audio_codec, width, height);

            let list = match compat {
                formats::video::FormatCompatibility::Fast => &mut fast,
                formats::video::FormatCompatibility::Safe => &mut safe,
                formats::video::FormatCompatibility::Setup => &mut setup,
                formats::video::FormatCompatibility::Experimental => &mut experimental,
                formats::video::FormatCompatibility::Problematic => &mut problematic,
            };

            list.push(format.extension.clone());
        }

        json!({ "fast": fast, "safe": safe, "setup": setup, "experimental": experimental, "problematic": problematic })
    } else {
        let all_formats = AUDIO_FORMATS_CACHE
            .get_or_init(|| async { formats::audio::get_all_formats() })
            .await;

        let (mut fast, mut safe, mut setup, mut experimental, mut problematic) =
            (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());

        for format in all_formats.iter() {
            let can_copy = format.can_copy_codec(&audio_codec);

            let list = match format.stability {
                formats::Stability::Stable => {
                    if can_copy {
                        &mut fast
                    } else {
                        &mut safe
                    }
                }
                formats::Stability::RequiresSetup => &mut setup,
                formats::Stability::Experimental => &mut experimental,
                formats::Stability::Problematic => &mut problematic,
            };

            list.push(format.extension.clone());
        }

        json!({ "fast": fast, "safe": safe, "setup": setup, "experimental": experimental, "problematic": problematic })
    }
}

#[tauri::command]
fn validate_conversion(
    input_format: String,
    output_format: String,
    media_type: String,
    settings: serde_json::Value,
) -> validator::ValidationResult {
    validator::validate_conversion(&input_format, &output_format, &media_type, settings)
}

#[tauri::command]
async fn convert_audio(
    state: tauri::State<'_, AppState>,
    window: tauri::Window,
    input: String,
    output: String,
    format: String,
    settings: serde_json::Value,
) -> Result<String, String> {
    converter::audio::convert(window, &input, &output, &format, settings, state.active_processes.clone())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn convert_video(
    state: tauri::State<'_, AppState>,
    window: tauri::Window,
    input: String,
    output: String,
    format: String,
    gpu_info: gpu::GpuInfo,
    settings: serde_json::Value,
) -> Result<String, String> {
    converter::video::convert(window, &input, &output, &format, gpu_info, settings, state.active_processes.clone())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn extract_audio(
    state: tauri::State<'_, AppState>,
    window: tauri::Window,
    input: String,
    output: String,
    format: String,
    settings: serde_json::Value,
) -> Result<String, String> {
    converter::audio::extract_from_video(window, &input, &output, &format, settings, state.active_processes.clone())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_conversion(state: tauri::State<'_, AppState>, task_id: String) -> Result<(), String> {
    println!("⛔ Cancelling conversion: {}", task_id);

    if let Some(mut child) = state.active_processes.lock().await.remove(&task_id) {
        match child.kill().await {
            Ok(_) => println!("✅ Killed FFmpeg process for task: {}", task_id),
            Err(e) => eprintln!("⚠️ Failed to kill process {}: {}", task_id, e),
        }
    } else {
        println!("⚠️ No active process found for task: {}", task_id);
    }

    Ok(())
}