import { memo } from 'react';
import { Terminal, Activity, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import type { FileItem } from '@/types';

interface FooterProps {
  isOpen: boolean;
  onToggle: () => void;
  lastFile: FileItem | null;
}

function Footer({ isOpen, onToggle, lastFile }: FooterProps) {
  return (
    <div className="flex flex-col shrink-0 z-30">
      {isOpen && (
        <div className="h-32 bg-[#0b1120] border-t border-white/10 p-2 font-mono text-xs text-slate-300 overflow-y-auto shadow-inner">
          <div className="opacity-50 select-none">// FFmpeg Output Log (Coming Soon)</div>
          <div className="mt-1 text-blue-400">$ ffmpeg -i input.mp4 -c:v libx264 output.mp4</div>
        </div>
      )}

      <div className="h-6 bg-[#0f172a] border-t border-white/5 flex items-center justify-between px-3 text-[10px] font-mono select-none">
        <div className="flex items-center flex-1 min-w-0 mr-4">
          <StatusContent file={lastFile} />
        </div>

        <button
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 transition-colors ${
            isOpen ? 'text-blue-400 bg-white/5' : 'text-slate-500'
          }`}
        >
          <Terminal size={10} />
          <span>CONSOLE</span>
        </button>
      </div>
    </div>
  );
}

function StatusContent({ file }: { file: FileItem | null }) {
  if (!file) {
    return <span className="text-slate-500">Ready</span>;
  }

  switch (file.status) {
    case 'processing':
      return (
        <div className="flex items-center gap-2 text-blue-400">
          <Activity size={12} className="animate-pulse" />
          <span>Processing: {file.name} ({file.progress?.percent.toFixed(1)}%)</span>
        </div>
      );
    case 'completed':
      return (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle size={12} />
          <span>Finished: {file.name}</span>
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={12} />
          <span>Error: {file.name} - {file.error}</span>
        </div>
      );
    case 'cancelled':
      return (
        <div className="flex items-center gap-2 text-orange-400">
          <XCircle size={12} />
          <span>Cancelled: {file.name}</span>
        </div>
      );
    default:
      return <span className="text-slate-500">Ready</span>;
  }
}

export default memo(Footer);