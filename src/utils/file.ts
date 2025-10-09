import type { FileItem, FileSettings } from '@/types';

let idCounter = 0;

export const generateFileId = (): string => {
  idCounter = (idCounter + 1) % 10000;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 9)}`;
};

export const generateOutputPath = (file: FileItem, folder: string): string => {
  const lastDotIndex = file.name.lastIndexOf('.');
  const inputName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
  
  // Определяем правильный разделитель на основе folder
  // Если folder содержит обратные слеши - это Windows
  const separator = folder.includes('\\') ? '\\' : '/';
  
  // Убеждаемся, что folder не заканчивается на разделитель
  const normalizedFolder = folder.endsWith(separator) || folder.endsWith('/') || folder.endsWith('\\')
    ? folder.slice(0, -1)
    : folder;
  
  return `${normalizedFolder}${separator}${inputName}.${file.outputFormat}`;
};

export const getDefaultSettings = (gpuAvailable: boolean): FileSettings => ({
  quality: 'medium',
  useGpu: gpuAvailable,
  extractAudioOnly: false,
  sampleRate: 44100,
  channels: 2,
});

const STATUS_PRIORITY = {
  processing: 0,
  pending: 1,
  cancelled: 2,
  failed: 3,
  completed: 4,
} as const;

export const sortFilesByStatus = (files: FileItem[]): FileItem[] => {
  return [...files].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    if (['completed', 'failed', 'cancelled'].includes(a.status)) {
      return (b.completedAt || 0) - (a.completedAt || 0);
    }

    return (b.addedAt || 0) - (a.addedAt || 0);
  });
};