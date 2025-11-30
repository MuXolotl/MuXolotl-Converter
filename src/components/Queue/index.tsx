import React, { useCallback } from 'react';
import { FileItem } from '@/types';
import QueueItem from './QueueItem';
import { Upload } from 'lucide-react';
import DropZone from '@/components/DropZone';
import { open } from '@tauri-apps/api/dialog'; // Import Dialog
import { MEDIA_EXTENSIONS } from '@/constants';
import { processFilePaths } from '@/utils/fileHelpers'; // Shared logic

interface QueueProps {
  files: FileItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFilesAdded: (files: FileItem[]) => void;
}

const Queue: React.FC<QueueProps> = ({ files, selectedId, onSelect, onFilesAdded }) => {
  
  // Handler for "Add more files" button
  const handleAddMore = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media Files', extensions: [...MEDIA_EXTENSIONS] }]
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const newFiles = await processFilePaths(paths);
        if (newFiles.length > 0) {
          onFilesAdded(newFiles);
        }
      }
    } catch (error) {
      console.error('Failed to add files:', error);
    }
  }, [onFilesAdded]);

  if (files.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-xl h-64">
          <DropZone onFilesAdded={onFilesAdded} currentCount={0} maxCount={50} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black/10">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-white/10 bg-white/5 text-[10px] uppercase font-bold text-white/40 tracking-wider shrink-0">
        <div className="w-12">Type</div>
        <div className="flex-1">Filename</div>
        <div className="w-24 text-center">Format</div>
        <div className="w-32 text-right">Status</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {files.map((file) => (
          <QueueItem
            key={file.id}
            file={file}
            isSelected={selectedId === file.id}
            onClick={() => onSelect(file.id)}
          />
        ))}
        
        {/* Drop Area / Add Button at bottom */}
        <div className="p-4">
            <button 
                onClick={handleAddMore}
                className="w-full py-3 border border-dashed border-white/10 rounded-lg text-white/30 text-xs hover:bg-white/5 hover:text-white/60 hover:border-white/20 transition-all flex items-center justify-center gap-2"
            >
                <Upload size={14} />
                Add more files...
            </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Queue);