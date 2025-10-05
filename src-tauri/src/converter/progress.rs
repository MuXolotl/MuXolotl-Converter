use regex::Regex;
use std::time::Instant;
use super::ConversionProgress;

pub struct ProgressParser {
    total_duration: f64,
    task_id: String,
    last_update: Instant,
    update_interval_ms: u128,
    start_time: Instant,
    last_progress: Option<ConversionProgress>,
}

impl ProgressParser {
    pub fn new(task_id: String, total_duration: f64) -> Self {
        Self {
            total_duration,
            task_id,
            last_update: Instant::now(),
            update_interval_ms: 200,
            start_time: Instant::now(),
            last_progress: None,
        }
    }

    pub fn parse_line(&mut self, line: &str) -> Option<ConversionProgress> {
        let elapsed = self.last_update.elapsed().as_millis();
        if elapsed < self.update_interval_ms && self.last_progress.is_some() {
            return None;
        }

        let mut current_time: Option<f64> = None;
        let mut fps: Option<f64> = None;
        let mut speed: Option<f64> = None;

        if let Some(time_match) = Regex::new(r"out_time_ms=(\d+)").unwrap().captures(line) {
            if let Ok(microseconds) = time_match[1].parse::<i64>() {
                current_time = Some(microseconds as f64 / 1_000_000.0);
            }
        }

        if let Some(fps_match) = Regex::new(r"fps=([\d.]+)").unwrap().captures(line) {
            fps = fps_match[1].parse::<f64>().ok();
        }

        if let Some(speed_match) = Regex::new(r"speed=([\d.]+)x").unwrap().captures(line) {
            speed = speed_match[1].parse::<f64>().ok();
        }

        if let Some(time) = current_time {
            let percent = if self.total_duration > 0.0 {
                ((time / self.total_duration) * 100.0).min(100.0)
            } else {
                0.0
            };

            let eta_seconds = if time > 0.0 && self.total_duration > time {
                if let Some(spd) = speed {
                    let remaining = self.total_duration - time;
                    if spd > 0.0 {
                        Some((remaining / spd) as u64)
                    } else {
                        None
                    }
                } else {
                    let elapsed = self.start_time.elapsed().as_secs_f64();
                    let remaining_duration = self.total_duration - time;
                    let current_speed = time / elapsed;
                    
                    if current_speed > 0.0 {
                        Some((remaining_duration / current_speed) as u64)
                    } else {
                        None
                    }
                }
            } else {
                None
            };

            self.last_update = Instant::now();

            let progress = ConversionProgress {
                task_id: self.task_id.clone(),
                percent,
                fps,
                speed,
                eta_seconds,
                current_time: time,
                total_time: self.total_duration,
            };

            self.last_progress = Some(progress.clone());
            return Some(progress);
        }

        None
    }
}