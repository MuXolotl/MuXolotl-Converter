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
    <div
      onClick={handleSelect}
      className={`flex items-center gap-2 px-2 py-1 border rounded cursor-pointer transition-all min-w-0 max-w-full ${
        outputFolder
          ? 'bg-[#1e293b] border-white/10 hover:border-blue-500/50'
          : 'bg-blue-900/10 border-blue-500/30 hover:bg-blue-900/20'
      }`}
      title={outputFolder || 'Click to select output folder'}
    >
      <FolderOpen size={12} className={`shrink-0 ${outputFolder ? 'text-blue-400' : 'text-blue-300 animate-pulse'}`} />
      
      <span className={`text-[10px] font-mono truncate min-w-0 ${outputFolder ? 'text-slate-300' : 'text-blue-300/70 italic'}`}>
        {outputFolder ? truncatePath(outputFolder, 25) : 'Output...'}
      </span>

      {outputFolder && (
        <button
          onClick={handleOpen}
          className="p-0.5 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0"
          title="Open in Explorer"
        >
          <ExternalLink size={10} />
        </button>
      )}
    </div>
  );
}

export default memo(OutputFolderSelector);