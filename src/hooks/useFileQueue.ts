import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { APP_CONFIG } from '@/config';
import {
  generateOutputPath,
  saveQueue,
  loadQueue,
  clearQueue as clearStorageQueue,
  sortFilesByStatus,
  getQueueStats,
} from '@/utils';
import type { FileItem, QueueStats } from '@/types';

export function useFileQueue(outputFolder: string) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const filesRef = useRef<FileItem[]>(files);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const loaded = loadQueue();
    if (loaded.length > 0) {
      setFiles(loaded);
    }
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (files.length > 0) {
        saveQueue(files);
      } else {
        clearStorageQueue();
      }
    }, APP_CONFIG.limits.autosaveDebounceMs);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [files]);

  useEffect(() => {
    if (!outputFolder) return;

    setFiles(prev =>
      prev.map(f => {
        if (f.status === 'pending' && !f.outputPath) {
          return { ...f, outputPath: generateOutputPath(f, outputFolder) };
        }
        return f;
      })
    );
  }, [outputFolder]);

  const addFiles = useCallback((newFiles: FileItem[]) => {
    setFiles(current => {
      const available = APP_CONFIG.limits.maxQueueSize - current.length;
      if (available <= 0) return current;

      const existingPaths = new Set(current.map(f => f.path));
      const unique = newFiles.filter(f => !existingPaths.has(f.path));
      const toAdd = unique.slice(0, available);

      if (toAdd.length === 0) return current;
      return [...toAdd, ...current];
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const retryFile = useCallback((id: string) => {
    updateFile(id, {
      status: 'pending',
      progress: null,
      error: null,
      completedAt: undefined,
    });
  }, [updateFile]);

  const clearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    clearStorageQueue();
  }, []);

  const sortedFiles = useMemo(() => sortFilesByStatus(files), [files]);
  const stats: QueueStats = useMemo(() => getQueueStats(files), [files]);
  const pendingFiles = useMemo(() => files.filter(f => f.status === 'pending'), [files]);

  return {
    files,
    sortedFiles,
    pendingFiles,
    stats,
    filesRef,
    addFiles,
    removeFile,
    updateFile,
    retryFile,
    clearCompleted,
    clearAll,
  };
}