import { memo, useCallback, useMemo } from 'react';
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

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 40;

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
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#1e293b]/30">
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

      <div className="flex-1 min-h-0">
        <List
          height={window.innerHeight - 200}
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
    <div className="shrink-0 bg-[#0f172a] border-b border-white/10 select-none">
      <div className="grid grid-cols-[40px_1fr_120px_100px_140px_50px] gap-2 px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        <div className="text-center">#</div>
        <div>File Name</div>
        <div className="pl-2">Format</div>
        <div className="text-right pr-2">Size / Dur</div>
        <div className="pl-2">Status</div>
        <div />
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