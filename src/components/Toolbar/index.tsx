import React from 'react';
import { Zap, Cpu } from 'lucide-react';
import OutputFolderSelector from '@/components/OutputFolderSelector';
import type { GpuInfo } from '@/types';

interface ToolbarProps {
  stats: { total: number; pending: number; processing: number; completed: number; failed: number; };
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
    <div className="h-12 bg-[#0f172a] border-b border-white/5 flex items-center justify-between px-4 shrink-0 gap-6">
      
      {/* LEFT: Stats & Hardware */}
      <div className="flex items-center gap-6 text-[11px] font-mono text-slate-500">
        {/* GPU Badge */}
        {!gpuLoading && (
          <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded border border-white/5" title={gpuInfo.name}>
            {gpuInfo.available ? (
              <>
                <Zap size={12} className="text-yellow-500" fill="currentColor" />
                <span className="text-yellow-500/90 font-bold tracking-wide">GPU ENABLED</span>
              </>
            ) : (
              <>
                <Cpu size={12} className="text-slate-500" />
                <span>CPU MODE</span>
              </>
            )}
          </div>
        )}

        <div className="w-px h-4 bg-white/10" />

        {/* Counters */}
        <div className="flex gap-4">
            <StatItem label="TOTAL" value={stats.total} />
            <StatItem label="PENDING" value={stats.pending} active={stats.pending > 0} />
            <StatItem label="DONE" value={stats.completed} active={stats.completed > 0} color="text-green-500" />
            {stats.failed > 0 && <StatItem label="FAILED" value={stats.failed} active color="text-red-500" />}
        </div>
      </div>

      {/* RIGHT: Output Folder (Big & Prominent) */}
      <div className="flex-1 max-w-sm flex justify-end">
        <OutputFolderSelector
          outputFolder={outputFolder}
          onFolderChange={onFolderChange}
        />
      </div>
    </div>
  );
};

const StatItem: React.FC<{ label: string; value: number; active?: boolean; color?: string; }> = ({ label, value, active, color = 'text-blue-400' }) => (
    <div className={`flex gap-1.5 ${active ? 'opacity-100' : 'opacity-40'}`}>
        <span className="font-semibold">{label}</span>
        <span className={active ? color : ''}>{value}</span>
    </div>
);

export default React.memo(Toolbar);