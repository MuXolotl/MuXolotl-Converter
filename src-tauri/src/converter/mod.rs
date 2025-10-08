pub mod audio;
pub mod video;
pub mod progress;

use serde::{Deserialize, Serialize};
use anyhow::{Context, Result};
use std::process::Stdio;
use std::sync::Arc;
use std::collections::HashMap;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use progress::ProgressParser;
use tauri::Manager;

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
    processes: Arc<Mutex<HashMap<String, Child>>>,
) -> Result<String> {
    #[cfg(debug_assertions)]
    println!("🎬 FFmpeg args: {:?}", args);

    let app_handle = window.app_handle();
    let ffmpeg_path = crate::get_ffmpeg_path(&app_handle)
        .map_err(|e| anyhow::anyhow!("FFmpeg not found: {}", e))?;

    let ffmpeg_str = ffmpeg_path.to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid FFmpeg path encoding"))?;

    let mut cmd = tokio::process::Command::new(ffmpeg_str);
    
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.args(&args)
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    let mut child = cmd.spawn().context("Failed to spawn ffmpeg")?;

    let stdout = child.stdout.take().context("Failed to capture stdout")?;
    let stderr = child.stderr.take().context("Failed to capture stderr")?;

    processes.lock().await.insert(task_id.clone(), child);

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();
    let mut parser = ProgressParser::new(task_id.clone(), duration);

    let _ = window.emit("conversion-started", &task_id);

    let task_id_clone = task_id.clone();
    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            if line.contains("Error") || line.contains("Invalid") {
                #[cfg(debug_assertions)]
                eprintln!("⚠️ FFmpeg stderr ({}): {}", task_id_clone, line);
            }
        }
    });

    let conversion_future = async {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if let Some(progress) = parser.parse_line(&line) {
                let _ = window.emit("conversion-progress", &progress);
            }
        }
        processes.lock().await.remove(&task_id)
    };

    let child_result = match timeout(Duration::from_secs(3600), conversion_future).await {
        Ok(child_opt) => child_opt,
        Err(_) => {
            if let Some(mut child) = processes.lock().await.remove(&task_id) {
                let _ = child.kill().await;
            }
            anyhow::bail!("Conversion timed out after 1 hour");
        }
    };

    let status = match child_result {
        Some(mut child) => child.wait().await?,
        None => {
            return Err(anyhow::anyhow!("Conversion was cancelled"));
        }
    };

    if status.success() {
        let _ = window.emit("conversion-completed", &task_id);
        Ok(task_id)
    } else {
        let error_msg = format!("FFmpeg conversion failed with status: {}", status);
        let _ = window.emit("conversion-error", serde_json::json!({
            "task_id": task_id,
            "error": error_msg,
        }));
        anyhow::bail!(error_msg)
    }
}