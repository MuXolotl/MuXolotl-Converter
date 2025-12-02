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
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::close_splash,
            commands::check_ffmpeg,
            commands::detect_gpu,
            commands::open_folder,
            commands::detect_media_type,
            commands::get_audio_formats,
            commands::get_video_formats,
            commands::get_recommended_formats,
            commands::validate_conversion,
            commands::convert_audio,
            commands::convert_video,
            commands::extract_audio,
            commands::cancel_conversion,
        ])
        .setup(|app| {
            let main_window = app.get_window("main");
            let state = app.state::<AppState>();
            let processes = state.active_processes.clone();

            if let Some(window) = main_window {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let procs = processes.clone();
                        std::thread::spawn(move || {
                            tauri::async_runtime::block_on(async {
                                let mut map = procs.lock().await;
                                for (_, mut child) in map.drain() {
                                    let _ = child.kill().await;
                                }
                            });
                        });
                    }
                });

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