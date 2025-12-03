import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { APP_CONFIG } from '@/config';
import DropZone from '@/components/DropZone';
import QueueItem from './QueueItem';
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

const ROW_HEIGHT = 48;

function Queue({
  files,
  selectedIds,
  onSelect,
  onSelectAll,
  onDeselectAll,
  onRemove,
  onRemoveSelected,
  onFilesAdded,
}: QueueProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(300);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setListHeight(containerRef.current.offsetHeight);
      }
    };

    updateHeight();
    
    const observer = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onRemoveSelected();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      onSelectAll();
    }
    if (e.key === 'Escape') {
      onDeselectAll();
    }
  }, [onRemoveSelected, onSelectAll, onDeselectAll]);

  const itemData = useMemo(() => ({
    files,
    selectedIds,
    onSelect,
    onRemove,
  }), [files, selectedIds, onSelect, onRemove]);

  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-[#1e293b]/30">
        <DropZone
          onFilesAdded={onFilesAdded}
          currentCount={0}
          maxCount={APP_CONFIG.limits.maxQueueSize}
        />
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col bg-[#1e293b]/30 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={onDeselectAll}
    >
      <QueueHeader />

      <div ref={containerRef} className="flex-1 min-h-0">
        <List
          height={listHeight}
          itemCount={files.length}
          itemSize={ROW_HEIGHT}
          width="100%"
          itemData={itemData}
          overscanCount={5}
        >
          {VirtualizedRow}
        </List>
      </div>

      {files.length < APP_CONFIG.limits.maxQueueSize && (
        <div className="p-2 opacity-60 hover:opacity-100 transition-opacity shrink-0">
          <DropZone
            onFilesAdded={onFilesAdded}
            currentCount={files.length}
            maxCount={APP_CONFIG.limits.maxQueueSize}
            compact
          />
        </div>
      )}
    </div>
  );
}

function QueueHeader() {
  return (
    <div className="shrink-0 bg-[#0f172a] border-b border-white/10 select-none px-2 py-1.5">
      <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
        <div className="w-6 text-center">#</div>
        <div className="flex-1 min-w-0">File</div>
        <div className="w-16">Format</div>
        <div className="w-20">Status</div>
        <div className="w-6" />
      </div>
    </div>
  );
}

interface RowData {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  onRemove: (id: string) => void;
}

function VirtualizedRow({ index, style, data }: { index: number; style: React.CSSProperties; data: RowData }) {
  const { files, selectedIds, onSelect, onRemove } = data;
  const file = files[index];

  return (
    <div style={style}>
      <QueueItem
        file={file}
        index={index}
        isSelected={selectedIds.has(file.id)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(file.id, e.ctrlKey || e.metaKey);
        }}
        onRemove={() => onRemove(file.id)}
      />
    </div>
  );
}

export default memo(Queue);