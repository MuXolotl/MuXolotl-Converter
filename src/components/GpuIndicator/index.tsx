import React from 'react';
import { Cpu, Zap } from 'lucide-react';
import type { GpuInfo } from '@/types';

interface GpuIndicatorProps {
  gpuInfo: GpuInfo;
  compact?: boolean;
}

const GpuIndicator: React.FC<GpuIndicatorProps> = ({ gpuInfo, compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {gpuInfo.available ? (
          <>
            <Zap size={12} className="text-yellow-400" />
            <span className="text-white/60">{gpuInfo.name}</span>
          </>
        ) : (
          <>
            <Cpu size={12} className="text-orange-400" />
            <span className="text-white/40">CPU Only</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="glass px-3 py-2 flex items-center gap-2">
      {gpuInfo.available ? (
        <>
          <Zap size={16} className="text-yellow-400" />
          <div>
            <div className="text-white text-sm font-medium">{gpuInfo.name}</div>
            <div className="text-white/40 text-xs">GPU Acceleration</div>
          </div>
        </>
      ) : (
        <>
          <Cpu size={16} className="text-orange-400" />
          <div>
            <div className="text-white text-sm font-medium">CPU Only</div>
            <div className="text-white/40 text-xs">No GPU Detected</div>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(GpuIndicator);