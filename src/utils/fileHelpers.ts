import { invoke } from '@tauri-apps/api/tauri';
import { generateFileId, getDefaultFormat, getDefaultSettings } from '@/utils';
import { FileItem, MediaInfo } from '@/types';

const MAX_PARALLEL_PROCESSING = 50;

export const processFilePaths = async (paths: string[]): Promise<FileItem[]> => {
  const fileItems: FileItem[] = [];
  const errors: string[] = [];

  // Process in chunks to avoid UI freeze if adding hundreds of files
  for (let i = 0; i < paths.length; i += MAX_PARALLEL_PROCESSING) {
    const chunk = paths.slice(i, i + MAX_PARALLEL_PROCESSING);

    const results = await Promise.allSettled(
      chunk.map(async (path) => {
        // Call Rust to analyze file
        const mediaInfo = await invoke<MediaInfo>('detect_media_type', { path });
        
        // Create safe filename
        const name = path.split(/[\\/]/).pop() || 'unknown';
        
        // Determine defaults
        const isAudio = mediaInfo.media_type === 'audio';
        
        return {
          id: generateFileId(),
          path,
          name,
          mediaInfo,
          outputFormat: getDefaultFormat(mediaInfo.media_type),
          settings: getDefaultSettings(false), // GPU check happens later/globally usually, or pass it in if needed
          status: 'pending',
          progress: null,
          error: null,
          addedAt: Date.now(),
        } as FileItem;
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        fileItems.push(result.value);
      } else {
        console.error('Failed to process file:', result.reason);
        errors.push(String(result.reason));
      }
    });
  }

  if (errors.length > 0) {
    console.warn(`Failed to process ${errors.length} files.`);
    // Optionally you could return errors too, but for now just logging
  }

  return fileItems;
};