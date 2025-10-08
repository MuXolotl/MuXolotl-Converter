import type { FileItem } from '@/types';

const STORAGE_KEY = 'muxolotl_queue';
const OUTPUT_FOLDER_KEY = 'muxolotl_output_folder';
const STORAGE_VERSION = 1;

interface StorageData {
  version: number;
  files: FileItem[];
  timestamp: number;
}

export const saveQueue = (files: FileItem[]): void => {
  try {
    // Don't save processing files (they will be reset to pending)
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

    // Version check
    if (data.version !== STORAGE_VERSION) {
      console.warn('Queue version mismatch, clearing...');
      clearQueue();
      return [];
    }

    // Don't load if older than 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (data.timestamp < weekAgo) {
      console.info('Queue is older than 7 days, clearing...');
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
      console.log('✅ Restored output folder:', saved);
      return saved;
    }
    return '';
  } catch (error) {
    console.error('Failed to load output folder:', error);
    return '';
  }
};

export const clearOutputFolder = (): void => {
  try {
    localStorage.removeItem(OUTPUT_FOLDER_KEY);
    console.log('🗑️ Cleared output folder');
  } catch (error) {
    console.error('Failed to clear output folder:', error);
  }
};
