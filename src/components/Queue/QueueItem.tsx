import React from 'react';
import { 
  FileVideo, 
  FileAudio, 
  Check, 
  AlertTriangle, 
  X, 
  Trash2, 
  ArrowRight
} from 'lucide-react';
import { formatDuration, formatFileSize } from '@/utils';
import type { FileItem } from '@/types';

interface QueueItemProps {
  file: FileItem;
  index: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onRemove: () => void;
}

const QueueItem: React.FC<QueueItemProps> = ({ 
  file, 
  index, 
  isSelected, 
  onClick, 
  onRemove 
}) => {
  const isVideo = file.mediaInfo?.media_type === 'video';
  const Icon = isVideo ? FileVideo : FileAudio;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  // Status Cell Content
  const renderStatus = () => {
    if (file.status === 'processing' && file.progress) {
      return (
        <div className="w-full pr-2">
          <div className="flex justify-between text-[10px] text-blue-400 mb-1 font-mono">
            <span>{file.progress.percent.toFixed(1)}%</span>
            <span className="opacity-70">
                {formatEta(file.progress.eta_seconds)}
            </span>
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

    if (file.status === 'completed') {
      return (
        <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
          <Check size={14} /> Done
        </span>
      );
    }

    if (file.status === 'failed') {
      return (
        <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium" title={file.error || 'Error'}>
          <AlertTriangle size={14} /> Failed
        </span>
      );
    }

    if (file.status === 'cancelled') {
        return (
          <span className="flex items-center gap-1.5 text-orange-400 text-xs font-medium">
            <X size={14} /> Cancelled
          </span>
        );
      }

    return <span className="text-white/30 text-xs italic">Pending...</span>;
  };

  return (
    <tr 
      onClick={onClick}
      className={`cursor-pointer transition-colors select-none group ${
        isSelected ? 'selected' : ''
      }`}
    >
      {/* Index - Center */}
      <td className="text-white/30 font-mono text-xs text-center">
        {index + 1}
      </td>

      {/* File Name - Left */}
      <td className="text-left">
        <div className="flex items-center gap-3">
          <div className={`shrink-0 p-1.5 rounded ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'}`}>
            <Icon size={16} />
          </div>
          <div className={`text-sm truncate font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`} title={file.name}>
            {file.name}
          </div>
        </div>
      </td>

      {/* Format - Left w/ padding */}
      <td className="pl-4">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-white/40">{file.mediaInfo?.format_name.split(',')[0]}</span>
          <ArrowRight size={10} className="text-white/20" />
          <span className="text-blue-400 font-bold uppercase">{file.outputFormat}</span>
        </div>
      </td>

      {/* Size / Dur - Right aligned for numbers */}
      <td className="text-right pr-4">
        <div className="flex flex-col gap-0.5 text-[11px] font-mono text-white/50">
            <span>{formatFileSize(file.mediaInfo?.file_size || 0)}</span>
            <span className="text-white/30">
                {formatDuration(file.mediaInfo?.duration || 0)}
            </span>
        </div>
      </td>

      {/* Status - Left w/ padding */}
      <td className="pl-4 align-middle">
        {renderStatus()}
      </td>

      {/* Actions - Center */}
      <td className="text-center">
        <button
          onClick={handleRemove}
          className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
          title="Remove from queue"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

function formatEta(seconds: number | null | undefined): string {
    if (seconds == null) return '--:--';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

export default React.memo(QueueItem);