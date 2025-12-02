import { memo, useCallback } from 'react';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { FolderOpen, ExternalLink } from 'lucide-react';
import { truncatePath } from '@/utils';

interface OutputFolderSelectorProps {
  outputFolder: string;
  onFolderChange: (folder: string) => void;
}

function OutputFolderSelector({ outputFolder, onFolderChange }: OutputFolderSelectorProps) {
  const handleSelect = useCallback(async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        onFolderChange(selected);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, [onFolderChange]);

  const handleOpen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!outputFolder) return;
    try {
      await invoke('open_folder', { path: outputFolder });
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [outputFolder]);

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider whitespace-nowrap">
        Output Path:
      </div>

      <div
        onClick={handleSelect}
        className={`flex-1 flex items-center justify-between gap-3 px-3 py-1.5 border rounded cursor-pointer transition-all group ${
          outputFolder
            ? 'bg-[#1e293b] border-white/10 hover:border-blue-500/50 hover:bg-[#253248]'
            : 'bg-blue-900/10 border-blue-500/30 hover:bg-blue-900/20'
        }`}
        title={outputFolder || 'Click to select output folder'}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <FolderOpen size={14} className={outputFolder ? 'text-blue-400' : 'text-blue-300 animate-pulse'} />
          <span className={`text-xs font-mono truncate ${outputFolder ? 'text-slate-300' : 'text-blue-300/70 italic'}`}>
            {outputFolder ? truncatePath(outputFolder, 35) : 'Select destination folder...'}
          </span>
        </div>

        {outputFolder && (
          <button
            onClick={handleOpen}
            className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Open in Explorer"
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(OutputFolderSelector);