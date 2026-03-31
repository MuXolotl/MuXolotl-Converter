use crate::types::{FileMetadata, Quality};
use std::path::PathBuf;

pub struct FfmpegBuilder {
    input: PathBuf,
    output: PathBuf,
    args: Vec<String>,
    filters: Vec<String>,
    filter_complex: Option<String>,
}

impl FfmpegBuilder {
    pub fn new(input: &str, output: &str) -> Self {
        Self {
            input: PathBuf::from(input),
            output: PathBuf::from(output),
            args: Vec::with_capacity(32),
            filters: Vec::with_capacity(4),
            filter_complex: None,
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

    pub fn resolution(
        mut self,
        width: Option<u32>,
        height: Option<u32>,
        force_exact: bool,
    ) -> Self {
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

    /// Scale to fit within a bounding box while maintaining aspect ratio.
    /// Output dimensions are rounded to even numbers (required by most codecs).
    /// Used for auto-downscaling when source exceeds format's max_resolution.
    pub fn resolution_fit(mut self, max_w: u32, max_h: u32) -> Self {
        self.filters.push(format!(
            "scale='min({},iw)':'min({},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
            max_w, max_h
        ));
        self
    }

    pub fn pixel_format(mut self, fmt: &str) -> Self {
        self.filters.push(format!("format={}", fmt));
        self
    }

    pub fn filter_complex(mut self, fc: &str) -> Self {
        self.filter_complex = Some(fc.to_string());
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

    // ========== Codec-specific presets ==========

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
            Quality::High | Quality::Ultra => ("transcoding", "quality"),
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

    pub fn av1_preset(self, quality: Quality) -> Self {
        let crf = match quality {
            Quality::Low => "45",
            Quality::Medium => "35",
            Quality::High => "28",
            Quality::Ultra => "20",
            Quality::Custom => "35",
        };
        let cpu_used = match quality {
            Quality::Low => "8",
            Quality::Medium => "6",
            Quality::High => "4",
            Quality::Ultra => "2",
            Quality::Custom => "6",
        };
        self.arg("-crf", crf)
            .arg("-b:v", "0")
            .arg("-cpu-used", cpu_used)
            .arg("-row-mt", "1")
            .arg("-tiles", "2x2")
    }

    pub fn mpeg_preset(self, quality: Quality) -> Self {
        let bitrate = match quality {
            Quality::Low => "2000k",
            Quality::Medium => "5000k",
            Quality::High => "8000k",
            Quality::Ultra => "12000k",
            Quality::Custom => "5000k",
        };
        let maxrate = match quality {
            Quality::Low => "3000k",
            Quality::Medium => "6000k",
            Quality::High => "10000k",
            Quality::Ultra => "15000k",
            Quality::Custom => "6000k",
        };
        self.arg("-b:v", bitrate)
            .arg("-maxrate", maxrate)
            .arg("-bufsize", "4M")
    }

    pub fn mpeg4_preset(self, quality: Quality) -> Self {
        let bitrate = match quality {
            Quality::Low => "1000k",
            Quality::Medium => "3000k",
            Quality::High => "5000k",
            Quality::Ultra => "8000k",
            Quality::Custom => "3000k",
        };
        self.arg("-b:v", bitrate)
            .arg("-maxrate", bitrate)
            .arg("-bufsize", "2M")
    }

    pub fn theora_preset(self, quality: Quality) -> Self {
        let q = match quality {
            Quality::Low => "3",
            Quality::Medium => "6",
            Quality::High => "8",
            Quality::Ultra => "10",
            Quality::Custom => "6",
        };
        self.arg("-q:v", q)
    }

    pub fn flv_preset(self, quality: Quality) -> Self {
        let bitrate = match quality {
            Quality::Low => "500k",
            Quality::Medium => "1500k",
            Quality::High => "3000k",
            Quality::Ultra => "5000k",
            Quality::Custom => "1500k",
        };
        self.arg("-b:v", bitrate)
    }

    pub fn wmv_preset(self, quality: Quality) -> Self {
        let bitrate = match quality {
            Quality::Low => "500k",
            Quality::Medium => "2000k",
            Quality::High => "4000k",
            Quality::Ultra => "8000k",
            Quality::Custom => "2000k",
        };
        self.arg("-b:v", bitrate)
    }

    pub fn mjpeg_preset(self, quality: Quality) -> Self {
        let q = match quality {
            Quality::Low => "15",
            Quality::Medium => "8",
            Quality::High => "4",
            Quality::Ultra => "2",
            Quality::Custom => "8",
        };
        self.arg("-q:v", q)
    }

    pub fn prores_preset(self, quality: Quality) -> Self {
        let profile = match quality {
            Quality::Low => "0",
            Quality::Medium => "2",
            Quality::High => "3",
            Quality::Ultra => "4",
            Quality::Custom => "2",
        };
        self.arg("-profile:v", profile).arg("-vendor", "apl0")
    }

    pub fn generic_bitrate_preset(self, quality: Quality) -> Self {
        let bitrate = match quality {
            Quality::Low => "1000k",
            Quality::Medium => "3000k",
            Quality::High => "6000k",
            Quality::Ultra => "10000k",
            Quality::Custom => "3000k",
        };
        self.arg("-b:v", bitrate)
    }

    // ========== Master codec router ==========

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
            c if c.contains("libaom") || c.contains("svtav1") || c.contains("av1") => {
                self.av1_preset(quality)
            }
            "mpeg1video" | "mpeg2video" => self.mpeg_preset(quality),
            "mpeg4" | "libxvid" => self.mpeg4_preset(quality),
            "libtheora" | "theora" => self.theora_preset(quality),
            "flv" | "flv1" => self.flv_preset(quality),
            "wmv1" | "wmv2" => self.wmv_preset(quality),
            "mjpeg" => self.mjpeg_preset(quality),
            c if c.contains("prores") => self.prores_preset(quality),
            "copy" | "rawvideo" | "gif" | "dvvideo" => self,
            _ => self.generic_bitrate_preset(quality),
        }
    }

    pub fn build(mut self) -> (Vec<String>, String) {
        if let Some(fc) = &self.filter_complex {
            self.args.push("-filter_complex".to_string());
            self.args.push(fc.clone());
        } else if !self.filters.is_empty() {
            self.args.push("-vf".to_string());
            self.args.push(self.filters.join(","));
        }

        let output = self.output.to_string_lossy().to_string();
        self.args.push(output.clone());

        (self.args, output)
    }
}