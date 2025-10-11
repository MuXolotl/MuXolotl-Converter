pub mod audio;
pub mod video;
pub mod progress;
pub mod common;

use serde::{Deserialize, Serialize};
use anyhow::{Context, Result};
use std::process::Stdio;
use std::sync::Arc;
use std::collections::HashMap;
use std::path::Path;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use tauri::Manager;

use progress::ProgressParser;

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

/// Clean up output file if conversion failed
async fn cleanup_failed_output(output_path: &str) {
    let path = Path::new(output_path);
    
    if path.exists() {
        match tokio::fs::remove_file(path).await {
            Ok(_) => {
                #[cfg(debug_assertions)]
                println!("🗑️ Cleaned up failed output file: {:?}", path);
            }
            Err(e) => {
                eprintln!("⚠️ Failed to remove output file {:?}: {}", path, e);
            }
        }
    }
}

pub async fn spawn_ffmpeg(
    window: tauri::Window,
    task_id: String,
    duration: f64,
    args: Vec<String>,
    output_path: String,
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

    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            if line.contains("Error") || line.contains("Invalid") {
                #[cfg(debug_assertions)]
                eprintln!("⚠️ FFmpeg stderr: {}", line);
            }
        }
    });

    // Clone window for progress updates
    let window_for_progress = window.clone();
    let processes_clone = processes.clone();
    let task_id_clone = task_id.clone();
    let output_path_clone = output_path.clone();
    
    let conversion_future = async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if let Some(progress) = parser.parse_line(&line) {
                let _ = window_for_progress.emit("conversion-progress", &progress);
            }
        }
        
        // Atomically remove and return the child process
        processes_clone.lock().await.remove(&task_id_clone)
    };

    let child_result = match timeout(Duration::from_secs(3600), conversion_future).await {
        Ok(child_opt) => child_opt,
        Err(_) => {
            // Timeout: kill process and cleanup
            if let Some(mut child) = processes.lock().await.remove(&task_id) {
                let _ = child.kill().await;
            }
            cleanup_failed_output(&output_path).await;
            anyhow::bail!("Conversion timed out after 1 hour");
        }
    };

    let mut child = match child_result {
        Some(child) => child,
        None => {
            // Process was cancelled - cleanup output file
            cleanup_failed_output(&output_path_clone).await;
            #[cfg(debug_assertions)]
            println!("⚠️ Process {} was cancelled", task_id);
            return Err(anyhow::anyhow!("Conversion was cancelled"));
        }
    };

    let status = child.wait().await?;

    if status.success() {
        #[cfg(debug_assertions)]
        println!("✅ Conversion completed: {}", output_path);
        
        let _ = window.emit("conversion-completed", &task_id);
        Ok(task_id)
    } else {
        // Failure: clean up output file
        cleanup_failed_output(&output_path).await;
        
        let error_msg = format!("FFmpeg conversion failed with status: {}", status);
        let _ = window.emit("conversion-error", serde_json::json!({
            "task_id": task_id,
            "error": error_msg,
        }));
        anyhow::bail!(error_msg)
    }
}