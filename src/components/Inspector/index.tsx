import { memo, useContext, useCallback, useState, useEffect } from 'react';
import { Play, Square, RotateCcw, FolderOpen, ArrowRight, FileVideo, Music, FileAudio } from 'lucide-react';
import { ConversionContext } from '@/App';
import { useFileSettings } from '@/hooks/useFileSettings';
import { formatDuration, formatFileSize } from '@/utils';
import FormatSelector from '@/components/FormatSelector';
import SettingsPanel from './SettingsPanel';
import ValidationBanner from './ValidationBanner';
import Tabs, { type TabId } from './Tabs';
import type { FileItem, FileSettings, ConversionContextType } from '@/types';

interface InspectorProps {
  file: FileItem | null;
  selectedCount: number;
  outputFolder: string;
  onRetry: (id: string) => void;
}

function Inspector({ file, selectedCount, outputFolder, onRetry }: InspectorProps) {
  const context = useContext(ConversionContext);

  if (!file || !context) {
    return <EmptyState selectedCount={selectedCount} />;
  }

  return (
    <InspectorContent
      file={file}
      outputFolder={outputFolder}
      context={context}
      onRetry={onRetry}
    />
  );
}

function EmptyState({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-[#1e293b] border-l border-white/5 p-4">
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
        <SettingsIcon />
      </div>
      <p className="text-xs font-medium text-center">
        {selectedCount > 1 ? `${selectedCount} files selected` : 'Select a file'}
      </p>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

interface InspectorContentProps {
  file: FileItem;
  outputFolder: string;
  context: ConversionContextType;
  onRetry: (id: string) => void;
}

function InspectorContent({ file, outputFolder, context, onRetry }: InspectorContentProps) {
  const { updateFile, startConversion, cancelConversion } = context;
  const { formats, recommendations, validation } = useFileSettings(file);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const isVideo = file.mediaInfo?.media_type === 'video';
  const isAudio = file.mediaInfo?.media_type === 'audio';
  const isExtracting = file.settings.extractAudioOnly && isVideo;
  const isDisabled = file.status !== 'pending';
  const isProcessing = file.status === 'processing';
  const canConvert = file.status === 'pending' && !!outputFolder;

  const codecName = isAudio 
    ? (file.mediaInfo?.audio_streams?.[0]?.codec || 'N/A') 
    : (file.mediaInfo?.video_streams?.[0]?.codec || 'N/A');

  useEffect(() => {
    setActiveTab('general');
  }, [file.id, isExtracting]);

  const handleFormatChange = useCallback((format: string) => {
    updateFile(file.id, { outputFormat: format, outputPath: undefined });
  }, [updateFile, file.id]);

  const handleSettingsChange = useCallback((updates: Partial<FileSettings>) => {
    if ('extractAudioOnly' in updates) {
      updateFile(file.id, {
        settings: { ...file.settings, ...updates },
        outputFormat: updates.extractAudioOnly ? 'mp3' : 'mp4',
        outputPath: undefined,
      });
    } else {
      updateFile(file.id, { settings: { ...file.settings, ...updates } });
    }
  }, [updateFile, file.id, file.settings]);

  return (
    <div className="h-full flex flex-col bg-[#1e293b] border-l border-white/5 overflow-hidden">
      {/* Preview Header */}
      <div className="h-28 shrink-0 bg-[#161e2e] relative flex flex-col items-center justify-center border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1e293b]/30 pointer-events-none" />
        <PreviewIcon isAudio={isAudio} isExtracting={isExtracting} />
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <div className="inline-block px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 max-w-full">
            <p className="text-[9px] font-mono text-white/70 truncate">{file.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="p-3 pb-1 shrink-0">
          {/* Meta Stats */}
          <div className="flex justify-between items-center mb-3 bg-black/10 p-2 rounded border border-white/5">
            <StatItem label="Dur" value={formatDuration(file.mediaInfo?.duration || 0)} />
            <div className="w-px h-4 bg-white/5" />
            <StatItem label="Size" value={formatFileSize(file.mediaInfo?.file_size || 0)} />
            <div className="w-px h-4 bg-white/5" />
            <StatItem 
              label="Codec" 
              value={codecName.toUpperCase()} 
            />
          </div>

          {/* Format Selector */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-1 text-[9px] font-mono uppercase bg-black/40 border border-white/10 text-slate-400 rounded shrink-0">
                {(file.mediaInfo?.format_name || 'raw').split(',')[0]}
              </span>
              <ArrowRight size={10} className="text-white/20 shrink-0" />
              <div className="flex-1 min-w-0">
                <FormatSelector
                  formats={formats}
                  selected={file.outputFormat}
                  onChange={handleFormatChange}
                  disabled={isDisabled}
                  recommendedFormats={recommendations}
                />
              </div>
            </div>
          </div>

          {!isDisabled && validation && (
            <div className="mb-3">
              <ValidationBanner validation={validation} />
            </div>
          )}

          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasVideo={isVideo && !isExtracting}
            hasAudio
          />
        </div>

        {/* Settings Panel */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
          <SettingsPanel
            file={file}
            activeTab={activeTab}
            disabled={isDisabled}
            onChange={handleSettingsChange}
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="p-3 border-t border-white/5 bg-[#172033] shrink-0">
        <ActionButton
          file={file}
          isProcessing={isProcessing}
          canConvert={canConvert}
          outputFolder={outputFolder}
          onStart={() => startConversion(file)}
          onCancel={() => cancelConversion(file.id)}
          onRetry={() => onRetry(file.id)}
        />
      </div>
    </div>
  );
}

function PreviewIcon({ isAudio, isExtracting }: { isAudio: boolean; isExtracting: boolean }) {
  if (isAudio) {
    return (
      <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-white/10 flex items-center justify-center">
        <Music size={24} className="text-blue-400" />
      </div>
    );
  }

  if (isExtracting) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-slate-800 rounded border border-white/10 flex items-center justify-center">
          <FileVideo size={16} className="text-slate-500" />
        </div>
        <ArrowRight size={14} className="text-blue-500 animate-pulse" />
        <div className="w-10 h-10 bg-blue-900/20 rounded border border-blue-500/30 flex items-center justify-center">
          <FileAudio size={16} className="text-blue-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-16 h-12 bg-black/30 rounded border border-white/5 flex items-center justify-center">
      <FileVideo size={20} className="text-slate-600" />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center flex-1 min-w-0 px-1">
      <div className="text-[8px] uppercase text-slate-500 font-bold">{label}</div>
      <div className="text-[10px] font-mono text-slate-300 truncate">{value}</div>
    </div>
  );
}

interface ActionButtonProps {
  file: FileItem;
  isProcessing: boolean;
  canConvert: boolean;
  outputFolder: string;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

function ActionButton({ file, isProcessing, canConvert, outputFolder, onStart, onCancel, onRetry }: ActionButtonProps) {
  const baseClasses = "w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all";
  
  if (file.status === 'pending') {
    if (!outputFolder) {
      return (
        <div className={`${baseClasses} bg-orange-500/10 border border-orange-500/30 text-orange-400 animate-pulse`}>
          <FolderOpen size={14} />
          <span>Select Folder</span>
        </div>
      );
    }
    return (
      <button
        onClick={onStart}
        disabled={!canConvert}
        className={`${baseClasses} bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Play size={14} fill="currentColor" />
        <span>Convert</span>
      </button>
    );
  }

  if (isProcessing) {
    return (
      <button
        onClick={onCancel}
        className={`${baseClasses} bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20`}
      >
        <Square size={14} fill="currentColor" />
        <span>Stop</span>
      </button>
    );
  }

  return (
    <button
      onClick={onRetry}
      className={`${baseClasses} bg-white/5 border border-white/10 text-white hover:bg-white/10`}
    >
      <RotateCcw size={14} />
      <span>Retry</span>
    </button>
  );
}

export default memo(Inspector);