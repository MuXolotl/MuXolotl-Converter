import React from 'react';
import { Cpu, Zap, HardDrive, Clock } from 'lucide-react';
import OutputFolderSelector from '@/components/OutputFolderSelector';
import type { GpuInfo } from '@/types';

interface ToolbarProps {
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  gpuInfo: GpuInfo;
  gpuLoading: boolean;
  outputFolder: string;
  onFolderChange: (folder: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  stats,
  gpuInfo,
  gpuLoading,
  outputFolder,
  onFolderChange,
}) => {
  return (
    <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-black/20 shrink-0">
      {/* Left: Stats */}
      <div className="flex items-center gap-4">
        {/* Queue Stats */}
        <div className="flex items-center gap-3 text-xs">
          <StatBadge 
            icon={<HardDrive size={12} />} 
            label="Queue" 
            value={stats.total} 
          />
          
          {stats.pending > 0 && (
            <StatBadge 
              icon={<Clock size={12} />}
              label="Pending" 
              value={stats.pending} 
              color="text-yellow-400" 
            />
          )}
          
          {stats.processing > 0 && (
            <StatBadge 
              label="Converting" 
              value={stats.processing} 
              color="text-purple-400"
              pulse 
            />
          )}
          
          {stats.completed > 0 && (
            <StatBadge 
              label="Done" 
              value={stats.completed} 
              color="text-green-400" 
            />
          )}
          
          {stats.failed > 0 && (
            <StatBadge 
              label="Failed" 
              value={stats.failed} 
              color="text-red-400" 
            />
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/10" />

        {/* GPU Info */}
        {!gpuLoading && (
          <div className="flex items-center gap-1.5 text-xs">
            {gpuInfo.available ? (
              <>
                <Zap size={12} className="text-yellow-400" />
                <span className="text-white/60">{gpuInfo.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                  GPU
                </span>
              </>
            ) : (
              <>
                <Cpu size={12} className="text-orange-400" />
                <span className="text-white/40">CPU Only</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Output Folder */}
      <OutputFolderSelector
        outputFolder={outputFolder}
        onFolderChange={onFolderChange}
      />
    </div>
  );
};

interface StatBadgeProps {
  icon?: React.ReactNode;
  label: string;
  value: number;
  color?: string;
  pulse?: boolean;
}

const StatBadge: React.FC<StatBadgeProps> = ({
  icon,
  label,
  value,
  color = 'text-white/60',
  pulse = false,
}) => (
  <div className="flex items-center gap-1.5">
    {icon && <span className="text-white/40">{icon}</span>}
    <span className="text-white/40">{label}:</span>
    <span className={`font-semibold ${color} ${pulse ? 'animate-pulse' : ''}`}>
      {value}
    </span>
  </div>
);

export default React.memo(Toolbar);