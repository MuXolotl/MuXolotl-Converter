import React, { useContext, useCallback } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { ask } from '@tauri-apps/api/dialog';
import FileCard from '@/components/FileCard';
import CompactCard from '@/components/FileCard/CompactCard';
import { ConversionContext } from '@/App';
import type { FileItem } from '@/types';

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  gpuAvailable: boolean;
  expandedAdvanced: Set<string>;
  onToggleAdvanced: (fileId: string) => void;
  expandedCompactCard: string | null;
  onToggleCompactCard: (fileId: string | null) => void;
  fileCountDisplay: string;
  onClearAll: () => void;
}

const FileList: React.FC<FileListProps> = ({
  files,
  onRemove,
  onRetry,
  gpuAvailable,
  expandedAdvanced,
  onToggleAdvanced,
  expandedCompactCard,
  onToggleCompactCard,
  fileCountDisplay,
  onClearAll,
}) => {
  const conversionContext = useContext(ConversionContext);

  if (!conversionContext) {
    throw new Error('FileList must be used within ConversionContext');
  }

  const handleClearAll = useCallback(async () => {
    if (files.length === 0) return;

    const confirmed = await ask(`Remove ALL ${files.length} files from queue?\n\nThis action cannot be undone.`, {
      title: 'Clear All Files',
      type: 'warning',
    });

    if (confirmed) {
      onClearAll();
    }
  }, [files.length, onClearAll]);

  if (files.length === 0) {
    return (
      <div className="glass h-full flex items-center justify-center">
        <div className="text-center text-white/40">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No files in queue</p>
          <p className="text-sm mt-2">Drop files or click browse to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass h-full flex flex-col">
      <div className="p-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Conversion Queue</h3>
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm font-mono">{fileCountDisplay} files</span>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 text-[10px] font-semibold transition-colors"
              title="Remove all files from queue"
            >
              <Trash2 size={11} />
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <div className="space-y-1.5">
          {files.map(file =>
            expandedCompactCard === file.id ? (
              <FileCard
                key={file.id}
                file={file}
                onRemove={() => {
                  onRemove(file.id);
                  onToggleCompactCard(null);
                }}
                onRetry={() => onRetry(file.id)}
                gpuAvailable={gpuAvailable}
                isAdvancedOpen={expandedAdvanced.has(file.id)}
                onToggleAdvanced={() => onToggleAdvanced(file.id)}
                onCollapse={() => onToggleCompactCard(null)}
              />
            ) : (
              <CompactCard
                key={file.id}
                file={file}
                onRemove={() => onRemove(file.id)}
                onRetry={() => onRetry(file.id)}
                onExpand={() => onToggleCompactCard(file.id)}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FileList);