import React from 'react';
import { CheckCircle, AlertCircle, X, RotateCcw } from 'lucide-react';
import { ConversionStatus } from '@/types';

interface Props {
  status: ConversionStatus;
  error?: string | null;
  outputPath?: string;
  isRetrying: boolean;
  onRetry: () => void;
  onRemove: () => void;
}

const StatusActions: React.FC<Props> = ({ status, error, outputPath, isRetrying, onRetry, onRemove }) => {
  if (status === 'pending') {
    return (
      <div className="flex flex-col gap-1 text-right">
        <span className="text-xs text-yellow-400/80 flex items-center justify-end gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Ready
        </span>
        {outputPath && (
          <span className="text-[10px] text-green-400/60 truncate max-w-[120px]" title={outputPath}>
             Path set
          </span>
        )}
      </div>
    );
  }

  const config = {
    completed: { icon: CheckCircle, color: 'text-green-400', text: 'Done' },
    failed: { icon: AlertCircle, color: 'text-red-400', text: 'Failed' },
    cancelled: { icon: X, color: 'text-orange-400', text: 'Cancelled' },
    processing: { icon: null, color: '', text: '' } // Handled by ProgressIndicator
  }[status];

  const Icon = config.icon!;

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-right-2 duration-200">
      <div className={`flex items-center gap-2 ${config.color}`}>
        <Icon size={18} />
        <div className="min-w-0">
          <div className="text-sm font-bold">{config.text}</div>
          {error && <div className="text-[10px] opacity-70 truncate w-24" title={error}>{error}</div>}
        </div>
      </div>
      
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); onRetry(); }} disabled={isRetrying}
          className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-primary-purple text-xs font-medium flex justify-center items-center gap-1 transition-colors">
          <RotateCcw size={12} className={isRetrying ? 'animate-spin' : ''} /> Retry
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-colors">
          Remove
        </button>
      </div>
    </div>
  );
};

export default React.memo(StatusActions);