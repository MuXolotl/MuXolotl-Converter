export type GpuVendor = 'nvidia' | 'intel' | 'amd' | 'apple' | 'none';

export interface GpuInfo {
  vendor: GpuVendor;
  name: string;
  encoder_h264: string | null;
  encoder_h265: string | null;
  decoder: string | null;
  available: boolean;
}

export type MediaType = 'audio' | 'video' | 'unknown';

export interface VideoStream {
  codec: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number | null;
}

export interface AudioStream {
  codec: string;
  sample_rate: number;
  channels: number;
  bitrate: number | null;
}

export interface MediaInfo {
  media_type: MediaType;
  duration: number;
  file_size: number;
  format_name: string;
  video_streams: VideoStream[];
  audio_streams: AudioStream[];
}

export type Category = 'popular' | 'standard' | 'specialized' | 'legacy' | 'exotic';
export type Stability = 'stable' | 'requiressetup' | 'experimental' | 'problematic';

export interface AudioFormat {
  extension: string;
  name: string;
  category: Category;
  codec: string;
  container: string | null;
  stability: Stability;
  description: string;
  typical_use: string;
  lossy: boolean;
  bitrate_range: [number, number] | null;
  recommended_bitrate: number | null;
  sample_rates: number[];
  recommended_sample_rate: number;
  channels_support: number[];
  special_params: string[];
}

export interface VideoFormat {
  extension: string;
  name: string;
  category: Category;
  video_codecs: string[];
  audio_codecs: string[];
  container: string;
  stability: Stability;
  description: string;
  typical_use: string;
  max_resolution: [number, number] | null;
  special_params: string[];
}

export interface ValidationResult {
  is_valid: boolean;
  warnings: string[];
  errors: string[];
  suggested_params: string[];
  alternative_codec: string | null;
}

export interface ConversionProgress {
  task_id: string;
  percent: number;
  fps: number | null;
  speed: number | null;
  eta_seconds: number | null;
  current_time: number;
  total_time: number;
}

export interface ConversionSettings {
  taskId?: string;
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  useGpu: boolean;
  audioAction?: 'copy' | 'remove' | 'reencode';
}

export interface FileSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  useGpu: boolean;
  extractAudioOnly: boolean;
}

export interface FileItem {
  id: string;
  path: string;
  name: string;
  mediaInfo: MediaInfo | null;
  outputFormat: string;
  outputPath?: string;
  settings: FileSettings;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: ConversionProgress | null;
  error: string | null;
  completedAt?: number;
  addedAt: number;
}

export interface RecommendedFormats {
  fast: string[];
  safe: string[];
  setup: string[];
  experimental: string[];
  problematic: string[];
}

export type TabType = 'audio' | 'video';

export interface ConversionContextType {
  updateFile: (fileId: string, updates: Partial<FileItem>) => void;
  startConversion: (file: FileItem) => Promise<void>;
  cancelConversion: (fileId: string) => Promise<void>;
  isConverting: boolean;
}
