import { invoke } from '@tauri-apps/api/core';
import { APP_CONFIG } from '@/config';
import {
  generateOutputPath,
  saveQueue,
  loadQueue,
  clearQueue as clearStorageQueue,
  sortFilesByStatus,
  getQueueStats,
  loadOutputFolder,
  saveOutputFolder,
} from '@/utils';
import type { FileItem, QueueStats } from '@/types';

class FileQueueStore {
  files: FileItem[] = $state([]);
  outputFolder = $state('');
  #saveTimeout: ReturnType<typeof setTimeout> | null = null;

  get sortedFiles(): FileItem[] {
    return sortFilesByStatus(this.files);
  }

  get stats(): QueueStats {
    return getQueueStats(this.files);
  }

  get pendingFiles(): FileItem[] {
    return this.files.filter(f => f.status === 'pending');
  }

  init() {
    const loaded = loadQueue();
    if (loaded.length > 0) {
      this.files = loaded;
    }

    const folder = loadOutputFolder();
    if (folder) {
      this.outputFolder = folder;
    }
  }

  async validateOnStartup() {
    if (this.outputFolder) {
      try {
        const folderExists = await invoke<boolean>('check_paths_exist', {
          paths: [this.outputFolder],
        });
        if (!folderExists[0]) {
          this.setOutputFolder('');
        }
      } catch {
        this.setOutputFolder('');
      }
    }

    const filesToCheck = this.files.filter(
      f => f.status === 'pending' || f.status === 'processing'
    );

    if (filesToCheck.length === 0) return;

    try {
      const paths = filesToCheck.map(f => f.path);
      const existenceMap = await invoke<boolean[]>('check_paths_exist', { paths });

      let changed = false;
      this.files = this.files.map(f => {
        if (f.status !== 'pending' && f.status !== 'processing') return f;

        const index = filesToCheck.findIndex(ftc => ftc.id === f.id);
        if (index !== -1 && !existenceMap[index]) {
          changed = true;
          return {
            ...f,
            status: 'failed' as const,
            error: 'Source file not found',
            progress: null,
          };
        }
        return f;
      });

      if (changed) this.#scheduleSave();
    } catch (e) {
      console.error('Failed to validate files on startup:', e);
    }
  }

  setOutputFolder(folder: string) {
    this.outputFolder = folder;
    saveOutputFolder(folder);

    if (folder) {
      this.files = this.files.map(f => {
        if (f.status === 'pending' || !f.outputPath) {
          return { ...f, outputPath: generateOutputPath(f, folder) };
        }
        return f;
      });
      this.#scheduleSave();
    }
  }

  addFiles(newFiles: FileItem[]) {
    const available = APP_CONFIG.limits.maxQueueSize - this.files.length;
    if (available <= 0) return;

    const existingPaths = new Set(this.files.map(f => f.path));
    const unique = newFiles.filter(f => !existingPaths.has(f.path));
    const toAdd = unique.slice(0, available);

    if (toAdd.length === 0) return;

    if (this.outputFolder) {
      for (const file of toAdd) {
        file.outputPath = generateOutputPath(file, this.outputFolder);
      }
    }

    this.files = [...toAdd, ...this.files];
    this.#scheduleSave();
  }

  removeFile(id: string) {
    this.files = this.files.filter(f => f.id !== id);
    this.#scheduleSave();
  }

  updateFile(id: string, updates: Partial<FileItem>) {
    this.files = this.files.map(f => (f.id === id ? { ...f, ...updates } : f));
    this.#scheduleSave();
  }

  retryFile(id: string) {
    const file = this.files.find(f => f.id === id);
    if (!file) return;

    this.updateFile(id, {
      status: 'pending',
      progress: null,
      error: null,
      completedAt: undefined,
    });
  }

  retryAll() {
    const retryStatuses = new Set(['completed', 'failed', 'cancelled']);
    let changed = false;

    this.files = this.files.map(f => {
      if (!retryStatuses.has(f.status)) return f;
      changed = true;
      return {
        ...f,
        status: 'pending' as const,
        progress: null,
        error: null,
        completedAt: undefined,
      };
    });

    if (changed) this.#scheduleSave();
  }

  clearCompleted() {
    this.files = this.files.filter(f => f.status !== 'completed');
    this.#scheduleSave();
  }

  clearAll() {
    this.files = [];
    if (this.#saveTimeout) clearTimeout(this.#saveTimeout);
    clearStorageQueue();
  }

  applySettingsToAll(sourceId: string) {
    const source = this.files.find(f => f.id === sourceId);
    if (!source || source.status !== 'pending' || !source.mediaInfo) return;

    const sourceType = source.mediaInfo.media_type;
    if (sourceType === 'unknown') return;

    const sourceFormat = source.outputFormat;
    const sourceSettings = { ...source.settings };

    this.files = this.files.map(f => {
      if (f.id === sourceId) return f;
      if (f.status !== 'pending') return f;
      if (!f.mediaInfo || f.mediaInfo.media_type !== sourceType) return f;

      const updated: FileItem = {
        ...f,
        outputFormat: sourceFormat,
        settings: { ...sourceSettings },
        outputPath: undefined,
      };

      if (this.outputFolder) {
        updated.outputPath = generateOutputPath(updated, this.outputFolder);
      }

      return updated;
    });

    this.#scheduleSave();
  }

  #scheduleSave() {
    if (this.#saveTimeout) clearTimeout(this.#saveTimeout);
    this.#saveTimeout = setTimeout(() => {
      if (this.files.length > 0) {
        saveQueue(this.files);
      } else {
        clearStorageQueue();
      }
    }, APP_CONFIG.limits.autosaveDebounceMs);
  }
}

export const fileQueueStore = new FileQueueStore();