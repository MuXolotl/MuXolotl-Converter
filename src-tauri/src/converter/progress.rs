use super::ConversionProgress;
use lazy_static::lazy_static;
use regex::Regex;
use std::time::Instant;

lazy_static! {
    // FFmpeg outputs time in microseconds (us) usually
    static ref TIME_US_REGEX: Regex = Regex::new(r"out_time_us=(\d+)").unwrap();
    // Fallback for milliseconds
    static ref TIME_MS_REGEX: Regex = Regex::new(r"out_time_ms=(\d+)").unwrap();
    static ref FPS_REGEX: Regex = Regex::new(r"fps=([\d.]+)").unwrap();
    static ref SPEED_REGEX: Regex = Regex::new(r"speed=([\d.]+)x").unwrap();
}

const UPDATE_INTERVAL_MS: u128 = 100;

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
        // Handle explicit end
        if line.contains("progress=end") {
            return self.make_progress(true, None, None, None);
        }

        // Parse metrics
        let current_us = TIME_US_REGEX
            .captures(line)
            .and_then(|c| c[1].parse::<i64>().ok());

        let current_ms = if current_us.is_none() {
            TIME_MS_REGEX
                .captures(line)
                .and_then(|c| c[1].parse::<i64>().ok())
        } else {
            None
        };

        // Calculate seconds
        let current_time = if let Some(us) = current_us {
            us as f64 / 1_000_000.0
        } else if let Some(ms) = current_ms {
            ms as f64 / 1_000.0
        } else {
            // If we didn't find time in this line, checking for other stats is pointless
            // unless we want to cache them. For now, we update only when time changes.
            return None;
        };

        let fps = FPS_REGEX
            .captures(line)
            .and_then(|c| c[1].parse().ok());

        let speed = SPEED_REGEX
            .captures(line)
            .and_then(|c| c[1].parse().ok());

        self.make_progress(false, Some(current_time), fps, speed)
    }

    fn make_progress(
        &mut self,
        is_end: bool,
        current_time: Option<f64>,
        fps: Option<f64>,
        speed: Option<f64>,
    ) -> Option<ConversionProgress> {
        if is_end {
            let progress = ConversionProgress {
                task_id: self.task_id.clone(),
                percent: 100.0,
                fps: None,
                speed: None,
                eta_seconds: Some(0),
                current_time: self.total_duration,
                total_time: self.total_duration,
            };
            self.last_progress = Some(progress.clone());
            return Some(progress);
        }

        // Throttle
        if self.last_progress.is_some() && self.last_update.elapsed().as_millis() < UPDATE_INTERVAL_MS {
            return None;
        }

        let current_time = current_time.unwrap_or(0.0);
        
        // Calculate percent
        let mut percent = if self.total_duration > 0.0001 {
            (current_time / self.total_duration) * 100.0
        } else {
            0.0
        };

        // Clamp to 99% until explicit "end" signal comes
        if percent > 99.0 {
            percent = 99.0;
        }

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
            return None;
        }

        let remaining = self.total_duration - current_time;

        // 1. Use FFmpeg speed
        if let Some(s) = speed {
            if s > 0.0 {
                return Some((remaining / s) as u64);
            }
        }

        // 2. Average calculation
        let elapsed = self.start_time.elapsed().as_secs_f64();
        if elapsed > 1.0 && current_time > 0.0 {
            let rate = current_time / elapsed;
            if rate > 0.0 {
                return Some((remaining / rate) as u64);
            }
        }

        None
    }
}