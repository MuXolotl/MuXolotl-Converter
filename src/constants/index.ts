// ===== Conversion Options =====

export const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'custom', label: 'Custom' },
] as const;

export const AUDIO_SAMPLE_RATES = [8000, 16000, 22050, 44100, 48000, 96000] as const;

export const AUDIO_CHANNELS = [
  { value: 1, label: 'Mono' },
  { value: 2, label: 'Stereo' },
  { value: 6, label: '5.1 Surround' },
  { value: 8, label: '7.1 Surround' },
] as const;

export const VIDEO_RESOLUTIONS = [
  { value: 'original', label: 'Keep Original' },
  { value: '3840x2160', label: '4K (3840×2160)' },
  { value: '1920x1080', label: '1080p (1920×1080)' },
  { value: '1280x720', label: '720p (1280×720)' },
  { value: '854x480', label: '480p (854×480)' },
] as const;

export const VIDEO_FPS = [
  { value: 'original', label: 'Keep Original' },
  { value: '24', label: '24 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
] as const;

// ===== File Handling =====

export const MAX_QUEUE_SIZE = 50;

export const MEDIA_EXTENSIONS = [
  // Audio
  'mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'wma', 'alac', 'aiff',
  'wv', 'ape', 'tta', 'ac3', 'dts', 'amr', 'au', 'ra', 'shn', 'mka', 'spx', 'tak',
  // Video
  'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'mpg', 'mpeg', 'ts',
  'm4v', 'ogv', '3gp', 'mxf', 'f4v', 'vob', 'rm', 'divx', 'nut', 'y4m', 'dv',
] as const;

// ===== UI Constants =====

export const STABILITY_CONFIG = {
  stable: { icon: '✓', color: 'text-green-400' },
  requiressetup: { icon: '⚠️', color: 'text-yellow-400' },
  experimental: { icon: '🔧', color: 'text-orange-400' },
  problematic: { icon: '⛔', color: 'text-red-400' },
} as const;

export const CATEGORY_LABELS = {
  popular: 'Popular',
  standard: 'Standard',
  specialized: 'Specialized',
  legacy: 'Legacy',
  exotic: 'Exotic',
} as const;

export const STATUS_CONFIG = {
  pending: { color: 'text-yellow-400', bgColor: 'bg-yellow-400' },
  processing: { color: 'text-purple-400', bgColor: 'bg-purple-400' },
  completed: { color: 'text-green-400', bgColor: 'bg-green-400' },
  failed: { color: 'text-red-400', bgColor: 'bg-red-400' },
  cancelled: { color: 'text-orange-400', bgColor: 'bg-orange-400' },
} as const;