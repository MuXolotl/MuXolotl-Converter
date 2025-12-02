import type { FileItem, FileSettings, MediaType, ConversionStatus } from '@/types';

// ===== ID Generation =====

let idCounter = 0;

export function generateFileId(): string {
  idCounter = (idCounter + 1) % 10000;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ===== Path Utilities =====

export function generateOutputPath(file: FileItem, folder: string): string {
  const lastDot = file.name.lastIndexOf('.');
  const baseName = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
  const separator = folder.includes('\\') ? '\\' : '/';
  const normalizedFolder = folder.replace(/[\\/]+$/, '');
  
  return `${normalizedFolder}${separator}${baseName}.${file.outputFormat}`;
}

export function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return `${path.substring(0, maxLength - 3)}...`;
  
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

// ===== Formatting =====

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

export function formatETA(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  
  if (m < 60) return `${m}m ${s}s`;
  
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ===== Defaults =====

export function getDefaultFormat(mediaType: MediaType | string): string {
  return mediaType === 'audio' ? 'mp3' : 'mp4';
}

export function getDefaultSettings(gpuAvailable = false): FileSettings {
  return {
    quality: 'medium',
    useGpu: true, // Always default to true, logic handles availability check
    extractAudioOnly: false,
    sampleRate: 44100,
    channels: 2,
  };
}

// ===== Sorting =====

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

    // For finished items, sort by completion time (newest first)
    if (['completed', 'failed', 'cancelled'].includes(a.status)) {
      return (b.completedAt || 0) - (a.completedAt || 0);
    }

    // For pending, sort by added time (newest first)
    return (b.addedAt || 0) - (a.addedAt || 0);
  });
}

// ===== Queue Statistics =====

export function getQueueStats(files: FileItem[]) {
  return {
    total: files.length,
    pending: files.filter(f => f.status === 'pending').length,
    processing: files.filter(f => f.status === 'processing').length,
    completed: files.filter(f => f.status === 'completed').length,
    failed: files.filter(f => f.status === 'failed').length,
  };
}

// ===== Storage =====

const STORAGE_KEYS = {
  queue: 'muxolotl_queue',
  outputFolder: 'muxolotl_output_folder',
} as const;

const STORAGE_VERSION = 1;
const MAX_QUEUE_AGE_DAYS = 7;

interface StorageData {
  version: number;
  files: FileItem[];
  timestamp: number;
}

export function saveQueue(files: FileItem[]): void {
  try {
    // Reset processing files to pending
    const filesToSave = files.map(file =>
      file.status === 'processing'
        ? { ...file, status: 'pending' as const, progress: null }
        : file
    );

    const data: StorageData = {
      version: STORAGE_VERSION,
      files: filesToSave,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save queue:', error);
  }
}

export function loadQueue(): FileItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.queue);
    if (!saved) return [];

    const data: StorageData = JSON.parse(saved);

    // Version check
    if (data.version !== STORAGE_VERSION) {
      clearQueue();
      return [];
    }

    // Age check
    const maxAge = Date.now() - MAX_QUEUE_AGE_DAYS * 24 * 60 * 60 * 1000;
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
  localStorage.removeItem(STORAGE_KEYS.queue);
}

export function saveOutputFolder(path: string): void {
  if (path) {
    localStorage.setItem(STORAGE_KEYS.outputFolder, path);
  } else {
    localStorage.removeItem(STORAGE_KEYS.outputFolder);
  }
}

export function loadOutputFolder(): string {
  return localStorage.getItem(STORAGE_KEYS.outputFolder) || '';
}