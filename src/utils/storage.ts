import type { FileItem } from '@/types';

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
