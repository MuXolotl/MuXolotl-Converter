import React, { useCallback } from 'react';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { FolderOpen, ExternalLink } from 'lucide-react';
import { truncatePath } from '@/utils';

interface OutputFolderSelectorProps {
  outputFolder: string;
  onFolderChange: (folder: string) => void;
}

const OutputFolderSelector: React.FC<OutputFolderSelectorProps> = ({
  outputFolder,
  onFolderChange,
}) => {
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

  const handleOpen = useCallback(async () => {
    if (!outputFolder) return;
    try {
      await invoke('open_folder', { path: outputFolder });
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [outputFolder]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleSelect}
        className="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-white/5 rounded transition-colors"
        title={outputFolder || 'Select output folder'}
      >
        <FolderOpen size={14} className="text-purple-400" />
        {outputFolder ? (
          <span className="text-white/70 font-mono max-w-[150px] truncate">
            {truncatePath(outputFolder, 20)}
          </span>
        ) : (
          <span className="text-white/50">Select folder...</span>
        )}
      </button>

      {outputFolder && (
        <button
          onClick={handleOpen}
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
          title="Open folder"
        >
          <ExternalLink size={14} />
        </button>
      )}
    </div>
  );
};

export default React.memo(OutputFolderSelector);