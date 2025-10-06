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

pub fn get_ffmpeg_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let binary_name = "ffmpeg-x86_64-pc-windows-msvc.exe";
    
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let binary_name = "ffmpeg-x86_64-apple-darwin";
    
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let binary_name = "ffmpeg-aarch64-apple-darwin";
    
    #[cfg(target_os = "linux")]
    let binary_name = "ffmpeg-x86_64-unknown-linux-gnu";

    let resource_path = format!("binaries/{}", binary_name);
    let sidecar_path = app_handle
        .path_resolver()
        .resolve_resource(&resource_path)
        .ok_or(format!("FFmpeg binary not found: {}", resource_path))?;

    if sidecar_path.exists() {
        println!("✅ Found bundled FFmpeg at: {:?}", sidecar_path);
        Ok(sidecar_path)
    } else {
        Err(format!("FFmpeg binary not found at {:?}", sidecar_path))
    }
}

pub fn get_ffprobe_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let binary_name = "ffprobe-x86_64-pc-windows-msvc.exe";
    
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let binary_name = "ffprobe-x86_64-apple-darwin";
    
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let binary_name = "ffprobe-aarch64-apple-darwin";
    
    #[cfg(target_os = "linux")]
    let binary_name = "ffprobe-x86_64-unknown-linux-gnu";

    let resource_path = format!("binaries/{}", binary_name);
    let sidecar_path = app_handle
        .path_resolver()
        .resolve_resource(&resource_path)
        .ok_or(format!("FFprobe binary not found: {}", resource_path))?;

    if sidecar_path.exists() {
        println!("✅ Found bundled FFprobe at: {:?}", sidecar_path);
        Ok(sidecar_path)
    } else {
        Err(format!("FFprobe binary not found at {:?}", sidecar_path))
    }
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
            validate_conversion,
            convert_audio,
            convert_video,
            extract_audio,
            cancel_conversion,
            open_folder,
        ])
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            tauri::async_runtime::spawn(async move {
                let gpu_info = GPU_CACHE
                    .get_or_init(|| async { gpu::detect_gpu().await })
                    .await;
                let _ = window.emit("gpu-detected", &gpu_info);
            });

            tauri::async_runtime::spawn(async {
                let _ = AUDIO_FORMATS_CACHE
                    .get_or_init(|| async { formats::audio::get_all_formats() })
                    .await;
                let _ = VIDEO_FORMATS_CACHE
                    .get_or_init(|| async { formats::video::get_all_formats() })
                    .await;
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn check_ffmpeg(app_handle: tauri::AppHandle) -> Result<bool, String> {
    println!("🔍 Checking for FFmpeg...");

    let ffmpeg_path = match get_ffmpeg_path(&app_handle) {
        Ok(path) => path,
        Err(e) => {
            eprintln!("⚠️ Bundled FFmpeg not found: {}", e);
            eprintln!("⚠️ Falling back to system FFmpeg");
            return check_system_ffmpeg().await;
        }
    };

    let ffprobe_path = match get_ffprobe_path(&app_handle) {
        Ok(path) => path,
        Err(e) => {
            eprintln!("⚠️ Bundled FFprobe not found: {}", e);
            eprintln!("⚠️ Falling back to system FFmpeg");
            return check_system_ffmpeg().await;
        }
    };

    let (ffmpeg_result, ffprobe_result) = tokio::join!(
        tokio::task::spawn_blocking(move || {
            let mut cmd = std::process::Command::new(&ffmpeg_path);
            cmd.arg("-version");
            
            #[cfg(target_os = "windows")]
            {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            cmd.output()
        }),
        tokio::task::spawn_blocking(move || {
            let mut cmd = std::process::Command::new(&ffprobe_path);
            cmd.arg("-version");
            
            #[cfg(target_os = "windows")]
            {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            cmd.output()
        })
    );

    match (ffmpeg_result, ffprobe_result) {
        (Ok(Ok(ff)), Ok(Ok(fp))) if ff.status.success() && fp.status.success() => {
            println!("✅ Bundled FFmpeg and FFprobe are working");
            Ok(true)
        },
        _ => {
            eprintln!("❌ Bundled FFmpeg check failed, trying system FFmpeg");
            check_system_ffmpeg().await
        },
    }
}

async fn check_system_ffmpeg() -> Result<bool, String> {
    let (ffmpeg_result, ffprobe_result) = tokio::join!(
        tokio::task::spawn_blocking(|| {
            let mut cmd = std::process::Command::new("ffmpeg");
            cmd.arg("-version");
            
            #[cfg(target_os = "windows")]
            {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            cmd.output()
        }),
        tokio::task::spawn_blocking(|| {
            let mut cmd = std::process::Command::new("ffprobe");
            cmd.arg("-version");
            
            #[cfg(target_os = "windows")]
            {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            cmd.output()
        })
    );

    match (ffmpeg_result, ffprobe_result) {
        (Ok(Ok(ff)), Ok(Ok(fp))) if ff.status.success() && fp.status.success() => {
            println!("✅ System FFmpeg and FFprobe found");
            Ok(true)
        },
        _ => {
            Err("FFmpeg not found. Please install FFmpeg or reinstall the application.".to_string())
        },
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
    GPU_CACHE
        .get_or_init(|| async { gpu::detect_gpu().await })
        .await
        .clone()
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
async fn cancel_conversion(
    state: tauri::State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
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