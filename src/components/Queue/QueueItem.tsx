import React from 'react';
import { FileVideo, FileAudio, Loader, CheckCircle, AlertCircle, X, Trash2 } from 'lucide-react';
import { formatDuration, formatFileSize } from '@/utils';
import { STATUS_CONFIG } from '@/constants';
import type { FileItem } from '@/types';

interface QueueItemProps {
  file: FileItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onRemove: () => void;
}

const QueueItem: React.FC<QueueItemProps> = ({ file, isSelected, onClick, onRemove }) => {
  const isVideo = file.mediaInfo?.media_type === 'video';
  const Icon = isVideo ? FileVideo : FileAudio;
  const statusConfig = STATUS_CONFIG[file.status];

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div
      onClick={onClick}
      className={`group flex items-center px-4 py-2.5 border-b border-white/5 cursor-pointer transition-colors select-none ${
        isSelected
          ? 'bg-purple-500/20'
          : 'hover:bg-white/5'
      }`}
    >
      {/* Icon */}
      <div className="w-12 flex justify-center">
        <div className={`w-8 h-8 rounded flex items-center justify-center ${
          isSelected ? 'bg-purple-500/30 text-white' : 'bg-white/5 text-white/40'
        }`}>
          <Icon size={16} />
        </div>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0 pl-2">
        <div className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-white/90'}`}>
          {file.name}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono mt-0.5">
          <span>{formatDuration(file.mediaInfo?.duration || 0)}</span>
          <span>•</span>
          <span>{formatFileSize(file.mediaInfo?.file_size || 0)}</span>
        </div>
      </div>

      {/* Format */}
      <div className="w-32 flex items-center justify-center gap-1.5">
        <span className="text-[10px] font-mono uppercase text-white/40">
          {file.mediaInfo?.format_name.split(',')[0] || '?'}
        </span>
        <span className="text-white/20">→</span>
        <span className="text-[10px] font-mono uppercase text-purple-400 font-bold">
          {file.outputFormat}
        </span>
      </div>

      {/* Status */}
      <div className="w-28 flex justify-center">
        {file.status === 'processing' && file.progress ? (
          <div className="w-full px-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-400 mb-1">
              <span>{file.progress.percent.toFixed(0)}%</span>
              <Loader size={12} className="animate-spin" />
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${file.progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-1.5 text-xs ${statusConfig.color}`}>
            <StatusIcon status={file.status} />
            <span className="capitalize">{file.status}</span>
          </div>
        )}
      </div>

      {/* Delete Button */}
      <div className="w-10 flex justify-center">
        <button
          onClick={handleRemove}
          className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
          title="Remove from queue"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const StatusIcon: React.FC<{ status: FileItem['status'] }> = ({ status }) => {
  const props = { size: 14 };
  
  switch (status) {
    case 'processing':
      return <Loader {...props} className="animate-spin" />;
    case 'completed':
      return <CheckCircle {...props} />;
    case 'failed':
      return <AlertCircle {...props} />;
    case 'cancelled':
      return <X {...props} />;
    default:
      return <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />;
  }
};

export default React.memo(QueueItem);