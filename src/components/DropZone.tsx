import React, { useCallback, useState, useEffect } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { MEDIA_EXTENSIONS } from '@/constants';
import { getDefaultFormat, getDefaultSettings, generateFileId } from '@/utils';
import type { FileItem, MediaInfo } from '@/types';

interface DropZoneProps {
  onFilesAdded: (files: FileItem[]) => void;
}

const DropZone: React.FC<DropZoneProps> = React.memo(({ onFilesAdded }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    async (paths: string[]) => {
      const results = await Promise.allSettled(
        paths.map(async (path) => {
          const mediaInfo = await invoke<MediaInfo>('detect_media_type', { path });
          const fileName = path.split(/[\\/]/).pop() || path;
          return {
            id: generateFileId(),
            path,
            name: fileName,
            mediaInfo,
            outputFormat: getDefaultFormat(mediaInfo.media_type),
            settings: getDefaultSettings(mediaInfo.media_type, false),
            status: 'pending' as const,
            progress: null,
            error: null,
            addedAt: Date.now(),
          };
        })
      );

      const fileItems: FileItem[] = [];
      const errors: string[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          fileItems.push(result.value);
        } else {
          errors.push(result.reason);
        }
      });

      if (fileItems.length > 0) onFilesAdded(fileItems);

      if (errors.length > 0) {
        alert(`Failed to process ${errors.length} file(s): ${errors[0]}`);
      }
    },
    [onFilesAdded]
  );

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
      const paths = files.map((f) => f.path).filter(Boolean);
      if (paths.length > 0) await processFiles(paths);
    },
    [processFiles]
  );

  useEffect(() => {
    const unlisten = listen<string[]>('tauri://file-drop', async (event) => {
      await processFiles(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [processFiles]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleBrowse}
      className={`glass px-6 py-4 flex items-center justify-between gap-4 h-full cursor-pointer transition-all duration-200 border-2 border-dashed rounded-xl
        ${isDragging ? 'border-primary-purple bg-primary-purple/10 scale-[1.01]' : 'border-white/20 hover:border-primary-pink/50'}`}
    >
      <div className="flex items-center gap-4">
        <Upload
          size={32}
          className={`transition-all ${isDragging ? 'text-primary-purple scale-110' : 'text-white/40'}`}
        />
        <div>
          <p className="text-white text-lg font-bold">Drop media files here</p>
          <p className="text-white/60 text-sm">Audio & Video • 40+ formats supported</p>
        </div>
      </div>

      <button
        onClick={handleBrowse}
        className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all font-semibold text-white flex-shrink-0"
      >
        <FolderOpen size={20} />
        <span>Browse Files</span>
      </button>
    </div>
  );
});

DropZone.displayName = 'DropZone';

export default DropZone;
