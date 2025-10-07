import React from 'react';
import { Loader, X } from 'lucide-react';
import { formatDuration, formatETA } from '@/constants';
import type { ConversionProgress } from '@/types';

interface ProgressIndicatorProps {
  progress: ConversionProgress;
  onCancel: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress, onCancel }) => (
  <div className="w-full space-y-2">
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Loader size={16} className="animate-spin text-primary-purple" />
          <span className="text-white font-bold">{progress.percent.toFixed(1)}%</span>
        </div>
        <span className="text-white/60 text-xs">ETA: {formatETA(progress.eta_seconds)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
        {progress.fps && (
          <span className="flex items-center gap-1">
            <span className="text-white/40">FPS:</span>
            <span className="text-white font-mono">{progress.fps.toFixed(1)}</span>
          </span>
        )}
        {progress.speed && (
          <span className="flex items-center gap-1">
            <span className="text-white/40">Speed:</span>
            <span className="text-primary-pink font-mono font-bold">{progress.speed.toFixed(2)}x</span>
          </span>
        )}
      </div>
      <div className="text-xs text-white/50">
        {formatDuration(progress.current_time)} / {formatDuration(progress.total_time)}
      </div>
    </div>
    <button
      onClick={onCancel}
      className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
    >
      <X size={14} />
      Cancel
    </button>
  </div>
);

export default React.memo(ProgressIndicator);
