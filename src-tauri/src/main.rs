#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod binary;
mod commands;
mod converter;
mod error;
mod formats;
mod gpu;
mod media;
mod types;
mod utils;
mod validator;

use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::process::Child;
use tokio::sync::Mutex;

pub use binary::{get_ffmpeg_path, get_ffprobe_path};

pub struct AppState {
    pub active_processes: Arc<Mutex<HashMap<String, Child>>>,
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            active_processes: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![
            // ===== Window =====
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::close_splash,
            // ===== System =====
            commands::check_ffmpeg,
            commands::detect_gpu,
            commands::open_folder,
            // ===== Media =====
            commands::detect_media_type,
            // ===== Formats =====
            commands::get_audio_formats,
            commands::get_video_formats,
            commands::get_recommended_formats,
            // ===== Validation =====
            commands::validate_conversion,
            // ===== Conversion =====
            commands::convert_audio,
            commands::convert_video,
            commands::extract_audio,
            commands::cancel_conversion,
        ])
        .setup(|app| {
            if let Some(window) = app.get_window("main") {
                let state = app.state::<AppState>();
                let processes = state.active_processes.clone();

                // Graceful shutdown logic
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let procs = processes.clone();
                        // Spawn thread to kill children immediately on exit
                        std::thread::spawn(move || {
                            tauri::async_runtime::block_on(async {
                                let mut map = procs.lock().await;
                                for (id, mut child) in map.drain() {
                                    println!("Killing process: {}", id);
                                    let _ = child.kill().await;
                                }
                            });
                        });
                    }
                });

                // Init caches in background
                let window_clone = window.clone();
                tauri::async_runtime::spawn(async move {
                    commands::init_caches(&window_clone).await;
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}