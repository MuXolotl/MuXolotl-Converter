import { useCallback } from 'react';
import type { FileItem } from '@/types';

export const useFileSettings = (updateFile: (fileId: string, updates: Partial<FileItem>) => void) => {
  const updateSettings = useCallback(
    (fileId: string, currentSettings: FileItem['settings'], updates: Partial<FileItem['settings']>) => {
      updateFile(fileId, { 
        settings: { ...currentSettings, ...updates }
      });
    },
    [updateFile]
  );

  const updateFormat = useCallback(
    (fileId: string, format: string) => {
      updateFile(fileId, { outputFormat: format, outputPath: undefined });
    },
    [updateFile]
  );

  const toggleExtractAudio = useCallback(
    (fileId: string, currentSettings: FileItem['settings'], extract: boolean) => {
      updateFile(fileId, {
        settings: { ...currentSettings, extractAudioOnly: extract },
        outputFormat: extract ? 'mp3' : 'mp4',
        outputPath: undefined,
      });
    },
    [updateFile]
  );

  return { updateSettings, updateFormat, toggleExtractAudio };
};