import type { FileItem, FileSettings } from '@/types';

let idCounter = 0;
export const generateFileId = () => {
  idCounter = (idCounter + 1) % 10000;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 9)}`;
};

export const generateOutputPath = (file: FileItem, folder: string): string => {
  const inputName = file.name.substring(0, file.name.lastIndexOf('.'));
  return `${folder}/${inputName}.${file.outputFormat}`;
};

export const getDefaultSettings = (gpuAvailable: boolean): FileSettings => ({
  quality: 'medium',
  useGpu: gpuAvailable,
  extractAudioOnly: false,
  sampleRate: 44100,
  channels: 2,
});

export const sortFilesByStatus = (files: FileItem[]): FileItem[] => {
  const statusOrder = { processing: 0, pending: 1, cancelled: 2, failed: 3, completed: 4 };

  return [...files].sort((a, b) => {
    const diff = statusOrder[a.status] - statusOrder[b.status];
    if (diff !== 0) return diff;

    if (['completed', 'failed', 'cancelled'].includes(a.status)) {
      return (b.completedAt || 0) - (a.completedAt || 0);
    }

    return (b.addedAt || 0) - (a.addedAt || 0);
  });
};
