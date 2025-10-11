import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { MEDIA_EXTENSIONS } from '@/constants';
import { getDefaultFormat, generateFileId, getDefaultSettings } from '@/utils';
import type { FileItem, MediaInfo } from '@/types';

interface DropZoneProps {
  onFilesAdded: (files: FileItem[]) => void;
  currentCount: number;
  maxCount: number;
}

const MAX_PARALLEL_PROCESSING = 50;

const DropZone: React.FC<DropZoneProps> = ({ onFilesAdded, currentCount, maxCount }) => {
  const [isDragging, setIsDragging] = useState(false);
  const onFilesAddedRef = useRef(onFilesAdded);

  // Keep ref up-to-date
  useEffect(() => {
    onFilesAddedRef.current = onFilesAdded;
  }, [onFilesAdded]);

  const processFiles = useCallback(async (paths: string[]) => {
    const fileItems: FileItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < paths.length; i += MAX_PARALLEL_PROCESSING) {
      const chunk = paths.slice(i, i + MAX_PARALLEL_PROCESSING);

      const results = await Promise.allSettled(
        chunk.map(async path => {
          const mediaInfo = await invoke<MediaInfo>('detect_media_type', { path });
          const fileName = path.split(/[\\/]/).pop() || path;
          return {
            id: generateFileId(),
            path,
            name: fileName,
            mediaInfo,
            outputFormat: getDefaultFormat(mediaInfo.media_type),
            settings: getDefaultSettings(false),
            status: 'pending' as const,
            progress: null,
            error: null,
            addedAt: Date.now(),
          };
        })
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          fileItems.push(result.value);
        } else {
          errors.push(result.reason);
        }
      });
    }

    if (fileItems.length > 0) onFilesAddedRef.current(fileItems);

    if (errors.length > 0) {
      const errorMsg =
        errors.length === 1
          ? `Failed to process file: ${errors[0]}`
          : `Failed to process ${errors.length} files. First error: ${errors[0]}`;
      alert(errorMsg);
    }
  }, []);

  const handleBrowse = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      try {
        const selected = await open({
          multiple: true,
          filters: [{ name: 'Media Files', extensions: [...MEDIA_EXTENSIONS] }],
        });
        if (selected) {
          await processFiles(Array.isArray(selected) ? selected : [selected as string]);
        }
      } catch (error) {
        console.error('File selection error:', error);
      }
    },
    [processFiles]
  );

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

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files) as (File & { path: string })[];
      const paths = files.map(f => f.path).filter(Boolean);
      if (paths.length > 0) await processFiles(paths);
    },
    [processFiles]
  );

  useEffect(() => {
    const unlisten = listen<string[]>('tauri://file-drop', async event => {
      await processFiles(event.payload);
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [processFiles]);

  const isFull = currentCount >= maxCount;
  const countColor =
    currentCount >= maxCount * 0.9
      ? 'text-status-error'
      : currentCount >= maxCount * 0.7
        ? 'text-status-warning'
        : 'text-status-success';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={isFull ? undefined : handleBrowse}
      className={`glass px-6 py-4 flex items-center justify-between gap-4 h-full transition-all duration-200 border-2 border-dashed rounded-xl ${
        isFull
          ? 'border-red-500/50 bg-red-500/10 cursor-not-allowed'
          : isDragging
            ? 'border-primary-purple bg-primary-purple/10 scale-[1.01] cursor-pointer'
            : 'border-white/20 hover:border-primary-pink/50 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-4">
        <Upload
          size={32}
          className={`transition-all ${isFull ? 'text-red-500' : isDragging ? 'text-primary-purple scale-110' : 'text-white/40'}`}
        />
        <div>
          <div className="flex items-center gap-2">
            <p className={`text-lg font-bold ${isFull ? 'text-red-400' : 'text-white'}`}>
              {isFull ? 'Queue is full!' : 'Drop media files here'}
            </p>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${countColor} bg-white/10`}>
              {currentCount}/{maxCount}
            </span>
          </div>
          <p className="text-white/60 text-sm">
            {isFull ? 'Remove some files to add more' : 'Audio & Video • 40+ formats supported'}
          </p>
        </div>
      </div>

      {!isFull && (
        <button
          onClick={handleBrowse}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all font-semibold text-white flex-shrink-0"
        >
          <FolderOpen size={20} />
          <span>Browse Files</span>
        </button>
      )}
    </div>
  );
};

export default React.memo(DropZone);