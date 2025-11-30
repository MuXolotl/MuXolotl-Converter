import React, { useCallback, useState, useEffect } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import { MEDIA_EXTENSIONS } from '@/constants';
import { processFilePaths } from '@/utils/fileHelpers'; // NEW Import
import type { FileItem } from '@/types';

interface DropZoneProps {
  onFilesAdded: (files: FileItem[]) => void;
  currentCount: number;
  maxCount: number;
}

const DropZone: React.FC<DropZoneProps> = ({ onFilesAdded, currentCount, maxCount }) => {
  const [isDragging, setIsDragging] = useState(false);

  // Generic handler for paths (from drag or dialog)
  const handlePaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    
    const processedFiles = await processFilePaths(paths);
    if (processedFiles.length > 0) {
      onFilesAdded(processedFiles);
    }
  }, [onFilesAdded]);

  const handleBrowse = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media Files', extensions: [...MEDIA_EXTENSIONS] }],
      });
      
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await handlePaths(paths);
      }
    } catch (error) {
      console.error('File selection error:', error);
    }
  }, [handlePaths]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Web standard file drop (rare in Tauri but good fallback)
    // But Tauri has a specific event for OS file drops which we handle in useEffect below
    // This handler is mostly for "Browser" drag-n-drop behavior if not intercepted by OS
    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[];
    const paths = files.map(f => f.path).filter((p): p is string => !!p);
    
    if (paths.length > 0) await handlePaths(paths);
  }, [handlePaths]);

  // Native OS File Drop Listener
  useEffect(() => {
    const unlisten = listen<string[]>('tauri://file-drop', async (event) => {
      await handlePaths(event.payload);
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [handlePaths]);

  const isFull = currentCount >= maxCount;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={isFull ? undefined : handleBrowse}
      className={`
        h-full w-full flex flex-col items-center justify-center gap-4 
        border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
        ${isFull 
          ? 'border-red-500/30 bg-red-500/5 cursor-not-allowed' 
          : isDragging 
            ? 'border-primary-purple bg-primary-purple/10 scale-[1.01]' 
            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        }
      `}
    >
      <div className={`p-4 rounded-full ${isDragging ? 'bg-primary-purple/20' : 'bg-white/5'}`}>
        <Upload 
          size={32} 
          className={`transition-colors ${isFull ? 'text-red-400' : isDragging ? 'text-primary-purple' : 'text-white/40'}`} 
        />
      </div>
      
      <div className="text-center">
        <p className={`text-lg font-bold ${isFull ? 'text-red-400' : 'text-white'}`}>
          {isFull ? 'Queue is full' : 'Drop files here'}
        </p>
        <p className="text-sm text-white/40 mt-1">
          or click to browse
        </p>
      </div>

      {!isFull && (
        <button
          onClick={handleBrowse}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2"
        >
          <FolderOpen size={16} />
          Select Files
        </button>
      )}
    </div>
  );
};

export default React.memo(DropZone);