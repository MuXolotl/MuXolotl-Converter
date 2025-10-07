import type { FileItem, FileSettings, MediaType } from '@/types';

export const truncatePath = (path: string, maxLength: number = 25): string => {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return path.substring(0, maxLength - 3) + '...';
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
};

export const getDefaultFormat = (mediaType: MediaType): string =>
  mediaType === 'audio' ? 'mp3' : 'mp4';

export const getDefaultSettings = (mediaType: MediaType, gpuAvailable: boolean): FileSettings => ({
  quality: 'medium',
  useGpu: true,
  extractAudioOnly: false,
  sampleRate: 44100,
  channels: 2,
});

export const generateFileId = () => `${Math.random().toString(36).slice(2)}_${Date.now()}`;

export const generateOutputPath = (file: FileItem, folder: string): string => {
  const inputName = file.name.substring(0, file.name.lastIndexOf('.'));
  return `${folder}/${inputName}_converted.${file.outputFormat}`;
};