import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MAX_QUEUE_SIZE } from '@/constants';
import {
  generateOutputPath,
  saveQueue,
  loadQueue,
  clearQueue as clearStorageQueue,
  sortFilesByStatus,
  getQueueStats,
} from '@/utils';
import type { FileItem } from '@/types';

const AUTOSAVE_INTERVAL = 5000;

export function useFileQueue(outputFolder: string) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const filesRef = useRef<FileItem[]>(files);

  // Keep ref in sync
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Load saved queue on mount
  useEffect(() => {
    const loaded = loadQueue();
    if (loaded.length > 0) {
      setFiles(loaded);
    }
  }, []);

  // Autosave
  useEffect(() => {
    const interval = setInterval(() => {
      if (filesRef.current.length > 0) {
        saveQueue(filesRef.current);
      }
    }, AUTOSAVE_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  // Update output paths when folder changes
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
      const available = MAX_QUEUE_SIZE - current.length;
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
    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
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
  const stats = useMemo(() => getQueueStats(files), [files]);
  const pendingFiles = useMemo(
    () => files.filter(f => f.status === 'pending'),
    [files]
  );

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