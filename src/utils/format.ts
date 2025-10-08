import type { AudioFormat, VideoFormat } from '@/types';

export const getDefaultFormat = (mediaType: string): string => {
  return mediaType === 'audio' ? 'mp3' : 'mp4';
};

export const isAudioFormat = (format: AudioFormat | VideoFormat): format is AudioFormat => {
  return 'lossy' in format;
};

export const isVideoFormat = (format: AudioFormat | VideoFormat): format is VideoFormat => {
  return 'video_codecs' in format;
};

export const getFormatByExtension = (
  formats: (AudioFormat | VideoFormat)[],
  extension: string
): AudioFormat | VideoFormat | undefined => {
  return formats.find(f => f.extension === extension);
};

export const truncatePath = (path: string, maxLength: number = 25): string => {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return path.substring(0, maxLength - 3) + '...';
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
};
