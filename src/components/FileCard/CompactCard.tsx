import React, { useContext } from 'react';
import { FileAudio, FileVideo, CheckCircle, AlertCircle, Loader, X, RotateCcw } from 'lucide-react';
import { ConversionContext } from '@/App';
import type { FileItem } from '@/types';

interface CompactCardProps {
  file: FileItem;
  onRemove: () => void;
  onRetry: () => void;
  onExpand: () => void;
}

const CompactCard: React.FC<CompactCardProps> = ({ file, onRemove, onRetry, onExpand }) => {
  const conversionContext = useContext(ConversionContext);
  if (!conversionContext) throw new Error('CompactCard must be used within ConversionContext');

  const { cancelConversion } = conversionContext;

  const isVideo = file.mediaInfo?.media_type === 'video';
  const Icon = isVideo ? FileVideo : FileAudio;

  const inputFormat = file.mediaInfo?.format_name?.split(',')[0] || 'unknown';

  const statusConfig = {
    pending: { color: 'text-yellow-400', icon: null },
    processing: { color: 'text-primary-purple', icon: Loader },
    completed: { color: 'text-status-success', icon: CheckCircle },
    failed: { color: 'text-status-error', icon: AlertCircle },
    cancelled: { color: 'text-orange-400', icon: X },
  }[file.status];

  const StatusIcon = statusConfig.icon;

  const showRetryRemove = ['completed', 'failed', 'cancelled'].includes(file.status);
  const showRemoveOnly = file.status === 'pending';
  const showCancel = file.status === 'processing';

  return (
    <div
      className="glass p-2 flex items-center gap-3 group cursor-pointer hover:bg-white/5 transition-colors"
      onClick={onExpand}
    >
      <Icon size={24} className={isVideo ? 'text-primary-pink' : 'text-primary-purple'} />

      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-semibold truncate">{file.name}</div>
        <div className="text-white/60 text-xs flex items-center gap-2">
          <span className="uppercase font-mono">{inputFormat}</span>
          <span>→</span>
          <span className="uppercase font-mono">{file.outputFormat}</span>
        </div>
      </div>

      {file.status === 'processing' && file.progress && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${file.progress.percent}%` }} />
          </div>
          <span className="text-white text-xs font-mono w-12 text-right">{file.progress.percent.toFixed(0)}%</span>
        </div>
      )}

      <div className={`flex items-center gap-1.5 ${statusConfig.color} text-xs font-semibold w-24`}>
        {StatusIcon && <StatusIcon size={14} className={file.status === 'processing' ? 'animate-spin' : ''} />}
        <span>{file.status}</span>
      </div>

      {/* Retry + Remove для completed/failed/cancelled */}
      {showRetryRemove && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
          <button
            onClick={e => {
              e.stopPropagation();
              onRetry();
            }}
            className="p-1 rounded bg-primary-purple/20 hover:bg-primary-purple/40 transition-colors"
            title="Retry conversion"
          >
            <RotateCcw size={14} className="text-primary-purple" />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 transition-colors"
            title="Remove from queue"
          >
            <X size={14} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Remove для pending */}
      {showRemoveOnly && (
        <button
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded bg-red-500/20 hover:bg-red-500/40 transition-all"
          title="Remove from queue"
        >
          <X size={14} className="text-red-400" />
        </button>
      )}

      {/* Cancel для processing */}
      {showCancel && (
        <button
          onClick={e => {
            e.stopPropagation();
            cancelConversion(file.id);
          }}
          className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 transition-colors"
          title="Cancel conversion"
        >
          <X size={14} className="text-red-400" />
        </button>
      )}
    </div>
  );
};

export default React.memo(CompactCard);