use super::ConversionProgress;
use lazy_static::lazy_static;
use regex::Regex;
use std::time::Instant;

lazy_static! {
    static ref TIME_REGEX: Regex = Regex::new(r"out_time_ms=(\d+)").unwrap();
    static ref FPS_REGEX: Regex = Regex::new(r"fps=([\d.]+)").unwrap();
    static ref SPEED_REGEX: Regex = Regex::new(r"speed=([\d.]+)x").unwrap();
}

const UPDATE_INTERVAL_MS: u128 = 500;

pub struct ProgressParser {
    task_id: String,
    total_duration: f64,
    start_time: Instant,
    last_update: Instant,
    last_progress: Option<ConversionProgress>,
}

impl ProgressParser {
    pub fn new(task_id: String, total_duration: f64) -> Self {
        Self {
            task_id,
            total_duration,
            start_time: Instant::now(),
            last_update: Instant::now(),
            last_progress: None,
        }
    }

    pub fn parse_line(&mut self, line: &str) -> Option<ConversionProgress> {
        // Handle final progress
        if line.contains("progress=end") {
            return self.last_progress.as_ref().map(|p| ConversionProgress {
                percent: 100.0,
                eta_seconds: Some(0),
                current_time: self.total_duration,
                ..p.clone()
            });
        }

        // Throttle updates
        if self.last_update.elapsed().as_millis() < UPDATE_INTERVAL_MS && self.last_progress.is_some()
        {
            return None;
        }

        // Parse values
        let current_time = TIME_REGEX
            .captures(line)
            .and_then(|c| c[1].parse::<i64>().ok())
            .map(|us| us as f64 / 1_000_000.0)?;

        let fps = FPS_REGEX
            .captures(line)
            .and_then(|c| c[1].parse().ok());

        let speed = SPEED_REGEX
            .captures(line)
            .and_then(|c| c[1].parse().ok());

        // Calculate progress
        let percent = if self.total_duration > 0.0 {
            ((current_time / self.total_duration) * 100.0).min(100.0)
        } else {
            0.0
        };

        let eta_seconds = self.calculate_eta(current_time, speed);

        self.last_update = Instant::now();

        let progress = ConversionProgress {
            task_id: self.task_id.clone(),
            percent,
            fps,
            speed,
            eta_seconds,
            current_time,
            total_time: self.total_duration,
        };

        self.last_progress = Some(progress.clone());
        Some(progress)
    }

    fn calculate_eta(&self, current_time: f64, speed: Option<f64>) -> Option<u64> {
        if current_time <= 0.0 || self.total_duration <= current_time {
            return Some(0);
        }

        let remaining = self.total_duration - current_time;

        // Use speed if available
        if let Some(s) = speed {
            if s > 0.0 {
                return Some((remaining / s) as u64);
            }
        }

        // Fallback: calculate from elapsed time
        let elapsed = self.start_time.elapsed().as_secs_f64();
        if elapsed > 0.0 && current_time > 0.0 {
            let rate = current_time / elapsed;
            if rate > 0.0 {
                return Some((remaining / rate) as u64);
            }
        }

        None
    }
}