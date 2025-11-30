use crate::binary;
use crate::converter;
use crate::error::AppResult;
use crate::formats::{audio, video};
use crate::gpu::{self, GpuInfo};
use crate::media::{self, MediaInfo};
use crate::types::ConversionSettings;
use crate::utils;
use crate::validator::{self, ValidationResult};
use crate::AppState;
use serde_json::{json, Value};
use tauri::{Manager, State};
use tokio::sync::OnceCell;

// Caches
static GPU_CACHE: OnceCell<GpuInfo> = OnceCell::const_new();
static AUDIO_FORMATS_CACHE: OnceCell<Vec<audio::AudioFormat>> = OnceCell::const_new();
static VIDEO_FORMATS_CACHE: OnceCell<Vec<video::VideoFormat>> = OnceCell::const_new();

// ============================================================================
// Window Commands
// ============================================================================

#[tauri::command]
pub async fn window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_is_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

// ============================================================================
// System Commands
// ============================================================================

#[tauri::command]
pub async fn check_ffmpeg(app: tauri::AppHandle) -> Result<bool, String> {
    binary::check_binaries(&app).map_err(|e| e.into())
}

#[tauri::command]
pub async fn detect_gpu() -> GpuInfo {
    GPU_CACHE
        .get_or_init(|| async { gpu::detect_gpu().await })
        .await
        .clone()
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    utils::open_path(&path)
}

// ============================================================================
// Media Commands
// ============================================================================

#[tauri::command]
pub async fn detect_media_type(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<MediaInfo, String> {
    media::detect_media_type(&app_handle, &path)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Format Commands
// ============================================================================

#[tauri::command]
pub async fn get_audio_formats() -> Vec<audio::AudioFormat> {
    AUDIO_FORMATS_CACHE
        .get_or_init(|| async { audio::get_all_formats() })
        .await
        .clone()
}

#[tauri::command]
pub async fn get_video_formats() -> Vec<video::VideoFormat> {
    VIDEO_FORMATS_CACHE
        .get_or_init(|| async { video::get_all_formats() })
        .await
        .clone()
}

#[tauri::command]
pub async fn get_recommended_formats(
    video_codec: String,
    audio_codec: String,
    media_type: String,
    width: Option<u32>,
    height: Option<u32>,
) -> Value {
    if media_type == "video" {
        let formats = VIDEO_FORMATS_CACHE
            .get_or_init(|| async { video::get_all_formats() })
            .await;
        categorize_video_formats(formats, &video_codec, &audio_codec, width, height)
    } else {
        let formats = AUDIO_FORMATS_CACHE
            .get_or_init(|| async { audio::get_all_formats() })
            .await;
        categorize_audio_formats(formats, &audio_codec)
    }
}

fn categorize_video_formats(
    formats: &[video::VideoFormat],
    video_codec: &str,
    audio_codec: &str,
    width: Option<u32>,
    height: Option<u32>,
) -> Value {
    let mut result = CategoryResult::default();

    for fmt in formats {
        let compat = fmt.get_compatibility_level(video_codec, audio_codec, width, height);
        let ext = fmt.extension.clone();

        match compat {
            video::FormatCompatibility::Fast => result.fast.push(ext),
            video::FormatCompatibility::Safe => result.safe.push(ext),
            video::FormatCompatibility::Setup => result.setup.push(ext),
            video::FormatCompatibility::Experimental => result.experimental.push(ext),
            video::FormatCompatibility::Problematic => result.problematic.push(ext),
        }
    }

    json!(result)
}

fn categorize_audio_formats(formats: &[audio::AudioFormat], audio_codec: &str) -> Value {
    use crate::formats::Stability;
    let mut result = CategoryResult::default();

    for fmt in formats {
        let ext = fmt.extension.clone();

        match fmt.stability {
            Stability::Stable => {
                if fmt.can_copy_codec(audio_codec) {
                    result.fast.push(ext);
                } else {
                    result.safe.push(ext);
                }
            }
            Stability::RequiresSetup => result.setup.push(ext),
            Stability::Experimental => result.experimental.push(ext),
            Stability::Problematic => result.problematic.push(ext),
        }
    }

    json!(result)
}

#[derive(Default, serde::Serialize)]
struct CategoryResult {
    fast: Vec<String>,
    safe: Vec<String>,
    setup: Vec<String>,
    experimental: Vec<String>,
    problematic: Vec<String>,
}

// ============================================================================
// Validation Commands
// ============================================================================

#[tauri::command]
pub fn validate_conversion(
    input_format: String,
    output_format: String,
    media_type: String,
    settings: Value,
) -> ValidationResult {
    validator::validate_conversion(&input_format, &output_format, &media_type, settings)
}

// ============================================================================
// Conversion Commands
// ============================================================================

#[tauri::command]
pub async fn convert_audio(
    state: State<'_, AppState>,
    window: tauri::Window,
    input: String,
    output: String,
    format: String,
    settings: Value,
) -> Result<String, String> {
    let settings: ConversionSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;

    converter::audio::convert(
        window,
        &input,
        &output,
        &format,
        settings,
        state.active_processes.clone(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn convert_video(
    state: State<'_, AppState>,
    window: tauri::Window,
    input: String,
    output: String,
    format: String,
    gpu_info: GpuInfo,
    settings: Value,
) -> Result<String, String> {
    let settings: ConversionSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;

    converter::video::convert(
        window,
        &input,
        &output,
        &format,
        gpu_info,
        settings,
        state.active_processes.clone(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extract_audio(
    state: State<'_, AppState>,
    window: tauri::Window,
    input: String,
    output: String,
    format: String,
    settings: Value,
) -> Result<String, String> {
    let settings: ConversionSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;

    converter::audio::extract_from_video(
        window,
        &input,
        &output,
        &format,
        settings,
        state.active_processes.clone(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_conversion(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    if let Some(mut child) = state.active_processes.lock().await.remove(&task_id) {
        let _ = child.kill().await;
    }
    Ok(())
}

// ============================================================================
// Cache Initialization
// ============================================================================

pub async fn init_caches(window: &tauri::Window) {
    let gpu = GPU_CACHE
        .get_or_init(|| async { gpu::detect_gpu().await })
        .await;
    let _ = window.emit("gpu-detected", gpu);

    tokio::spawn(async {
        AUDIO_FORMATS_CACHE
            .get_or_init(|| async { audio::get_all_formats() })
            .await;
        VIDEO_FORMATS_CACHE
            .get_or_init(|| async { video::get_all_formats() })
            .await;
    });
}