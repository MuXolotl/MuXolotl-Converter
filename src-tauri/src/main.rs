#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod gpu;
mod media;
mod formats;
mod converter;
mod validator;
mod utils;
mod types;

use tauri::Manager;
use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::{Mutex, OnceCell};
use std::collections::HashMap;
use tokio::process::Child;
use tokio::time::{timeout, Duration};

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
    #[cfg(debug_assertions)]
    {
        // DEV MODE: search in src-tauri/binaries/ with suffix
        let full_name = format!("{}{}", binary_name, BINARY_SUFFIX);
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

        Err(format!(
            "{} binary not found in development. Please place '{}' in 'src-tauri/binaries/' directory.",
            binary_name, full_name
        ))
    }

    #[cfg(not(debug_assertions))]
    {
        // PRODUCTION MODE: search next to exe without suffix
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .ok_or_else(|| "Failed to get executable directory".to_string())?;

        #[cfg(target_os = "windows")]
        let binary_file = format!("{}.exe", binary_name);
        #[cfg(not(target_os = "windows"))]
        let binary_file = binary_name.to_string();

        let binary_path = exe_dir.join(&binary_file);

        if binary_path.exists() {
            return Ok(binary_path);
        }

        // Fallback: try bundled resources (if Tauri bundled them)
        let full_name = format!("{}{}", binary_name, BINARY_SUFFIX);
        let resource_path = format!("binaries/{}", full_name);
        
        if let Some(sidecar_path) = app_handle.path_resolver().resolve_resource(&resource_path) {
            if sidecar_path.exists() {
                return Ok(sidecar_path);
            }
        }

        Err(format!(
            "{} binary not found. Expected at: {:?}",
            binary_name, binary_path
        ))
    }
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
            let state = app.state::<AppState>();
            let processes = state.active_processes.clone();

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    let processes = processes.clone();

                    // Block until cleanup is done (with timeout)
                    let cleanup_result = std::thread::scope(|s| {
                        let handle = s.spawn(|| {
                            tauri::async_runtime::block_on(async move {
                                let mut procs = processes.lock().await;
                                
                                #[cfg(debug_assertions)]
                                println!("🛑 Cleaning up {} FFmpeg processes...", procs.len());
                                
                                for (task_id, mut child) in procs.drain() {
                                    #[cfg(debug_assertions)]
                                    println!("🛑 Killing FFmpeg process: {}", task_id);

                                    let kill_result = timeout(
                                        Duration::from_secs(2),
                                        async {
                                            child.kill().await?;
                                            child.wait().await
                                        }
                                    ).await;

                                    match kill_result {
                                        Ok(Ok(_)) => {
                                            #[cfg(debug_assertions)]
                                            println!("✅ Process {} terminated", task_id);
                                        }
                                        Ok(Err(e)) => {
                                            eprintln!("⚠️ Failed to kill process {}: {}", task_id, e);
                                        }
                                        Err(_) => {
                                            eprintln!("⚠️ Timeout killing process {}", task_id);
                                        }
                                    }
                                }
                            });
                        });

                        match handle.join() {
                            Ok(_) => {
                                #[cfg(debug_assertions)]
                                println!("✅ Cleanup completed successfully");
                            }
                            Err(e) => {
                                eprintln!("⚠️ Cleanup thread panicked: {:?}", e);
                            }
                        }
                    });

                    let _ = cleanup_result;
                }
            });

            // GPU detection
            tauri::async_runtime::spawn(async move {
                let gpu_info = GPU_CACHE.get_or_init(|| async { gpu::detect_gpu().await }).await;
                let _ = window.emit("gpu-detected", &gpu_info);
            });

            // Format caches
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
    #[cfg(debug_assertions)]
    println!("🔍 Checking for bundled FFmpeg and FFprobe...");

    let ffmpeg_path = get_ffmpeg_path(&app_handle)?;
    let ffprobe_path = get_ffprobe_path(&app_handle)?;

    let ffmpeg_path_clone = ffmpeg_path.clone();
    let ffmpeg_result = tokio::task::spawn_blocking(move || {
        let path_str = ffmpeg_path_clone.to_str()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid FFmpeg path"))?;
        let mut cmd = utils::create_hidden_command(path_str);
        cmd.arg("-version");
        cmd.output()
    })
    .await
    .map_err(|e| format!("Failed to check FFmpeg: {}", e))?;

    let ffprobe_path_clone = ffprobe_path.clone();
    let ffprobe_result = tokio::task::spawn_blocking(move || {
        let path_str = ffprobe_path_clone.to_str()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid FFprobe path"))?;
        let mut cmd = utils::create_hidden_command(path_str);
        cmd.arg("-version");
        cmd.output()
    })
    .await
    .map_err(|e| format!("Failed to check FFprobe: {}", e))?;

    match (ffmpeg_result, ffprobe_result) {
        (Ok(ff), Ok(fp)) if ff.status.success() && fp.status.success() => {
            #[cfg(debug_assertions)]
            println!("✅ Bundled FFmpeg and FFprobe are working correctly");
            Ok(true)
        }
        (Ok(ff), _) if !ff.status.success() => Err(format!(
            "FFmpeg binary is corrupted. Error: {}",
            String::from_utf8_lossy(&ff.stderr)
        )),
        (_, Ok(fp)) if !fp.status.success() => Err(format!(
            "FFprobe binary is corrupted. Error: {}",
            String::from_utf8_lossy(&fp.stderr)
        )),
        (Err(e), _) => Err(format!("Failed to execute FFmpeg: {}", e)),
        (_, Err(e)) => Err(format!("Failed to execute FFprobe: {}", e)),
        _ => Err("FFmpeg/FFprobe binaries may be corrupted.".to_string()),
    }
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = utils::create_hidden_command("explorer");
            cmd.arg(&path);
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
    let settings: types::ConversionSettings = serde_json::from_value(settings)
        .map_err(|e| format!("Invalid settings: {}", e))?;

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
    let settings: types::ConversionSettings = serde_json::from_value(settings)
        .map_err(|e| format!("Invalid settings: {}", e))?;

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
    let settings: types::ConversionSettings = serde_json::from_value(settings)
        .map_err(|e| format!("Invalid settings: {}", e))?;

    converter::audio::extract_from_video(window, &input, &output, &format, settings, state.active_processes.clone())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_conversion(state: tauri::State<'_, AppState>, task_id: String) -> Result<(), String> {
    #[cfg(debug_assertions)]
    println!("⛔ Cancelling conversion: {}", task_id);

    if let Some(mut child) = state.active_processes.lock().await.remove(&task_id) {
        // Kill with timeout
        let kill_result = timeout(
            Duration::from_secs(5),
            async {
                child.kill().await?;
                child.wait().await
            }
        ).await;

        match kill_result {
            Ok(Ok(_)) => {
                #[cfg(debug_assertions)]
                println!("✅ Successfully killed FFmpeg process for task: {}", task_id);
                Ok(())
            }
            Ok(Err(e)) => {
                eprintln!("⚠️ Failed to kill process {}: {}", task_id, e);
                Err(format!("Failed to kill process: {}", e))
            }
            Err(_) => {
                eprintln!("⚠️ Timeout while killing process {}", task_id);
                Err("Timeout while killing process".to_string())
            }
        }
    } else {
        #[cfg(debug_assertions)]
        println!("⚠️ No active process found for task: {}", task_id);
        Ok(())
    }
}