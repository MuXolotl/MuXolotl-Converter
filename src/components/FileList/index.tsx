import React, { useContext, useCallback } from 'react';
import { Clock, Settings, Trash2, CheckCheck, XCircle } from 'lucide-react';
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
  onApplyToAll: () => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  onCancelAll: () => void;
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
  onApplyToAll,
  onClearCompleted,
  onClearAll,
  onCancelAll,
}) => {
  const conversionContext = useContext(ConversionContext);

  if (!conversionContext) {
    throw new Error('FileList must be used within ConversionContext');
  }

  const counts = {
    completed: files.filter(f => f.status === 'completed').length,
    processing: files.filter(f => f.status === 'processing').length,
    pending: files.filter(f => f.status === 'pending').length,
  };

  const canApplyToAll = counts.pending > 1;
  const canClearCompleted = counts.completed > 0;
  const canCancelAll = counts.processing > 0;

  const handleApplyToAll = useCallback(async () => {
    const firstPending = files.find(f => f.status === 'pending');
    if (!firstPending) return;

    const confirmed = await ask(
      `Apply settings from "${firstPending.name}" to all pending files?\n\nFormat: ${firstPending.outputFormat.toUpperCase()}\nQuality: ${firstPending.settings.quality}`,
      {
        title: 'Apply Settings to All',
        type: 'info',
      }
    );

    if (confirmed) {
      onApplyToAll();
    }
  }, [files, onApplyToAll]);

  const handleClearCompleted = useCallback(async () => {
    if (counts.completed === 0) return;

    const confirmed = await ask(
      `Remove ${counts.completed} completed file${counts.completed > 1 ? 's' : ''} from queue?`,
      {
        title: 'Clear Completed Files',
        type: 'info',
      }
    );

    if (confirmed) {
      onClearCompleted();
    }
  }, [counts.completed, onClearCompleted]);

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

  const handleCancelAll = useCallback(async () => {
    if (counts.processing === 0) return;

    const confirmed = await ask(`Cancel ${counts.processing} active conversion${counts.processing > 1 ? 's' : ''}?`, {
      title: 'Cancel All Conversions',
      type: 'warning',
    });

    if (confirmed) {
      onCancelAll();
    }
  }, [counts.processing, onCancelAll]);

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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Conversion Queue</h3>
          <span className="text-white/60 text-sm font-mono">{fileCountDisplay} files</span>
        </div>

        {/* Batch Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleApplyToAll}
            disabled={!canApplyToAll}
            className="flex items-center gap-1 px-2 py-1 bg-primary-purple/20 hover:bg-primary-purple/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-primary-purple text-[10px] font-semibold transition-colors"
            title="Apply settings from first file to all pending files"
          >
            <Settings size={11} />
            Apply to All
          </button>

          <button
            onClick={handleClearCompleted}
            disabled={!canClearCompleted}
            className="flex items-center gap-1 px-2 py-1 bg-green-500/20 hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-green-400 text-[10px] font-semibold transition-colors"
            title="Remove completed files from queue"
          >
            <CheckCheck size={11} />
            Clear Completed {canClearCompleted && `(${counts.completed})`}
          </button>

          <button
            onClick={handleCancelAll}
            disabled={!canCancelAll}
            className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded text-orange-400 text-[10px] font-semibold transition-colors"
            title="Cancel all active conversions"
          >
            <XCircle size={11} />
            Cancel All {canCancelAll && `(${counts.processing})`}
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 text-[10px] font-semibold transition-colors ml-auto"
            title="Remove all files from queue"
          >
            <Trash2 size={11} />
            Clear All
          </button>
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
