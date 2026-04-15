/**
 * Queue and preferences persistence via localStorage.
 */

import { APP_CONFIG } from '@/config';
import type { FileItem } from '@/types';

interface StorageData {
  version: number;
  files: FileItem[];
  timestamp: number;
}

export function saveQueue(files: FileItem[]): void {
  try {
    const filesToSave = files.map((file) =>
      file.status === 'processing'
        ? { ...file, status: 'pending' as const, progress: null }
        : file,
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
    const maxAge =
      Date.now() -
      APP_CONFIG.limits.queuePersistenceDays * 24 * 60 * 60 * 1000;
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