import { memo } from 'react';
import { FileVideo, FileAudio, Check, AlertTriangle, X, Trash2, ArrowRight } from 'lucide-react';
import { formatDuration, formatFileSize, formatEta } from '@/utils';
import type { FileItem } from '@/types';

interface QueueItemProps {
  file: FileItem;
  index: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onRemove: () => void;
}

function QueueItem({ file, index, isSelected, onClick, onRemove }: QueueItemProps) {
  const isVideo = file.mediaInfo?.media_type === 'video';
  const Icon = isVideo ? FileVideo : FileAudio;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-[40px_1fr_120px_100px_140px_50px] gap-2 px-3 py-2 cursor-pointer transition-colors select-none group items-center h-full border-b border-white/5 ${
        isSelected ? 'bg-blue-500/15 border-l-2 border-l-blue-500' : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className="text-white/30 font-mono text-xs text-center">{index + 1}</div>

      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 p-1.5 rounded ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'}`}>
          <Icon size={16} />
        </div>
        <div className={`text-sm truncate font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`} title={file.name}>
          {file.name}
        </div>
      </div>

      <div className="flex items-center gap-1.5 font-mono text-xs pl-2">
        <span className="text-white/40">{file.mediaInfo?.format_name.split(',')[0]}</span>
        <ArrowRight size={10} className="text-white/20" />
        <span className="text-blue-400 font-bold uppercase">{file.outputFormat}</span>
      </div>

      <div className="text-right pr-2">
        <div className="text-[11px] font-mono text-white/50">{formatFileSize(file.mediaInfo?.file_size || 0)}</div>
        <div className="text-[10px] font-mono text-white/30">{formatDuration(file.mediaInfo?.duration || 0)}</div>
      </div>

      <div className="pl-2">
        <StatusCell file={file} />
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleRemove}
          className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
          title="Remove from queue"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function StatusCell({ file }: { file: FileItem }) {
  if (file.status === 'processing' && file.progress) {
    return (
      <div className="w-full pr-2">
        <div className="flex justify-between text-[10px] text-blue-400 mb-1 font-mono">
          <span>{file.progress.percent.toFixed(1)}%</span>
          <span className="opacity-70">{formatEta(file.progress.eta_seconds)}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${file.progress.percent}%` }}
          />
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
    completed: { icon: <Check size={14} />, text: 'Done', className: 'text-green-400' },
    failed: { icon: <AlertTriangle size={14} />, text: 'Failed', className: 'text-red-400' },
    cancelled: { icon: <X size={14} />, text: 'Cancelled', className: 'text-orange-400' },
    pending: { icon: null, text: 'Pending...', className: 'text-white/30 italic' },
  };

  const config = statusConfig[file.status] || statusConfig.pending;

  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${config.className}`} title={file.error || undefined}>
      {config.icon}
      {config.text}
    </span>
  );
}

export default memo(QueueItem);