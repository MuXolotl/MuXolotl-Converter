<div align="center">

# 🦎 MuXolotl-Converter

**High-Performance Cross-Platform Audio & Video Converter**

[![License: GPL v2](https://img.shields.io/badge/License-GPLv2.0-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)[![License: LGPL v2.1](https://img.shields.io/badge/LGPLv2.1-blue.svg)](https://www.gnu.org/licenses/lgpl-2.1)
[![Version](https://img.shields.io/badge/Version-1.1.0-green.svg)](https://github.com/MuXolotl/MuXolotl-Converter/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows_|_macOS_|_Linux-lightgrey.svg)](https://github.com/MuXolotl/MuXolotl-Converter)
[![Built with Tauri](https://img.shields.io/badge/Tauri-2.10.1-blue?logo=tauri)](https://tauri.app/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev/)
[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)](https://www.rust-lang.org/)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Building](#%EF%B8%8F-building-from-source) • [Contributing](#-contributing)

</div>

---

## 📖 Overview

**MuXolotl-Converter** is a modern, blazing-fast desktop application for converting audio and video files. Built with **Tauri**, **Svelte 5**, and **Rust**, it leverages **FFmpeg** for professional-grade media processing while providing a beautiful, intuitive interface with GPU acceleration support.

> **Status**: 🚧 Active development | Production testing in progress

### Why MuXolotl-Converter?

- 🚀 **Hardware Acceleration** - NVIDIA NVENC, Intel QSV, AMD AMF, Apple VideoToolbox
- 🎯 **40+ Formats** - Comprehensive audio and video format support
- ⚡ **Parallel Processing** - Convert up to 4 files simultaneously
- 💾 **Queue Persistence** - Resume your work after closing the app
- 🎨 **Modern UI** - Sleek glass-morphism design with smooth transitions
- 🔧 **Advanced Controls** - Fine-tune bitrate, resolution, FPS, sample rate, channels
- 📊 **Real-time Progress** - Live FPS, speed, and ETA tracking
- 🔔 **Desktop Notifications** - Get notified when conversions complete
- 🎛️ **Batch Operations** - Apply settings to all files, clear completed, cancel all, clear All

---

## 📸 Screenshots

> 🖼️ *Screenshots will be added soon*

---

## ✨ Features

### Core Functionality

| Feature | Description |
|---------|-------------|
| **Multi-format Support** | 40+ audio/video formats with intelligent codec recommendations |
| **GPU Acceleration** | Automatic detection and usage of NVIDIA, Intel, AMD, and Apple GPUs |
| **Parallel Conversion** | Process up to 4 files simultaneously for faster batch operations |
| **Queue Management** | Add up to 50 files, with automatic persistence and duplicate detection |
| **Format Validation** | Real-time validation with warnings and recommendations |
| **Smart Codec Selection** | Automatic codec copying when possible to avoid re-encoding |

### User Experience

- **Drag & Drop** - Intuitive file dropping from file explorer
- **Compact View** - Toggle between detailed and compact queue views
- **Live Progress** - Real-time FPS, speed, ETA, and completion percentage
- **Batch Actions** - Apply settings to all files, clear completed conversions
- **Desktop Notifications** - System notifications for completed/failed conversions
- **Session Persistence** - Queue and output folder saved automatically (auto-save every 2s)

### Advanced Settings

- **Audio**: Sample rate (8-96 kHz), channels (mono/stereo/surround), bitrate
- **Video**: Resolution (480p-4K), frame rate (24-60 FPS), quality presets
- **Audio Extraction** - Extract audio from video files with one click
- **Custom Quality** - Low, Medium, High, Ultra, or Custom bitrate settings

---

## 🎵 Supported Formats

### Audio Formats (20+)

<details>
<summary><b>Click to expand audio formats table</b></summary>

| Format | Extension | Codec | Container | Stability | Use Case |
|--------|-----------|-------|-----------|-----------|----------|
| **MP3** | `.mp3` | libmp3lame | MP3 | ✅ Stable | Universal compatibility |
| **AAC** | `.aac`, `.m4a` | aac | M4A | ✅ Stable | High quality, modern devices |
| **FLAC** | `.flac` | flac | FLAC | ✅ Stable | Lossless archival |
| **WAV** | `.wav` | pcm_s16le | WAV | ✅ Stable | Uncompressed audio |
| **Opus** | `.opus` | libopus | Opus | ✅ Stable | Best quality/size ratio |
| **Vorbis** | `.ogg` | libvorbis | OGG | ✅ Stable | Open-source alternative |
| **ALAC** | `.alac` | alac | M4A | ✅ Stable | Apple lossless |
| **WavPack** | `.wv` | wavpack | WV | ✅ Stable | Hybrid lossless/lossy |
| **AC3** | `.ac3` | ac3 | AC3 | ⚠️ Setup | Surround sound (3+ channels) |
| **DTS** | `.dts` | dca | DTS | ⚠️ Setup | Cinema surround |
| **WMA** | `.wma` | wmav2 | ASF | ✅ Stable | Windows ecosystem |
| **AIFF** | `.aiff` | pcm_s16be | AIFF | ✅ Stable | Apple uncompressed |
| **APE** | `.ape` | ape | APE | 🔧 Experimental | Monkey's Audio lossless |
| **TTA** | `.tta` | tta | TTA | 🔧 Experimental | True Audio lossless |
| **AMR** | `.amr` | amr_nb | 3GPP | ✅ Stable | Voice/telephony |
| **Speex** | `.spx` | speex | OGG | ✅ Stable | Speech compression |
| **Matroska Audio** | `.mka` | various | Matroska | ✅ Stable | Multi-codec container |
| **AU** | `.au` | pcm_s16be | AU | ✅ Stable | Unix audio format |
| **TAK** | `.tak` | tak | TAK | 🔧 Experimental | Tom's lossless |
| **Shorten** | `.shn` | shorten | SHN | ⛔ Problematic | Obsolete lossless |
| **RealAudio** | `.ra` | real_288 | RM | ⛔ Problematic | Legacy streaming |

</details>

### Video Formats (20+)

<details>
<summary><b>Click to expand video formats table</b></summary>

| Format | Extension | Video Codecs | Audio Codecs | Stability | Use Case |
|--------|-----------|--------------|--------------|-----------|----------|
| **MP4** | `.mp4` | h264, hevc | aac, mp3, ac3 | ✅ Stable | Universal compatibility |
| **WebM** | `.webm` | vp8, vp9, av1 | opus, vorbis | ✅ Stable | Web streaming |
| **Matroska** | `.mkv` | h264, hevc, vp9, av1 | aac, opus, flac, ac3 | ✅ Stable | Flexible container |
| **AVI** | `.avi` | mpeg4, h264 | mp3, ac3 | ✅ Stable | Legacy compatibility |
| **MOV** | `.mov` | h264, hevc | aac, alac | ✅ Stable | Apple ecosystem |
| **FLV** | `.flv` | flv, h264 | mp3, aac | ✅ Stable | Flash video (legacy) |
| **OGV** | `.ogv` | theora, vp8 | vorbis, opus | ✅ Stable | Open-source video |
| **WMV** | `.wmv` | wmv2, vc1 | wmav2 | ✅ Stable | Windows Media |
| **MPEG** | `.mpg`, `.mpeg` | mpeg2video | mp2, mp3 | ✅ Stable | DVD-compatible |
| **MPEG-TS** | `.ts` | h264, hevc, mpeg2 | aac, mp3, ac3 | ✅ Stable | Broadcasting |
| **M4V** | `.m4v` | h264 | aac | ✅ Stable | iTunes video |
| **3GP** | `.3gp` | h264, mpeg4 | aac, amr | ✅ Stable | Mobile devices (max 352×288) |
| **MXF** | `.mxf` | mpeg2video, h264 | pcm_s16le | ⚠️ Setup | Professional broadcast |
| **F4V** | `.f4v` | h264 | aac | ✅ Stable | Flash H.264 video |
| **VOB** | `.vob` | mpeg2video | ac3, mp2 | ⚠️ Setup | DVD video (720×576/480) |
| **RM** | `.rm` | rv40 | cook | ⛔ Problematic | RealMedia (legacy) |
| **DivX** | `.divx` | mpeg4 | mp3 | ✅ Stable | DivX codec |
| **NUT** | `.nut` | h264, vp9 | opus, flac | 🔧 Experimental | NUT container |
| **Y4M** | `.y4m` | rawvideo | N/A | ✅ Stable | YUV4MPEG2 |
| **DV** | `.dv` | dvvideo | pcm_s16le | ⚠️ Setup | Digital Video (720×576/480) |

</details>

**Legend:**
- ✅ **Stable** - Fully supported, production-ready
- ⚠️ **Setup Required** - May need additional libraries or specific FFmpeg builds
- 🔧 **Experimental** - Limited testing, use with caution
- ⛔ **Problematic** - Known issues, legacy support only

---

## 💻 System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10+, macOS 10.15+, Linux (64-bit) |
| **RAM** | 4 GB |
| **Storage** | 200 MB for app + space for converted files |
| **FFmpeg** | Bundled with application |

### Recommended for GPU Acceleration

| GPU | Requirements |
|-----|--------------|
| **NVIDIA** | GeForce GTX 600+ / Quadro Kxxx+ with NVENC support |
| **Intel** | Intel HD Graphics 4000+ with Quick Sync Video |
| **AMD** | Radeon HD 7000+ with VCE/VCN support |
| **Apple** | M1/M2/M3 chip or Intel Mac with VideoToolbox |

### Platform-Specific Notes

- **Windows**: Tested on Windows 10 (Build 19045+)
- **macOS**: Built for macOS 10.15+ (Catalina and newer)
- **Linux**: Tested on Ubuntu 20.04+, Debian 11+, Arch Linux

---

## 📥 Installation

### Option 1: Download Pre-built Binaries (Recommended)

> 🚧 **Coming Soon** - Pre-built releases will be available at:
> 
> [**Releases Page**](https://github.com/MuXolotl/MuXolotl-Converter/releases)

**Available Installers:**
- Windows: `.msi` (installer) / `.exe` (portable)
- macOS: `.dmg` (Intel x64) / `.dmg` (Apple Silicon ARM64)
- Linux: `.AppImage` / `.deb` / `.rpm`

### Option 2: Build from Source

See [Building from Source](#%EF%B8%8F-building-from-source) section below.

---

## 🚀 Usage

### Quick Start

1. **Launch the application**
2. **Select output folder** (optional but recommended for batch processing)
3. **Add files**:
   - Drag & drop media files into the drop zone
   - Click "Browse Files" to select manually
4. **Choose output format** for each file
5. **Adjust quality settings** (Low/Medium/High/Ultra/Custom)
6. **Click "Convert All"** to start processing

### Advanced Usage

#### Audio Extraction from Video

1. Add a video file to the queue
2. Check **"Video → Audio"** checkbox
3. Select desired audio format (MP3, FLAC, AAC, etc.)
4. Click "Convert All"

#### Batch Operations

- **Apply to All** - Copy format and settings from first file to all pending files
- **Clear Completed** - Remove successfully converted files from queue
- **Cancel All** - Stop all active conversions
- **Clear All** - Remove all files from queue

#### Advanced Settings

Click the **⚙️ Settings** icon next to quality dropdown to access:

**Audio:**
- Sample Rate: 8 kHz - 96 kHz
- Channels: Mono, Stereo, 5.1, 7.1 Surround
- Custom Bitrate: 64-320 kbps (for lossy formats)

**Video:**
- Resolution: 480p, 720p, 1080p, 4K, or keep original
- Frame Rate: 24, 30, 60 FPS, or keep original

#### Queue Persistence

- Queue auto-saves every 2 seconds
- Files in queue persist when you close and reopen the app
- Files older than 7 days are automatically cleared
- Processing files reset to "pending" on app restart

---

## 🎮 GPU Acceleration

### Automatic Detection

MuXolotl-Converter automatically detects and uses available GPU encoders:

| Vendor | Encoder | Detection Method |
|--------|---------|------------------|
| **NVIDIA** | NVENC (H.264/HEVC) | `nvidia-smi` or system GPU info |
| **Intel** | Quick Sync Video | System GPU info (Windows/Linux/macOS) |
| **AMD** | AMF (H.264/HEVC) | System GPU info (Windows/Linux) |
| **Apple** | VideoToolbox | Apple Silicon M1/M2/M3 or Intel Mac |

### Supported GPU Codecs

**NVIDIA NVENC:**
- H.264 (`h264_nvenc`)
- HEVC/H.265 (`hevc_nvenc`)
- VP9 (`vp9_nvenc`) - RTX 30xx+

**Intel Quick Sync:**
- H.264 (`h264_qsv`)
- HEVC/H.265 (`hevc_qsv`)
- VP9 (`vp9_qsv`) - 11th gen+

**AMD AMF:**
- H.264 (`h264_amf`)
- HEVC/H.265 (`hevc_amf`)

**Apple VideoToolbox:**
- H.264 (`h264_videotoolbox`)
- HEVC/H.265 (`hevc_videotoolbox`)

### Fallback Behavior

If GPU encoding is unavailable:
- Software encoders are used automatically (libx264, libx265, libvpx)
- Conversion continues without hardware acceleration
- CPU-only mode indicator shown in UI

---

## 🔧 Configuration

### Output Path Behavior

- **No output folder selected**: Dialog opens for each file
- **Output folder selected**: Files saved automatically as `{filename}.{format}`
- Output folder preference persists between sessions

### Parallel Conversion

Toggle "Parallel conversion" to process up to **4 files simultaneously**:
- ✅ **Enabled**: Faster batch processing, higher CPU/GPU usage
- ❌ **Disabled**: Sequential processing, lower resource usage

### Desktop Notifications

The app requests notification permissions on first launch to notify you about:
- ✅ Individual file completion
- ❌ Conversion failures
- 🎉 Queue completion summary

---

## ⚠️ Known Limitations

| Limitation | Details |
|------------|---------|
| **Queue Size** | Maximum 50 files per queue |
| **Timeout** | Conversions timeout after 1 hour (3600s) |
| **Duplicate Files** | Same file path cannot be added twice |
| **GPU Detection Timeout** | 5-second timeout for GPU detection commands |
| **Problematic Formats** | Some legacy formats (SHN, RA, RM) may fail |
| **DV/VOB Formats** | No GPU acceleration, strict resolution requirements |

---

## 🛠️ Building from Source

### Prerequisites

**Required:**
- [Node.js](https://nodejs.org/) v18+ and npm
- [Rust](https://www.rust-lang.org/tools/install) v1.70+ (install via `rustup`)
- [Tauri Prerequisites](https://v1.tauri.app/v1/guides/getting-started/prerequisites/) (platform-specific)

**FFmpeg Binaries:**

Download and place FFmpeg binaries in `src-tauri/binaries/`:

**Windows:**
```bash
# Download from https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip
# Extract ffmpeg.exe and ffprobe.exe
# Rename to:
# - ffmpeg-x86_64-pc-windows-msvc.exe
# - ffprobe-x86_64-pc-windows-msvc.exe
```

**Linux:**
```bash
# Download from https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
# Extract ffmpeg and ffprobe
# Rename to:
# - ffmpeg-x86_64-unknown-linux-gnu
# - ffprobe-x86_64-unknown-linux-gnu
# Make executable: chmod +x ffmpeg* ffprobe*
```

**macOS (Intel x64):**
```bash
# Download from:
# - https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip
# - https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip
# Rename to:
# - ffmpeg-x86_64-apple-darwin
# - ffprobe-x86_64-apple-darwin
# Make executable: chmod +x ffmpeg* ffprobe*
```

**macOS (Apple Silicon ARM64):**
```bash
# Download from:
# - https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip?arch=arm64
# - https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip?arch=arm64
# Rename to:
# - ffmpeg-aarch64-apple-darwin
# - ffprobe-aarch64-apple-darwin
# Make executable: chmod +x ffmpeg* ffprobe*
```

### Build Steps

```bash
# 1. Clone repository
git clone https://github.com/MuXolotl/MuXolotl-Converter.git
cd MuXolotl-Converter

# 2. Install dependencies
npm install

# 3. Development mode
npm run dev

# 4. Build for production
npm run build

# 5. Build Tauri app
npm run tauri build
```

### Development Commands

```bash
npm run dev        # Start Vite dev server + Tauri dev window
npm run build      # Build frontend for production
npm run preview    # Preview production build
npm run check      # Run svelte-check (type checking)
npm run tauri      # Run Tauri CLI commands
npm run analyze    # Analyze bundle size
```

### Build Artifacts

After `npm run tauri build`, installers will be in:

```
src-tauri/target/release/bundle/
├── msi/           # Windows installer
├── nsis/          # Windows NSIS installer
├── deb/           # Debian package
├── rpm/           # RPM package
├── appimage/      # Linux AppImage
└── dmg/           # macOS disk image
```

---

## 🗺️ Roadmap

**Planned Features:**
> It's empty here for now.

**Suggestions?** [Open an issue](https://github.com/MuXolotl/MuXolotl-Converter/issues) or submit a PR!

---

## 🤝 Contributing

Contributions are **welcome and appreciated**! Whether it's bug reports, feature requests, documentation improvements, or code contributions.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Contribution Guidelines

- Follow existing code style (TypeScript/Rust)
- Add comments for complex logic
- Test your changes on at least one platform
- Update documentation if needed
- Keep commits atomic and descriptive

### Reporting Bugs

Please include:
- OS version and build number
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs if applicable
- GPU model (if GPU-related issue)

### Feature Requests

Open an issue with:
- Clear description of the feature
- Use cases and benefits
- Possible implementation approach (optional)

---

## 📄 License

This project is dual-licensed:

- **[GNU General Public License v2.0](LICENSE.GPL)** - Full copyleft license
- **[GNU Lesser General Public License v2.1](LICENSE.LGPL)** - Library-friendly license

You may choose either license for your use case.

### Third-Party Licenses

- **FFmpeg** - [GPL v2 / LGPL v2.1](https://ffmpeg.org/legal.html)
- **Tauri** - [MIT / Apache 2.0](https://github.com/tauri-apps/tauri/blob/dev/LICENSE_MIT)
- **Svelte** - [MIT](https://github.com/sveltejs/svelte/blob/main/LICENSE.md)

---

## 🙏 Acknowledgments

### Built With

- **[Tauri](https://tauri.app/)** - Lightweight desktop framework
- **[Svelte 5](https://svelte.dev/)** - UI framework with runes
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Rust](https://www.rust-lang.org/)** - Systems programming language
- **[FFmpeg](https://ffmpeg.org/)** - Multimedia processing engine
- **[Vite](https://vitejs.dev/)** - Frontend build tool
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Lucide Icons](https://lucide.dev/)** - Icon library

### FFmpeg Builds

- **Windows**: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)
- **Linux**: [John Van Sickle's FFmpeg Builds](https://johnvansickle.com/ffmpeg/)
- **macOS**: [evermeet.cx FFmpeg](https://evermeet.cx/ffmpeg/)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/MuXolotl/MuXolotl-Converter/issues)
- **Mail**: muxolotl@gmail.com

---

<div align="center">

Made with ❤️ by [MuXolotl](https://github.com/MuXolotl)

⭐ **Star this repo** if you find it useful!

</div>