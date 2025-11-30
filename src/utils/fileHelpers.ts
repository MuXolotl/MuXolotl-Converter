import { invoke } from '@tauri-apps/api/tauri';
import { generateFileId, getDefaultFormat, getDefaultSettings } from '@/utils';
import type { FileItem, MediaInfo } from '@/types';

const BATCH_SIZE = 10;

export async function processFilePaths(paths: string[]): Promise<FileItem[]> {
  const results: FileItem[] = [];
  const errors: string[] = [];

  // Process in batches to avoid blocking UI
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(path => processFile(path))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(String(result.reason));
      }
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to process ${errors.length} file(s):`, errors);
  }

  return results;
}

async function processFile(path: string): Promise<FileItem> {
  const mediaInfo = await invoke<MediaInfo>('detect_media_type', { path });
  const name = path.split(/[\\/]/).pop() || 'unknown';

  return {
    id: generateFileId(),
    path,
    name,
    mediaInfo,
    outputFormat: getDefaultFormat(mediaInfo.media_type),
    settings: getDefaultSettings(false),
    status: 'pending',
    progress: null,
    error: null,
    addedAt: Date.now(),
  };
}