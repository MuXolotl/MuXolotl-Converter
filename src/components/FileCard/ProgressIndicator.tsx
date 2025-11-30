import React from 'react';
import { Loader, X } from 'lucide-react';
import { formatETA, formatDuration } from '@/utils';
import { ConversionProgress } from '@/types';

interface Props {
  progress: ConversionProgress;
  onCancel: () => void;
}

const ProgressIndicator: React.FC<Props> = ({ progress, onCancel }) => (
  <div className="w-full space-y-2 animate-in fade-in duration-200">
    <div className="flex justify-between items-center text-sm">
      <div className="flex items-center gap-2 text-primary-purple font-bold">
        <Loader size={14} className="animate-spin" />
        {progress.percent.toFixed(0)}%
      </div>
      <span className="text-white/50 text-xs font-mono">
        ETA: {formatETA(progress.eta_seconds)}
      </span>
    </div>
    
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40 font-mono">
      {progress.fps && <span>{progress.fps.toFixed(0)} FPS</span>}
      {progress.speed && <span>{progress.speed.toFixed(1)}x</span>}
      <span>{formatDuration(progress.current_time)} / {formatDuration(progress.total_time)}</span>
    </div>

    <button onClick={(e) => { e.stopPropagation(); onCancel(); }}
      className="w-full py-1.5 flex items-center justify-center gap-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors">
      <X size={12} /> Cancel
    </button>
  </div>
);

export default React.memo(ProgressIndicator);