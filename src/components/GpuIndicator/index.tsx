import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap } from 'lucide-react';
import type { GpuInfo } from '@/types';

const GPU_COLORS: Record<GpuInfo['vendor'], string> = {
  nvidia: 'bg-green-500',
  intel: 'bg-blue-500',
  amd: 'bg-red-500',
  apple: 'bg-gray-500',
  none: 'bg-orange-500',
};

interface GpuIndicatorProps {
  gpuInfo: GpuInfo;
}

const GpuIndicator: React.FC<GpuIndicatorProps> = ({ gpuInfo }) => (
  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass px-4 py-2 flex items-center gap-3">
    <div className={`w-3 h-3 rounded-full ${GPU_COLORS[gpuInfo.vendor]} animate-pulse`} />
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
  </motion.div>
);

export default React.memo(GpuIndicator);