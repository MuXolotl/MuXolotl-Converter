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

  // --- Derived (getters auto-track $state dependencies in templates) ---

  get sortedFiles(): FileItem[] {
    return sortFilesByStatus(this.files);
  }

  get stats(): QueueStats {
    return getQueueStats(this.files);
  }

  get pendingFiles(): FileItem[] {
    return this.files.filter(f => f.status === 'pending');
  }

  // --- Initialization ---

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

  // --- Output folder ---

  setOutputFolder(folder: string) {
    this.outputFolder = folder;
    saveOutputFolder(folder);

    // Update pending files that don't have an output path yet
    if (folder) {
      this.files = this.files.map(f => {
        if (f.status === 'pending' && !f.outputPath) {
          return { ...f, outputPath: generateOutputPath(f, folder) };
        }
        return f;
      });
      this.#scheduleSave();
    }
  }

  // --- Queue operations ---

  addFiles(newFiles: FileItem[]) {
    const available = APP_CONFIG.limits.maxQueueSize - this.files.length;
    if (available <= 0) return;

    const existingPaths = new Set(this.files.map(f => f.path));
    const unique = newFiles.filter(f => !existingPaths.has(f.path));
    const toAdd = unique.slice(0, available);

    if (toAdd.length === 0) return;

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
    this.updateFile(id, {
      status: 'pending',
      progress: null,
      error: null,
      completedAt: undefined,
    });
  }

  /**
   * Reset all completed, failed, and cancelled files back to pending.
   * Allows re-converting them with new settings/formats.
   */
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
        outputPath: undefined,
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

  /**
   * Copy format and settings from the source file to all other pending files
   * of the same media type (audio → audio, video → video).
   *
   * @param sourceId - ID of the file whose settings should be copied
   */
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

  // --- Persistence (debounced) ---

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