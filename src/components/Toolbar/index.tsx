import { memo } from 'react';
import { Zap, Cpu } from 'lucide-react';
import OutputFolderSelector from '@/components/OutputFolderSelector';
import type { GpuInfo, QueueStats } from '@/types';

interface ToolbarProps {
  stats: QueueStats;
  gpuInfo: GpuInfo;
  gpuLoading: boolean;
  outputFolder: string;
  onFolderChange: (folder: string) => void;
}

function Toolbar({ stats, gpuInfo, gpuLoading, outputFolder, onFolderChange }: ToolbarProps) {
  return (
    <div className="h-10 bg-[#0f172a] border-b border-white/5 flex items-center px-2 gap-2 shrink-0 overflow-hidden">
      {/* Left: GPU + Stats */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 shrink-0">
        {!gpuLoading && (
          <div
            className="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/5 rounded border border-white/5"
            title={gpuInfo.name}
          >
            {gpuInfo.available ? (
              <Zap size={10} className="text-yellow-500" fill="currentColor" />
            ) : (
              <Cpu size={10} className="text-slate-500" />
            )}
            <span className={gpuInfo.available ? 'text-yellow-500/90 font-bold' : ''}>
              {gpuInfo.available ? 'GPU' : 'CPU'}
            </span>
          </div>
        )}

        <div className="w-px h-4 bg-white/10" />

        <div className="flex gap-2">
          <StatItem label="T" value={stats.total} title="Total" />
          <StatItem label="P" value={stats.pending} active={stats.pending > 0} title="Pending" />
          <StatItem label="D" value={stats.completed} active={stats.completed > 0} color="text-green-500" title="Done" />
          {stats.failed > 0 && <StatItem label="F" value={stats.failed} active color="text-red-500" title="Failed" />}
        </div>
      </div>

      {/* Right: Output Folder - takes remaining space */}
      <div className="flex-1 min-w-0 flex justify-end">
        <OutputFolderSelector outputFolder={outputFolder} onFolderChange={onFolderChange} />
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: number;
  active?: boolean;
  color?: string;
  title?: string;
}

function StatItem({ label, value, active, color = 'text-blue-400', title }: StatItemProps) {
  return (
    <div className={`flex gap-1 ${active ? 'opacity-100' : 'opacity-40'}`} title={title}>
      <span className="font-semibold">{label}</span>
      <span className={active ? color : ''}>{value}</span>
    </div>
  );
}

export default memo(Toolbar);