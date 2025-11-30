import React, { useCallback, useMemo } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
import { MEDIA_EXTENSIONS, MAX_QUEUE_SIZE } from '@/constants';
import { processFilePaths } from '@/utils/fileHelpers';
import QueueItem from './QueueItem';
import DropZone from '@/components/DropZone';
import type { FileItem } from '@/types';

interface QueueProps {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemove: (id: string) => void;
  onRemoveSelected: () => void;
  onFilesAdded: (files: FileItem[]) => void;
}

const Queue: React.FC<QueueProps> = ({
  files,
  selectedIds,
  onSelect,
  onSelectAll,
  onDeselectAll,
  onRemove,
  onRemoveSelected,
  onFilesAdded,
}) => {
  const allSelected = useMemo(
    () => files.length > 0 && selectedIds.size === files.length,
    [files.length, selectedIds.size]
  );

  const someSelected = selectedIds.size > 0;

  const handleAddFiles = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media Files', extensions: [...MEDIA_EXTENSIONS] }],
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

  const handleToggleSelectAll = useCallback(() => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [allSelected, onSelectAll, onDeselectAll]);

  const handleClick = useCallback((e: React.MouseEvent, id: string) => {
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
    onSelect(id, isMulti);
  }, [onSelect]);

  // Empty state
  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <DropZone
          onFilesAdded={onFilesAdded}
          currentCount={0}
          maxCount={MAX_QUEUE_SIZE}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black/10">
      {/* Header with Select All / Delete Selected */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 shrink-0">
        {/* Left: Select All */}
        <button
          onClick={handleToggleSelectAll}
          className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
        >
          {allSelected ? (
            <CheckSquare size={16} className="text-purple-400" />
          ) : (
            <Square size={16} />
          )}
          <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
        </button>

        {/* Right: Delete Selected */}
        {someSelected && (
          <button
            onClick={onRemoveSelected}
            className="flex items-center gap-1.5 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 size={14} />
            <span>Delete Selected ({selectedIds.size})</span>
          </button>
        )}
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-4 py-1.5 border-b border-white/5 text-[10px] uppercase font-bold text-white/40 tracking-wider shrink-0">
        <div className="w-12 text-center">Type</div>
        <div className="flex-1 pl-2">File</div>
        <div className="w-32 text-center">Format</div>
        <div className="w-28 text-center">Status</div>
        <div className="w-10" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {files.map(file => (
          <QueueItem
            key={file.id}
            file={file}
            isSelected={selectedIds.has(file.id)}
            onClick={(e) => handleClick(e, file.id)}
            onRemove={() => onRemove(file.id)}
          />
        ))}

        {/* Add more button */}
        {files.length < MAX_QUEUE_SIZE && (
          <button
            onClick={handleAddFiles}
            className="w-full p-4 text-white/30 text-xs hover:bg-white/5 hover:text-white/60 transition-colors border-t border-white/5"
          >
            + Add more files ({MAX_QUEUE_SIZE - files.length} slots available)
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(Queue);