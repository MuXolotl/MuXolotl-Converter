import { memo } from 'react';
import { FileVideo, FileAudio, Check, AlertTriangle, X, Trash2, ArrowRight } from 'lucide-react';
import { formatEta } from '@/utils';
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
      className={`flex items-center gap-2 px-2 h-full cursor-pointer transition-colors select-none group border-b border-white/5 ${
        isSelected ? 'bg-blue-500/15 border-l-2 border-l-blue-500' : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Index */}
      <div className="w-6 text-white/30 font-mono text-[10px] text-center shrink-0">
        {index + 1}
      </div>

      {/* Icon + Name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={`shrink-0 p-1 rounded ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'}`}>
          <Icon size={12} />
        </div>
        <div className={`text-[11px] truncate font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`} title={file.name}>
          {file.name}
        </div>
      </div>

      {/* Format */}
      <div className="w-16 flex items-center gap-1 font-mono text-[9px] shrink-0">
        <ArrowRight size={8} className="text-white/20" />
        <span className="text-blue-400 font-bold uppercase truncate">{file.outputFormat}</span>
      </div>

      {/* Status */}
      <div className="w-20 shrink-0">
        <StatusCell file={file} />
      </div>

      {/* Remove Button */}
      <div className="w-6 flex justify-center shrink-0">
        <button
          onClick={handleRemove}
          className="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function StatusCell({ file }: { file: FileItem }) {
  if (file.status === 'processing' && file.progress) {
    return (
      <div className="w-full">
        <div className="flex justify-between text-[9px] text-blue-400 mb-0.5 font-mono">
          <span>{file.progress.percent.toFixed(0)}%</span>
          <span className="opacity-70">{formatEta(file.progress.eta_seconds)}</span>
        </div>
        <div className="w-full h-1 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${file.progress.percent}%` }}
          />
        </div>
      </div>
    );
  }

  const configs: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
    completed: { icon: <Check size={10} />, text: 'Done', className: 'text-green-400' },
    failed: { icon: <AlertTriangle size={10} />, text: 'Failed', className: 'text-red-400' },
    cancelled: { icon: <X size={10} />, text: 'Stopped', className: 'text-orange-400' },
    pending: { icon: null, text: 'Pending', className: 'text-white/30' },
  };

  const cfg = configs[file.status] || configs.pending;

  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${cfg.className}`} title={file.error || undefined}>
      {cfg.icon}
      <span className="truncate">{cfg.text}</span>
    </span>
  );
}

export default memo(QueueItem);