import React from 'react';
import { CheckCircle, AlertCircle, X, RotateCcw } from 'lucide-react';

interface StatusActionsProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string | null;
  outputPath?: string;
  isRetrying: boolean;
  onRetry: () => void;
  onRemove: () => void;
}

const StatusActions: React.FC<StatusActionsProps> = ({ status, error, outputPath, isRetrying, onRetry, onRemove }) => {
  if (status === 'pending') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span>Ready to convert</span>
        </div>
        {outputPath && (
          <div className="text-xs text-green-400 truncate" title={outputPath}>
            ✓ Path set
          </div>
        )}
      </div>
    );
  }

  if (status === 'processing') {
    return null;
  }

  if (['completed', 'failed', 'cancelled'].includes(status)) {
    const statusConfig = {
      completed: { icon: CheckCircle, color: 'text-status-success', label: 'Completed' },
      failed: { icon: AlertCircle, color: 'text-status-error', label: 'Failed' },
      cancelled: { icon: X, color: 'text-orange-400', label: 'Cancelled' },
    }[status as 'completed' | 'failed' | 'cancelled']!;

    const Icon = statusConfig.icon;

    return (
      <div className="space-y-2">
        <div className={`flex items-${status === 'completed' ? 'center' : 'start'} gap-2 ${statusConfig.color}`}>
          <Icon size={20} className={status !== 'completed' ? 'mt-0.5 flex-shrink-0' : ''} />
          <div>
            <div className="text-sm font-semibold">{statusConfig.label}</div>
            {error && (
              <div className="text-xs mt-1 opacity-80 line-clamp-2" title={error}>
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-1 px-3 py-1.5 bg-primary-purple/20 hover:bg-primary-purple/30 rounded text-primary-purple text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <RotateCcw size={12} />
            Retry
          </button>
          <button
            onClick={onRemove}
            className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/60 text-xs font-semibold transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default React.memo(StatusActions);
