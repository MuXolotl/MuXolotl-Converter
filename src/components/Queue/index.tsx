import React from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import DropZone from '@/components/DropZone';
import QueueItem from './QueueItem';
import { MAX_QUEUE_SIZE } from '@/constants';
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
  const [parent] = useAutoAnimate();

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  // Shared column widths configuration
  // Total should be roughly 100%, but fixed pixels mixed with % is safer
  const renderColGroup = () => (
    <colgroup>
      <col style={{ width: '40px' }} />  {/* # */}
      <col style={{ width: '35%' }} />   {/* Name */}
      <col style={{ width: '15%' }} />   {/* Format */}
      <col style={{ width: '15%' }} />   {/* Size/Dur */}
      <col style={{ width: '25%' }} />   {/* Status */}
      <col style={{ width: '50px' }} />  {/* Action */}
    </colgroup>
  );

  // Empty state
  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#1e293b]/30">
        <DropZone
          onFilesAdded={onFilesAdded}
          currentCount={0}
          maxCount={MAX_QUEUE_SIZE}
        />
      </div>
    );
  }

  return (
    <div 
      className="h-full flex flex-col bg-[#1e293b]/30 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onDeselectAll()}
    >
      {/* Table Header - Fixed */}
      <div className="shrink-0 bg-[#0f172a] border-b border-white/10 select-none">
        <table className="pro-table">
          {renderColGroup()}
          <thead>
            <tr>
              <th className="text-center">#</th>
              <th className="text-left">File Name</th>
              <th className="text-left pl-4">Format</th>
              <th className="text-right pr-4">Size / Dur</th>
              <th className="text-left pl-4">Status</th>
              <th className="text-center"></th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable Table Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="pro-table">
          {renderColGroup()}
          <tbody ref={parent}>
            {files.map((file, index) => (
              <QueueItem
                key={file.id}
                index={index}
                file={file}
                isSelected={selectedIds.has(file.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(file.id, e.ctrlKey || e.metaKey);
                }}
                onRemove={() => onRemove(file.id)}
              />
            ))}
          </tbody>
        </table>
        
        {/* Compact Drop zone at the bottom */}
        {files.length < MAX_QUEUE_SIZE && (
           <div className="p-2 opacity-60 hover:opacity-100 transition-opacity">
              <DropZone
                onFilesAdded={onFilesAdded}
                currentCount={files.length}
                maxCount={MAX_QUEUE_SIZE}
                compact // New prop we'll add to DropZone
              />
           </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(Queue);