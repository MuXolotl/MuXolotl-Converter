use crate::gpu::GpuInfo;
use crate::types::{FileMetadata, Quality};
use std::path::PathBuf;

pub struct FfmpegBuilder {
    input: PathBuf,
    output: PathBuf,
    args: Vec<String>,
    filters: Vec<String>,
}

impl FfmpegBuilder {
    pub fn new(input: &str, output: &str) -> Self {
        Self {
            input: PathBuf::from(input),
            output: PathBuf::from(output),
            args: Vec::with_capacity(32),
            filters: Vec::with_capacity(4),
        }
    }

    pub fn input_file(mut self) -> Self {
        self.args.push("-i".to_string());
        self.args.push(self.input.to_string_lossy().to_string());
        self
    }

    pub fn overwrite(mut self) -> Self {
        self.args.push("-y".to_string());
        self
    }

    pub fn hide_banner(mut self) -> Self {
        self.args.push("-hide_banner".to_string());
        self
    }

    pub fn progress_pipe(mut self) -> Self {
        self.args.push("-progress".to_string());
        self.args.push("pipe:1".to_string());
        self
    }

    pub fn arg(mut self, key: &str, value: &str) -> Self {
        self.args.push(key.to_string());
        self.args.push(value.to_string());
        self
    }

    pub fn flag(mut self, flag: &str) -> Self {
        self.args.push(flag.to_string());
        self
    }

    pub fn args_vec(mut self, args: &[String]) -> Self {
        self.args.extend_from_slice(args);
        self
    }

    pub fn disable_video(self) -> Self {
        self.flag("-vn")
    }

    pub fn disable_audio(self) -> Self {
        self.flag("-an")
    }

    pub fn video_codec(self, codec: &str) -> Self {
        self.arg("-c:v", codec)
    }

    pub fn audio_codec(self, codec: &str) -> Self {
        self.arg("-c:a", codec)
    }

    pub fn format(self, container: &str) -> Self {
        self.arg("-f", container)
    }

    pub fn audio_bitrate(self, kbps: u32) -> Self {
        self.arg("-b:a", &format!("{}k", kbps))
    }

    pub fn sample_rate(self, rate: u32) -> Self {
        self.arg("-ar", &rate.to_string())
    }

    pub fn channels(self, count: u32) -> Self {
        self.arg("-ac", &count.to_string())
    }

    pub fn fps(self, fps: u32) -> Self {
        self.arg("-r", &fps.to_string())
    }

    pub fn resolution(mut self, width: Option<u32>, height: Option<u32>, force_exact: bool) -> Self {
        match (width, height) {
            (Some(w), Some(h)) => {
                if force_exact {
                    self.filters.push(format!("scale={}:{}", w, h));
                } else {
                    self.filters.push(format!("scale={}:-2", w));
                }
            }
            (Some(w), None) => {
                self.filters.push(format!("scale={}:-2", w));
            }
            (None, Some(h)) => {
                self.filters.push(format!("scale=-2:{}", h));
            }
            (None, None) => {}
        }
        self
    }

    pub fn pixel_format(mut self, fmt: &str) -> Self {
        self.filters.push(format!("format={}", fmt));
        self
    }

    pub fn hwaccel(mut self, gpu: &GpuInfo) -> Self {
        for (key, value) in gpu.hwaccel_args() {
            self.args.push(key.to_string());
            self.args.push(value.to_string());
        }
        self
    }

    pub fn metadata(mut self, meta: &Option<FileMetadata>) -> Self {
        let args = meta
            .as_ref()
            .map(|m| m.to_ffmpeg_args())
            .unwrap_or_else(|| vec!["-map_metadata".to_string(), "-1".to_string()]);
        self.args.extend(args);
        self
    }

    pub fn x264_preset(self, quality: Quality) -> Self {
        self.arg("-preset", quality.video_preset())
            .arg("-crf", quality.video_crf())
    }

    pub fn x265_preset(self, quality: Quality) -> Self {
        self.arg("-preset", quality.video_preset())
            .arg("-crf", quality.video_crf())
    }

    pub fn nvenc_preset(self, quality: Quality) -> Self {
        let preset = match quality {
            Quality::Low => "p2",
            Quality::Medium => "p4",
            Quality::High => "p6",
            Quality::Ultra => "p7",
            Quality::Custom => "p4",
        };

        self.arg("-preset", preset)
            .arg("-rc", "vbr")
            .arg("-cq", quality.video_crf())
            .arg("-spatial-aq", "1")
    }

    pub fn qsv_preset(self, quality: Quality) -> Self {
        self.arg("-preset", "medium")
            .arg("-global_quality", quality.video_crf())
            .arg("-look_ahead", "1")
    }

    pub fn amf_preset(self, quality: Quality) -> Self {
        let (usage, qual_profile) = match quality {
            Quality::Low => ("transcoding", "speed"),
            Quality::Medium => ("transcoding", "balanced"),
            Quality::High => ("transcoding", "quality"),
            Quality::Ultra => ("transcoding", "quality"),
            Quality::Custom => ("transcoding", "balanced"),
        };

        self.arg("-usage", usage)
            .arg("-quality", qual_profile)
            .arg("-profile:v", "main")
    }

    pub fn videotoolbox_preset(self) -> Self {
        self.arg("-profile:v", "high").arg("-allow_sw", "1")
    }

    pub fn vpx_preset(self, quality: Quality, is_vp9: bool) -> Self {
        let crf = match quality {
            Quality::Low => "35",
            Quality::High => "24",
            Quality::Ultra => "15",
            _ => "31",
        };

        let cpu = match quality {
            Quality::Low => "5",
            Quality::High => "1",
            Quality::Ultra => "0",
            _ => "2",
        };

        let mut builder = self.arg("-crf", crf).arg("-b:v", "0").arg("-cpu-used", cpu);

        if is_vp9 {
            builder = builder.arg("-row-mt", "1").arg("-tile-columns", "2");
        }

        builder
    }

    pub fn mpeg2_preset(self, quality: Quality) -> Self {
        let bitrate = match quality {
            Quality::Low => "4000k",
            Quality::High => "8000k",
            Quality::Ultra => "12000k",
            _ => "6000k",
        };

        self.arg("-b:v", bitrate)
            .arg("-maxrate", bitrate)
            .arg("-bufsize", "4M")
    }

    pub fn apply_video_codec_preset(self, codec: &str, quality: Quality) -> Self {
        match codec {
            c if c.contains("nvenc") => self.nvenc_preset(quality),
            c if c.contains("qsv") => self.qsv_preset(quality),
            c if c.contains("amf") => self.amf_preset(quality),
            c if c.contains("videotoolbox") => self.videotoolbox_preset(),
            c if c.contains("libx264") => self.x264_preset(quality),
            c if c.contains("libx265") => self.x265_preset(quality),
            c if c.contains("libvpx-vp9") => self.vpx_preset(quality, true),
            c if c.contains("libvpx") => self.vpx_preset(quality, false),
            "mpeg2video" => self.mpeg2_preset(quality),
            _ => self,
        }
    }

    pub fn build(mut self) -> (Vec<String>, String) {
        if !self.filters.is_empty() {
            self.args.push("-vf".to_string());
            self.args.push(self.filters.join(","));
        }

        let output = self.output.to_string_lossy().to_string();
        self.args.push(output.clone());

        (self.args, output)
    }
}