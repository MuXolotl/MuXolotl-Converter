import type { FileItem, FileSettings, MediaType } from '@/types';

// ============================================================================
// FILE OPERATIONS
// ============================================================================

let idCounter = 0;

export const generateFileId = (): string => {
  idCounter = (idCounter + 1) % 10000;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 9)}`;
};

export const generateOutputPath = (file: FileItem, folder: string): string => {
  const lastDotIndex = file.name.lastIndexOf('.');
  const inputName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
  
  // Determine separator: prefer backslash if any exist, otherwise use forward slash
  const hasBackslash = folder.includes('\\');
  const separator = hasBackslash ? '\\' : '/';
  
  // Normalize folder path (remove trailing separator)
  const normalizedFolder = folder.replace(/[\\/]+$/, '');
  
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

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

export const getDefaultFormat = (mediaType: MediaType | string): string => {
  return mediaType === 'audio' ? 'mp3' : 'mp4';
};

export const truncatePath = (path: string, maxLength: number = 25): string => {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return path.substring(0, maxLength - 3) + '...';
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
};

export const formatETA = (seconds: number | null | undefined): string => {
  if (seconds == null || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

// ============================================================================
// STORAGE (LocalStorage)
// ============================================================================

const STORAGE_KEY = 'muxolotl_queue';
const OUTPUT_FOLDER_KEY = 'muxolotl_output_folder';
const STORAGE_VERSION = 1;
const MAX_QUEUE_AGE_DAYS = 7;

interface StorageData {
  version: number;
  files: FileItem[];
  timestamp: number;
}

export const saveQueue = (files: FileItem[]): void => {
  try {
    const filesToSave = files.map(file =>
      file.status === 'processing' ? { ...file, status: 'pending' as const, progress: null } : file
    );

    const data: StorageData = {
      version: STORAGE_VERSION,
      files: filesToSave,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save queue:', error);
  }
};

export const loadQueue = (): FileItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const data: StorageData = JSON.parse(saved);

    if (data.version !== STORAGE_VERSION) {
      console.warn('Queue version mismatch, clearing...');
      clearQueue();
      return [];
    }

    const maxAge = Date.now() - MAX_QUEUE_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (data.timestamp < maxAge) {
      console.info(`Queue older than ${MAX_QUEUE_AGE_DAYS} days, clearing...`);
      clearQueue();
      return [];
    }

    return data.files;
  } catch (error) {
    console.error('Failed to load queue:', error);
    return [];
  }
};

export const clearQueue = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Cleared queue from storage');
  } catch (error) {
    console.error('Failed to clear queue:', error);
  }
};

export const saveOutputFolder = (path: string): void => {
  try {
    if (!path) {
      localStorage.removeItem(OUTPUT_FOLDER_KEY);
      return;
    }
    localStorage.setItem(OUTPUT_FOLDER_KEY, path);
    console.log('💾 Saved output folder:', path);
  } catch (error) {
    console.error('Failed to save output folder:', error);
  }
};

export const loadOutputFolder = (): string => {
  try {
    const saved = localStorage.getItem(OUTPUT_FOLDER_KEY);
    if (saved) {
      console.log('✅ Loaded output folder:', saved);
    }
    return saved || '';
  } catch (error) {
    console.error('Failed to load output folder:', error);
    return '';
  }
};