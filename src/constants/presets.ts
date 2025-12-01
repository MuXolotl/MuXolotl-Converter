import type { FileSettings } from '@/types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  type: 'video' | 'audio'; // New field to distinguish intent
  settings: Partial<FileSettings>;
  format?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'universal',
    name: 'Universal (MP4 H.264)',
    description: 'Best compatibility for all devices',
    type: 'video',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      quality: 'medium',
      width: undefined,
      height: undefined,
      extractAudioOnly: false,
    }
  },
  {
    id: 'youtube_1080',
    name: 'YouTube 1080p',
    description: 'Optimized for upload',
    type: 'video',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      quality: 'high',
      width: 1920,
      height: 1080,
      fps: 60,
      extractAudioOnly: false,
    }
  },
  {
    id: 'archive_hevc',
    name: 'Archive (H.265)',
    description: 'High quality, small file size',
    type: 'video',
    format: 'mkv',
    settings: {
      videoCodec: 'libx265',
      audioCodec: 'copy',
      quality: 'medium',
      extractAudioOnly: false,
    }
  },
  {
    id: 'audio_mp3',
    name: 'Audio Only (MP3)',
    description: 'Convert to MP3 audio',
    type: 'audio',
    format: 'mp3',
    settings: {
      extractAudioOnly: true,
      audioCodec: 'libmp3lame',
      quality: 'medium',
    }
  },
  {
    id: 'audio_flac',
    name: 'Lossless Audio (FLAC)',
    description: 'High fidelity audio',
    type: 'audio',
    format: 'flac',
    settings: {
      extractAudioOnly: true,
      audioCodec: 'flac',
      quality: 'high',
    }
  },
  {
    id: 'audio_wav',
    name: 'Studio Audio (WAV)',
    description: 'Uncompressed PCM',
    type: 'audio',
    format: 'wav',
    settings: {
      extractAudioOnly: true,
      audioCodec: 'pcm_s16le',
      quality: 'high',
    }
  }
];