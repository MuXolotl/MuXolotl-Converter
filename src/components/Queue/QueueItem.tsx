import React from 'react';
import { FileVideo, FileAudio, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import { FileItem } from '@/types';
import { formatDuration, formatFileSize } from '@/utils';

interface QueueItemProps {
  file: FileItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const QueueItem: React.FC<QueueItemProps> = ({ file, isSelected, onClick }) => {
  const isVideo = file.mediaInfo?.media_type === 'video';
  const Icon = isVideo ? FileVideo : FileAudio;

  // Status Logic
  let statusColor = 'text-white/40';
  let statusIcon = null;

  switch (file.status) {
    case 'processing':
      statusColor = 'text-primary-purple';
      statusIcon = <Loader size={14} className="animate-spin" />;
      break;
    case 'completed':
      statusColor = 'text-green-400';
      statusIcon = <CheckCircle size={14} />;
      break;
    case 'failed':
      statusColor = 'text-red-400';
      statusIcon = <AlertCircle size={14} />;
      break;
    case 'cancelled':
      statusColor = 'text-orange-400';
      statusIcon = <X size={14} />;
      break;
  }

  return (
    <div
      onClick={onClick}
      className={`
        group flex items-center gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition-colors select-none
        ${isSelected ? 'bg-primary-purple/20 border-primary-purple/30' : 'hover:bg-white/5'}
      `}
    >
      {/* Icon / Thumbnail Placeholder */}
      <div className={`
        w-8 h-8 rounded flex items-center justify-center shrink-0
        ${isSelected ? 'bg-primary-purple/30 text-white' : 'bg-white/5 text-white/40'}
      `}>
        <Icon size={16} />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-white/90'}`}>
          {file.name}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono mt-0.5">
          <span>{file.mediaInfo?.format_name.split(',')[0].toUpperCase()}</span>
          <span>•</span>
          <span>{formatDuration(file.mediaInfo?.duration || 0)}</span>
          <span>•</span>
          <span>{formatFileSize(file.mediaInfo?.file_size || 0)}</span>
        </div>
      </div>

      {/* Conversion Arrow & Format */}
      <div className="flex items-center gap-2 shrink-0 w-24 justify-center opacity-60 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono uppercase bg-white/5 px-1.5 py-0.5 rounded text-white/60">
          {file.mediaInfo?.format_name.split(',')[0] || 'RAW'}
        </span>
        <span className="text-white/20">→</span>
        <span className="text-[10px] font-mono uppercase bg-primary-purple/20 px-1.5 py-0.5 rounded text-primary-purple font-bold border border-primary-purple/30">
          {file.outputFormat}
        </span>
      </div>

      {/* Status / Progress */}
      <div className="w-32 shrink-0 flex flex-col items-end justify-center">
        {file.status === 'processing' && file.progress ? (
          <div className="w-full text-right">
            <div className="flex items-center justify-end gap-2 text-xs font-bold text-primary-purple">
              <span>{file.progress.percent.toFixed(0)}%</span>
              {statusIcon}
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-primary-purple transition-all duration-300" style={{ width: `${file.progress.percent}%` }} />
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
            {statusIcon}
            <span className="capitalize">{file.status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(QueueItem);