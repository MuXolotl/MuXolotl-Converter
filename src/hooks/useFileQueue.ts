import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileItem } from '@/types';
import { generateOutputPath, saveQueue, loadQueue, clearQueue as clearStorageQueue, sortFilesByStatus } from '@/utils';

const MAX_FILES = 50;
const AUTOSAVE_INTERVAL = 5000;

export const useFileQueue = (outputFolder: string) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const filesRef = useRef<FileItem[]>(files); // Для доступа внутри интервалов/колбэков без зависимостей

  // Sync ref
  useEffect(() => { filesRef.current = files; }, [files]);

  // Load on mount
  useEffect(() => {
    const loaded = loadQueue();
    if (loaded.length > 0) {
      setFiles(loaded);
      console.log(`📂 Loaded ${loaded.length} files from storage`);
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
    setFiles(prev => prev.map(f => {
      if (f.status === 'pending' && !f.outputPath) {
        return { ...f, outputPath: generateOutputPath(f, outputFolder) };
      }
      return f;
    }));
  }, [outputFolder]);

  const addFiles = useCallback((newFiles: FileItem[]) => {
    setFiles(current => {
      const available = MAX_FILES - current.length;
      if (available <= 0) return current;

      const existingPaths = new Set(current.map(f => f.path));
      const unique = newFiles.filter(f => !existingPaths.has(f.path));
      const toAdd = unique.slice(0, available);
      
      if (toAdd.length === 0) return current;

      const processed = outputFolder 
        ? toAdd.map(f => ({ ...f, outputPath: generateOutputPath(f, outputFolder) }))
        : toAdd;

      return [...processed, ...current];
    });
  }, [outputFolder]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    clearStorageQueue();
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      
      const updated = { ...f, ...updates };
      
      // Auto-update output path if format changes and folder is set
      if (outputFolder && updated.status === 'pending' && updates.outputFormat && !updates.outputPath) {
        updated.outputPath = generateOutputPath(updated, outputFolder);
      }
      
      return updated;
    }));
  }, [outputFolder]);

  const retryFile = useCallback((id: string) => {
    updateFile(id, {
      status: 'pending',
      progress: null,
      error: null,
      completedAt: undefined
    });
  }, [updateFile]);

  const sortedFiles = useMemo(() => sortFilesByStatus(files), [files]);

  return {
    files,
    sortedFiles,
    addFiles,
    removeFile,
    updateFile,
    clearAll,
    retryFile,
    filesRef // Экспортируем ref для использования в логике конвертации
  };
};