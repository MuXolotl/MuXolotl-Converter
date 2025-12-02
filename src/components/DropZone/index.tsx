import { memo, useCallback, useState, useEffect } from 'react';
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
  compact?: boolean;
}

function DropZone({ onFilesAdded, currentCount, maxCount, compact = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setIsProcessing(true);
    try {
      const files = await processFilePaths(paths);
      if (files.length > 0) onFilesAdded(files);
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
        await handlePaths(Array.isArray(selected) ? selected : [selected]);
      }
    } catch (error) {
      console.error('File selection error:', error);
    }
  }, [handlePaths, currentCount, maxCount]);

  useEffect(() => {
    const unlistenDrop = listen<string[]>('tauri://file-drop', async event => {
      await handlePaths(event.payload);
    });
    const unlistenHover = listen('tauri://file-drop-hover', () => setIsDragging(true));
    const unlistenCancel = listen('tauri://file-drop-cancelled', () => setIsDragging(false));

    return () => {
      unlistenDrop.then(fn => fn());
      unlistenHover.then(fn => fn());
      unlistenCancel.then(fn => fn());
    };
  }, [handlePaths]);

  const isFull = currentCount >= maxCount;
  const isDisabled = isFull || isProcessing;

  if (compact) {
    return (
      <div
        onClick={isDisabled ? undefined : handleBrowse}
        className={`w-full py-2 flex items-center justify-center gap-2 border border-dashed rounded transition-all cursor-pointer ${
          isFull
            ? 'border-red-500/30 opacity-50 cursor-not-allowed'
            : isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-white/10 hover:border-blue-500/30 hover:bg-white/5'
        }`}
      >
        <Upload size={14} className="text-white/40" />
        <span className="text-xs text-white/40 font-medium">Add more files...</span>
      </div>
    );
  }

  return (
    <div
      onClick={isDisabled ? undefined : handleBrowse}
      className={`w-full py-12 flex flex-col items-center justify-center gap-4 border border-dashed rounded-xl transition-all cursor-pointer bg-[#0f172a]/50 ${
        isFull
          ? 'border-red-500/30 cursor-not-allowed opacity-50'
          : isDragging
            ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
            : isProcessing
              ? 'border-blue-500/50'
              : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5'
      }`}
    >
      <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/30'}`}>
        {isProcessing ? (
          <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload size={32} />
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-white/80">
          {isFull ? 'Queue Full' : isProcessing ? 'Analyzing...' : 'Drop files here'}
        </p>
        <p className="text-sm text-white/40 mt-1">or click to browse</p>
      </div>
    </div>
  );
}

export default memo(DropZone);