use crate::gpu::{GpuInfo, GpuVendor};
use crate::converter::common::normalize_path;
use crate::types::FileMetadata;

pub struct FfmpegCommand {
    input: String,
    output: String,
    args: Vec<String>,
    filters: Vec<String>,
}

impl FfmpegCommand {
    pub fn new(input: &str, output: &str) -> Self {
        Self {
            input: normalize_path(input),
            output: normalize_path(output),
            args: Vec::new(),
            filters: Vec::new(),
        }
    }

    pub fn arg(mut self, key: &str, value: &str) -> Self {
        self.args.push(key.to_string());
        self.args.push(value.to_string());
        self
    }

    pub fn flag(mut self, key: &str) -> Self {
        self.args.push(key.to_string());
        self
    }

    pub fn raw_args(mut self, args: &[String]) -> Self {
        self.args.extend_from_slice(args);
        self
    }

    pub fn input_opts(mut self) -> Self {
        // Standard input options to reduce boilerplate
        self.args.insert(0, self.input.clone());
        self.args.insert(0, "-i".to_string());
        self
    }

    pub fn overwrite(self) -> Self {
        self.flag("-y")
    }

    pub fn hide_banner(self) -> Self {
        self.flag("-hide_banner")
    }

    // --- Metadata Logic ---
    pub fn apply_metadata(mut self, metadata: &Option<FileMetadata>) -> Self {
        // FIX: Capture the modified self back into the variable
        self = self.arg("-map_metadata", "-1");

        if let Some(meta) = metadata {
            if let Some(val) = &meta.title { if !val.is_empty() { self = self.arg("-metadata", &format!("title={}", val)); } }
            if let Some(val) = &meta.artist { if !val.is_empty() { self = self.arg("-metadata", &format!("artist={}", val)); } }
            if let Some(val) = &meta.album { if !val.is_empty() { self = self.arg("-metadata", &format!("album={}", val)); } }
            if let Some(val) = &meta.genre { if !val.is_empty() { self = self.arg("-metadata", &format!("genre={}", val)); } }
            if let Some(val) = &meta.year { if !val.is_empty() { self = self.arg("-metadata", &format!("date={}", val)); } }
        }
        self
    }

    // --- GPU Acceleration Logic ---
    pub fn apply_hw_accel(self, gpu: &GpuInfo) -> Self {
        if !gpu.available { return self; }

        match gpu.vendor {
            GpuVendor::Nvidia => {
                self.arg("-hwaccel", "cuda")
                    .arg("-hwaccel_output_format", "cuda")
            },
            GpuVendor::Intel => {
                self.arg("-hwaccel", "qsv")
                    .arg("-hwaccel_output_format", "qsv")
            },
            GpuVendor::Amd => {
                #[cfg(target_os = "windows")]
                return self.arg("-hwaccel", "d3d11va");
                #[cfg(not(target_os = "windows"))]
                return self.arg("-hwaccel", "auto");
            },
            GpuVendor::Apple => {
                self.arg("-hwaccel", "videotoolbox")
            },
            _ => self,
        }
    }

    // --- Codec Logic ---
    pub fn video_codec(self, codec: &str) -> Self {
        self.arg("-c:v", codec)
    }

    pub fn audio_codec(self, codec: &str) -> Self {
        self.arg("-c:a", codec)
    }

    pub fn disable_video(self) -> Self {
        self.flag("-vn")
    }

    pub fn disable_audio(self) -> Self {
        self.flag("-an")
    }

    // --- Video Filters (Scaling, FPS) ---
    pub fn resolution(mut self, width: Option<u32>, height: Option<u32>, force_even: bool) -> Self {
        if let (Some(w), Some(h)) = (width, height) {
            let w_str = if force_even { format!("{}", w & !1) } else { w.to_string() };
            let h_str = if force_even { format!("{}", h & !1) } else { h.to_string() };
            self.filters.push(format!("scale={}:{}", w_str, h_str));
        }
        self
    }

    pub fn fps(self, fps: Option<u32>) -> Self {
        if let Some(f) = fps {
            self.arg("-r", &f.to_string())
        } else {
            self
        }
    }

    pub fn pixel_format(mut self, fmt: &str) -> Self {
        self.filters.push(format!("format={}", fmt));
        self
    }

    // --- Audio Settings ---
    pub fn audio_bitrate(self, bitrate: Option<u32>) -> Self {
        if let Some(b) = bitrate {
            self.arg("-b:a", &format!("{}k", b))
        } else {
            self
        }
    }

    pub fn sample_rate(self, rate: Option<u32>) -> Self {
        if let Some(r) = rate {
            self.arg("-ar", &r.to_string())
        } else {
            self
        }
    }

    pub fn channels(self, channels: Option<u32>) -> Self {
        if let Some(c) = channels {
            self.arg("-ac", &c.to_string())
        } else {
            self
        }
    }

    // --- Container & Progress ---
    pub fn format(self, container: &str) -> Self {
        self.arg("-f", container)
    }

    pub fn progress_pipe(self) -> Self {
        self.arg("-progress", "pipe:1")
    }

    // --- Final Build ---
    pub fn build(mut self) -> (Vec<String>, String) {
        // Combine filters
        if !self.filters.is_empty() {
            self.args.push("-vf".to_string());
            self.args.push(self.filters.join(","));
        }

        // Output comes last
        self.args.push(self.output.clone());

        (self.args, self.output)
    }
}