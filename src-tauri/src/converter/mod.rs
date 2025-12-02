pub mod audio;
pub mod builder;
pub mod progress;
pub mod video;

use crate::binary::get_ffmpeg_path;
use crate::utils::create_async_hidden_command;
use anyhow::{Context, Result};
use progress::ProgressParser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

const CONVERSION_TIMEOUT: Duration = Duration::from_secs(3600);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionProgress {
    pub task_id: String,
    pub percent: f64,
    pub fps: Option<f64>,
    pub speed: Option<f64>,
    pub eta_seconds: Option<u64>,
    pub current_time: f64,
    pub total_time: f64,
}

pub async fn spawn_ffmpeg(
    window: tauri::Window,
    task_id: String,
    duration: f64,
    args: Vec<String>,
    output_path: String,
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    let ffmpeg_path = get_ffmpeg_path(&window.app_handle())
        .map_err(|e| anyhow::anyhow!("FFmpeg not found: {}", e))?;

    let mut cmd = create_async_hidden_command(ffmpeg_path.to_str().unwrap());
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().context("Failed to spawn FFmpeg")?;

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let stderr = child.stderr.take().expect("Failed to capture stderr");

    processes.lock().await.insert(task_id.clone(), child);
    let _ = window.emit("conversion-started", &task_id);

    let task_id_err = task_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.contains("Error") || line.contains("Invalid") || line.contains("failed") {
                eprintln!("[FFmpeg Error] {}: {}", task_id_err, line);
            }
        }
    });

    let window_progress = window.clone();
    let task_id_progress = task_id.clone();
    let processes_monitor = processes.clone();

    let monitor_future = async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut parser = ProgressParser::new(task_id_progress.clone(), duration);

        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(progress) = parser.parse_line(&line) {
                let _ = window_progress.emit("conversion-progress", &progress);
            }
        }

        processes_monitor.lock().await.remove(&task_id_progress)
    };

    match timeout(CONVERSION_TIMEOUT, monitor_future).await {
        Ok(Some(mut child)) => {
            let status = child.wait().await?;

            if status.success() {
                let _ = window.emit("conversion-completed", &task_id);
                Ok(task_id)
            } else {
                cleanup_failed(&output_path).await;
                let error = format!("FFmpeg exited with code: {}", status);
                emit_error(&window, &task_id, &error);
                anyhow::bail!(error)
            }
        }
        Ok(None) => {
            cleanup_failed(&output_path).await;
            let _ = window.emit("conversion-cancelled", &task_id);
            Ok(task_id)
        }
        Err(_) => {
            if let Some(mut child) = processes.lock().await.remove(&task_id) {
                let _ = child.kill().await;
            }
            cleanup_failed(&output_path).await;
            let error = "Conversion timed out (limit: 1 hour)";
            emit_error(&window, &task_id, error);
            anyhow::bail!(error)
        }
    }
}

async fn cleanup_failed(path: &str) {
    let path = Path::new(path);
    if path.exists() {
        let _ = tokio::fs::remove_file(path).await;
    }
}

fn emit_error(window: &tauri::Window, task_id: &str, error: &str) {
    let _ = window.emit(
        "conversion-error",
        serde_json::json!({
            "task_id": task_id,
            "error": error
        }),
    );
}