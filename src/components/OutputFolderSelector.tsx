import React, { useCallback } from 'react';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { FolderOpen, ExternalLink } from 'lucide-react';
import { truncatePath } from '@/utils';

interface OutputFolderSelectorProps {
  outputFolder: string;
  onFolderChange: (folder: string) => void;
}

const OutputFolderSelector: React.FC<OutputFolderSelectorProps> = ({ outputFolder, onFolderChange }) => {
  const handleSelectOutputFolder = useCallback(async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        onFolderChange(selected);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, [onFolderChange]);

  const handleOpenOutputFolder = useCallback(async () => {
    if (!outputFolder) return;
    try {
      await invoke('open_folder', { path: outputFolder });
    } catch (error) {
      console.error('Failed to open folder:', error);
      alert(`Failed to open folder: ${error}`);
    }
  }, [outputFolder]);

  return (
    <div className="flex gap-2 items-stretch">
      <button
        onClick={handleSelectOutputFolder}
        className="glass px-4 py-3 flex items-center gap-2 hover:bg-white/10 transition-colors flex-1 min-w-0"
        title={outputFolder || 'Click to select output folder'}
      >
        <FolderOpen size={18} className="text-primary-purple flex-shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          {outputFolder ? (
            <>
              <div className="text-white text-xs font-semibold">Output Folder:</div>
              <div className="text-white/80 text-xs truncate font-mono">{truncatePath(outputFolder)}</div>
            </>
          ) : (
            <div className="text-white text-sm font-semibold">Select Output Folder</div>
          )}
        </div>
      </button>

      <button
        onClick={handleOpenOutputFolder}
        disabled={!outputFolder}
        className={`glass px-3 py-3 flex items-center justify-center transition-all flex-shrink-0 w-12 ${
          outputFolder ? 'hover:bg-white/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'
        }`}
        title={outputFolder ? 'Open output folder' : 'No folder selected'}
      >
        <ExternalLink
          size={18}
          className={`${outputFolder ? 'text-primary-pink hover:scale-110' : 'text-white/40'} transition-all`}
        />
      </button>
    </div>
  );
};

export default React.memo(OutputFolderSelector);