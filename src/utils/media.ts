/**
 * Media file processing utilities.
 */

import { invoke } from '@tauri-apps/api/core';
import { generateFileId } from './paths';
import type { FileItem, FileSettings, MediaType, MediaInfo } from '@/types';

const FILE_BATCH_SIZE = 10;

export function getDefaultFormat(mediaType: MediaType | string): string {
  return mediaType === 'audio' ? 'mp3' : 'mp4';
}

export function getDefaultSettings(): FileSettings {
  return {
    quality: 'medium',
    useGpu: true,
    extractAudioOnly: false,
    sampleRate: 44100,
    channels: 2,
  };
}

/**
 * Process file paths into FileItem objects by probing media info via FFprobe.
 * Processes in batches to avoid overwhelming the backend.
 */
export async function processFilePaths(paths: string[]): Promise<FileItem[]> {
  const results: FileItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < paths.length; i += FILE_BATCH_SIZE) {
    const batch = paths.slice(i, i + FILE_BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(processFile));

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
    settings: getDefaultSettings(),
    status: 'pending',
    progress: null,
    error: null,
    addedAt: Date.now(),
  };
}