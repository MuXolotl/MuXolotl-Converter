# TODO List

- [ ] Rust backend refactoring
- [ ] Image conversion
- [ ] Embedded subtitles extraction
- [ ] File metadata extraction/adding/editing
- [ ] File concatenation — merging multiple video/audio files into one
- [ ] OS context menu integration — "Convert with MuXolotl" on right-click
- [ ] Configurable parallel conversion limit
- [ ] Task priority — drag-and-drop to reorder the queue, pausing individual tasks
- [ ] Output file size estimation — show approximate size before conversion
- [ ] Drag & Drop folders — not just files, but entire directories (recursively)
- [ ] Conversion history or total duration/converted file count tracking
- [ ] "Show in folder" — button to quickly navigate to the converted file
- [ ] Output folder setting — global or per-file
- [ ] CPU/GPU load indicator — real-time monitoring during conversion
- [ ] FFmpeg command — display the generated FFmpeg command for advanced users (educationally)
- [ ] Auto-updater
- [ ] Error handling — clean, user-friendly error messages
- [ ] Graceful cancellation — proper conversion cancellation (kill FFmpeg process + temp file cleanup)
- [ ] Input file validation — check the file before conversion starts (is the format supported, is the file corrupted)
- [ ] Fix Linux compilation (AppImage)
- [ ] Auto-bundling FFmpeg — include FFmpeg in the installer or download on first launch (no manual installation required)
- [ ] CONTRIBUTING.md — contributor guide
- [ ] Architecture documentation — Frontend ↔ Tauri IPC ↔ Rust Backend ↔ FFmpeg interaction diagram
- [ ] Screenshots/GIFs in README — visual UI demonstration

# COMPLETED (FULLY/PARTIALLY)

- [x] ~*File info — click on a file to show full details: codec, bitrate, resolution, duration, size, audio tracks*~ | **2026-04-01**
- [x] ~*Improved auto-detection of the best codec*~ | **2026-03-31**
- [x] ~*Migration from React to Svelte 5*~ | **2026-03-31**
- [x] ~*Tauri upgrade to v2*~ | **2026-03-30**
