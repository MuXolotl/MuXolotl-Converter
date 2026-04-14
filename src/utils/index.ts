import { invoke } from '@tauri-apps/api/core';
import { APP_CONFIG } from '@/config';
import type { FileItem, FileSettings, MediaType, ConversionStatus, QueueStats, SystemInfo, MediaInfo } from '@/types';

let idCounter = 0;

export function generateFileId(): string {
  idCounter = (idCounter + 1) % 10000;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate output path for a file conversion.
 *
 * Uses standard naming: `basename.newext`. Collisions are resolved
 * by appending `_1`, `_2`, etc. suffixes — same approach as most
 * popular converters (HandBrake, fre:ac, foobar2000).
 */
export function generateOutputPath(file: FileItem, folder: string, existingPaths?: Set<string>): string {
  const lastDot = file.name.lastIndexOf('.');
  const baseName = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
  const outputExt = file.outputFormat.toLowerCase();
  const separator = folder.includes('\\') ? '\\' : '/';
  const normalizedFolder = folder.replace(/[\\/]+$/, '');

  let candidate = `${normalizedFolder}${separator}${baseName}.${outputExt}`;

  // Collision avoidance: add _1, _2, ... suffix if path already taken
  if (existingPaths) {
    let counter = 1;
    while (existingPaths.has(candidate)) {
      candidate = `${normalizedFolder}${separator}${baseName}_${counter}.${outputExt}`;
      counter++;
    }
  }

  return candidate;
}

export function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return `${path.substring(0, maxLength - 3)}...`;
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

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

const STATUS_PRIORITY: Record<ConversionStatus, number> = {
  processing: 0,
  pending: 1,
  cancelled: 2,
  failed: 3,
  completed: 4,
};

export function sortFilesByStatus(files: FileItem[]): FileItem[] {
  return [...files].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    if (['completed', 'failed', 'cancelled'].includes(a.status)) {
      return (b.completedAt || 0) - (a.completedAt || 0);
    }
    return (b.addedAt || 0) - (a.addedAt || 0);
  });
}

export function getQueueStats(files: FileItem[]): QueueStats {
  return {
    total: files.length,
    pending: files.filter(f => f.status === 'pending').length,
    processing: files.filter(f => f.status === 'processing').length,
    completed: files.filter(f => f.status === 'completed').length,
    failed: files.filter(f => f.status === 'failed').length,
  };
}

export function getSystemInfo(): SystemInfo {
  const ua = navigator.userAgent;
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return {
    os,
    platform: navigator.platform,
    language: navigator.language,
  };
}

// ============ File processing ============

const FILE_BATCH_SIZE = 10;

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

// ============ Queue persistence ============

interface StorageData {
  version: number;
  files: FileItem[];
  timestamp: number;
}

export function saveQueue(files: FileItem[]): void {
  try {
    const filesToSave = files.map(file =>
      file.status === 'processing'
        ? { ...file, status: 'pending' as const, progress: null }
        : file
    );
    const data: StorageData = {
      version: APP_CONFIG.storage.version,
      files: filesToSave,
      timestamp: Date.now(),
    };
    localStorage.setItem(APP_CONFIG.storage.keys.queue, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save queue:', error);
  }
}

export function loadQueue(): FileItem[] {
  try {
    const saved = localStorage.getItem(APP_CONFIG.storage.keys.queue);
    if (!saved) return [];
    const data: StorageData = JSON.parse(saved);
    if (data.version !== APP_CONFIG.storage.version) {
      clearQueue();
      return [];
    }
    const maxAge = Date.now() - APP_CONFIG.limits.queuePersistenceDays * 24 * 60 * 60 * 1000;
    if (data.timestamp < maxAge) {
      clearQueue();
      return [];
    }
    return data.files;
  } catch (error) {
    console.error('Failed to load queue:', error);
    return [];
  }
}

export function clearQueue(): void {
  localStorage.removeItem(APP_CONFIG.storage.keys.queue);
}

export function saveOutputFolder(path: string): void {
  if (path) {
    localStorage.setItem(APP_CONFIG.storage.keys.outputFolder, path);
  } else {
    localStorage.removeItem(APP_CONFIG.storage.keys.outputFolder);
  }
}

export function loadOutputFolder(): string {
  return localStorage.getItem(APP_CONFIG.storage.keys.outputFolder) || '';
}