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

static GPU_CACHE: OnceCell<gpu::GpuInfo> = OnceCell::const_new();
static AUDIO_FORMATS_CACHE: OnceCell<Vec<formats::audio::AudioFormat>> = OnceCell::const_new();
static VIDEO_FORMATS_CACHE: OnceCell<Vec<formats::video::VideoFormat>> = OnceCell::const_new();

pub struct AppState {
    active_processes: Arc<Mutex<HashMap<String, Child>>>,
}

// --- Binary Path Logic ---
pub fn get_binary_path(app_handle: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")] let suffix = "-x86_64-pc-windows-msvc.exe";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))] let suffix = "-x86_64-apple-darwin";
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))] let suffix = "-aarch64-apple-darwin";
    #[cfg(target_os = "linux")] let suffix = "-x86_64-unknown-linux-gnu";

    let full_name = format!("{}{}", name, suffix);

    // 1. Try Resolving via Tauri (best for Prod)
    let rpath = format!("binaries/{}", full_name);
    if let Some(path) = app_handle.path_resolver().resolve_resource(&rpath) {
        if path.exists() { return Ok(path); }
    }

    // 2. Dev/Manual Fallback
    let cwd = std::env::current_dir().map_err(|_| "No CWD")?;
    let candidates = vec![
        cwd.join("src-tauri/binaries").join(&full_name),
        cwd.join("binaries").join(&full_name),
        cwd.join(if cfg!(windows) { format!("{}.exe", name) } else { name.to_string() }), // Prod sidecar
    ];

    for p in candidates {
        if p.exists() { return Ok(p); }
    }

    Err(format!("Binary '{}' not found. Expected '{}'", name, full_name))
}

pub fn get_ffmpeg_path(app: &tauri::AppHandle) -> Result<PathBuf, String> { get_binary_path(app, "ffmpeg") }
pub fn get_ffprobe_path(app: &tauri::AppHandle) -> Result<PathBuf, String> { get_binary_path(app, "ffprobe") }

fn main() {
    tauri::Builder::default()
        .manage(AppState { active_processes: Arc::new(Mutex::new(HashMap::new())) })
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg, detect_gpu, detect_media_type,
            get_audio_formats, get_video_formats, get_recommended_formats,
            validate_conversion, convert_audio, convert_video, extract_audio,
            cancel_conversion, open_folder,
        ])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            let state = app.state::<AppState>();
            let processes = state.active_processes.clone();

            // Graceful Shutdown
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    let procs = processes.clone();
                    std::thread::spawn(move || {
                        tauri::async_runtime::block_on(async {
                            let mut map = procs.lock().await;
                            for (_, mut child) in map.drain() { let _ = child.kill().await; }
                        });
                    });
                }
            });

            // Init Caches
            tauri::async_runtime::spawn(async move {
                GPU_CACHE.get_or_init(|| async { gpu::detect_gpu().await }).await;
                window.emit("gpu-detected", GPU_CACHE.get().unwrap()).unwrap();
            });
            tauri::async_runtime::spawn(async {
                AUDIO_FORMATS_CACHE.get_or_init(|| async { formats::audio::get_all_formats() }).await;
                VIDEO_FORMATS_CACHE.get_or_init(|| async { formats::video::get_all_formats() }).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// --- Commands ---

#[tauri::command]
async fn check_ffmpeg(app: tauri::AppHandle) -> Result<bool, String> {
    let ffmpeg = get_ffmpeg_path(&app)?;
    let ffprobe = get_ffprobe_path(&app)?;
    
    let run_check = |path: PathBuf| {
        std::process::Command::new(path)
            .arg("-version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };

    if run_check(ffmpeg) && run_check(ffprobe) { Ok(true) } else { Err("Binaries failed execution check".into()) }
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
    AUDIO_FORMATS_CACHE.get_or_init(|| async { formats::audio::get_all_formats() }).await.clone()
}

#[tauri::command]
async fn get_video_formats() -> Vec<formats::video::VideoFormat> {
    VIDEO_FORMATS_CACHE.get_or_init(|| async { formats::video::get_all_formats() }).await.clone()
}

#[tauri::command]
async fn get_recommended_formats(
    video_codec: String, audio_codec: String, media_type: String,
    width: Option<u32>, height: Option<u32>,
) -> serde_json::Value {
    use serde_json::json;
    
    fn categorize<F>(check: F, exts: Vec<String>) -> serde_json::Value 
    where F: Fn(&str) -> formats::video::FormatCompatibility {
        let (mut f, mut s, mut set, mut exp, mut prob) = (vec![], vec![], vec![], vec![], vec![]);
        for ext in exts {
            match check(&ext) {
                formats::video::FormatCompatibility::Fast => f.push(ext),
                formats::video::FormatCompatibility::Safe => s.push(ext),
                formats::video::FormatCompatibility::Setup => set.push(ext),
                formats::video::FormatCompatibility::Experimental => exp.push(ext),
                formats::video::FormatCompatibility::Problematic => prob.push(ext),
            }
        }
        json!({ "fast": f, "safe": s, "setup": set, "experimental": exp, "problematic": prob })
    }

    if media_type == "video" {
        let formats = VIDEO_FORMATS_CACHE.get_or_init(|| async { formats::video::get_all_formats() }).await;
        
        let check = |ext: &str| {
            formats.iter().find(|f| f.extension == ext)
                .map(|f| f.get_compatibility_level(&video_codec, &audio_codec, width, height))
                .unwrap_or(formats::video::FormatCompatibility::Safe)
        };
        
        categorize(check, formats.iter().map(|f| f.extension.clone()).collect())
    } else {
        let formats = AUDIO_FORMATS_CACHE.get_or_init(|| async { formats::audio::get_all_formats() }).await;
        let (mut f, mut s, mut set, mut exp, mut prob) = (vec![], vec![], vec![], vec![], vec![]);
        for fmt in formats {
            // FIX: Added .clone() to all fmt.extension usages here
            match fmt.stability {
                formats::Stability::RequiresSetup => set.push(fmt.extension.clone()),
                formats::Stability::Experimental => exp.push(fmt.extension.clone()),
                formats::Stability::Problematic => prob.push(fmt.extension.clone()),
                formats::Stability::Stable => if fmt.can_copy_codec(&audio_codec) { 
                    f.push(fmt.extension.clone()) 
                } else { 
                    s.push(fmt.extension.clone()) 
                }
            }
        }
        json!({ "fast": f, "safe": s, "setup": set, "experimental": exp, "problematic": prob })
    }
}

#[tauri::command]
fn validate_conversion(
    input_format: String, output_format: String, media_type: String, settings: serde_json::Value
) -> validator::ValidationResult {
    validator::validate_conversion(&input_format, &output_format, &media_type, settings)
}

#[tauri::command]
async fn convert_audio(
    state: tauri::State<'_, AppState>, window: tauri::Window,
    input: String, output: String, format: String, settings: serde_json::Value
) -> Result<String, String> {
    let s: types::ConversionSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;
    converter::audio::convert(window, &input, &output, &format, s, state.active_processes.clone()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn convert_video(
    state: tauri::State<'_, AppState>, window: tauri::Window,
    input: String, output: String, format: String, gpu_info: gpu::GpuInfo, settings: serde_json::Value
) -> Result<String, String> {
    let s: types::ConversionSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;
    converter::video::convert(window, &input, &output, &format, gpu_info, s, state.active_processes.clone()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn extract_audio(
    state: tauri::State<'_, AppState>, window: tauri::Window,
    input: String, output: String, format: String, settings: serde_json::Value
) -> Result<String, String> {
    let s: types::ConversionSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;
    converter::audio::extract_from_video(window, &input, &output, &format, s, state.active_processes.clone()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_conversion(state: tauri::State<'_, AppState>, task_id: String) -> Result<(), String> {
    if let Some(mut child) = state.active_processes.lock().await.remove(&task_id) {
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")] std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")] std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")] std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}