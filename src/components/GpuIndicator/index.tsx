import React from 'react';
import { Cpu, Zap } from 'lucide-react';
import type { GpuInfo } from '@/types';

interface GpuIndicatorProps {
  gpuInfo: GpuInfo;
}

const GpuIndicator: React.FC<GpuIndicatorProps> = ({ gpuInfo }) => (
  <div className="glass px-4 py-2 flex items-center gap-3">
    {gpuInfo.available ? (
      <>
        <Zap size={18} className="text-yellow-400" />
        <div className="flex flex-col">
          <span className="text-white text-sm font-semibold">{gpuInfo.name}</span>
          <span className="text-white/50 text-xs">GPU Acceleration Available</span>
        </div>
      </>
    ) : (
      <>
        <Cpu size={18} className="text-orange-400" />
        <div className="flex flex-col">
          <span className="text-white text-sm font-semibold">CPU Only</span>
          <span className="text-white/50 text-xs">No GPU Detected</span>
        </div>
      </>
    )}
  </div>
);

export default React.memo(GpuIndicator);
