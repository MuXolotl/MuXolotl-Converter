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
  { value: '3840x2160', label: '4K (3840x2160)' },
  { value: '1920x1080', label: '1080p (1920x1080)' },
  { value: '1280x720', label: '720p (1280x720)' },
  { value: '854x480', label: '480p (854x480)' },
] as const;

export const VIDEO_FPS = [
  { value: 'original', label: 'Keep Original' },
  { value: '24', label: '24 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
] as const;

export const MEDIA_EXTENSIONS = [
  'mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'wma', 'alac', 'aiff', 'wv', 'ape', 'tta',
  'ac3', 'dts', 'amr', 'au', 'ra', 'shn', 'mka', 'spx', 'tak', 'mp4', 'mkv', 'avi', 'mov',
  'webm', 'flv', 'wmv', 'mpg', 'mpeg', 'ts', 'm4v', 'ogv', '3gp', 'mxf', 'f4v', 'vob', 'rm',
  'divx', 'nut', 'y4m', 'dv',
] as const;

export const STABILITY_ICONS = {
  stable: '✓',
  requiressetup: '⚠️',
  experimental: '🔧',
  problematic: '⛔',
} as const;

export const CATEGORY_LABELS = {
  popular: 'Popular',
  standard: 'Standard',
  specialized: 'Specialized',
  legacy: 'Legacy',
  exotic: 'Exotic',
} as const;