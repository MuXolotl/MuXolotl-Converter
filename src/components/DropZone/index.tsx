import React, { useCallback, useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import { MEDIA_EXTENSIONS } from '@/constants';
import { processFilePaths } from '@/utils/fileHelpers';
import type { FileItem } from '@/types';

interface DropZoneProps {
  onFilesAdded: (files: FileItem[]) => void;
  currentCount: number;
  maxCount: number;
}

const DropZone: React.FC<DropZoneProps> = ({ onFilesAdded, currentCount, maxCount }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;

    setIsProcessing(true);
    try {
      const files = await processFilePaths(paths);
      if (files.length > 0) {
        onFilesAdded(files);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [onFilesAdded]);

  const handleBrowse = useCallback(async () => {
    if (currentCount >= maxCount) return;

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
  }, [handlePaths, currentCount, maxCount]);

  // Native file drop listener
  useEffect(() => {
    const unlisten = listen<string[]>('tauri://file-drop', async event => {
      await handlePaths(event.payload);
    });

    const unlistenHover = listen('tauri://file-drop-hover', () => setIsDragging(true));
    const unlistenCancel = listen('tauri://file-drop-cancelled', () => setIsDragging(false));

    return () => {
      unlisten.then(fn => fn());
      unlistenHover.then(fn => fn());
      unlistenCancel.then(fn => fn());
    };
  }, [handlePaths]);

  const isFull = currentCount >= maxCount;

  return (
    <div
      onClick={isFull || isProcessing ? undefined : handleBrowse}
      className={`w-full max-w-md h-64 flex flex-col items-center justify-center gap-4 
        border-2 border-dashed rounded-xl transition-all cursor-pointer
        ${isFull
          ? 'border-red-500/30 bg-red-500/5 cursor-not-allowed'
          : isDragging
            ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
            : isProcessing
              ? 'border-purple-500/50 bg-purple-500/5'
              : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
        }`}
    >
      <div className={`p-4 rounded-full transition-colors ${
        isDragging ? 'bg-purple-500/20' : 'bg-white/5'
      }`}>
        {isProcessing ? (
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        ) : (
          <Upload size={32} className={isFull ? 'text-red-400' : 'text-white/40'} />
        )}
      </div>

      <div className="text-center">
        <p className={`text-lg font-semibold ${isFull ? 'text-red-400' : 'text-white'}`}>
          {isFull ? 'Queue is full' : isProcessing ? 'Processing...' : 'Drop files here'}
        </p>
        <p className="text-sm text-white/40 mt-1">
          {isFull
            ? `Maximum ${maxCount} files`
            : 'or click to browse'
          }
        </p>
      </div>
    </div>
  );
};

export default React.memo(DropZone);