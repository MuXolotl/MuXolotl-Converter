import { memo, useContext, useCallback, useState, useEffect } from 'react';
import { Play, Square, RotateCcw, FolderOpen, ArrowRight, FileVideo, Music, FileAudio } from 'lucide-react';
import { ConversionContext } from '@/App';
import { useFileSettings } from '@/hooks/useFileSettings';
import { formatDuration, formatFileSize } from '@/utils';
import FormatSelector from '@/components/FormatSelector';
import SettingsPanel from './SettingsPanel';
import ValidationBanner from './ValidationBanner';
import Tabs, { type TabId } from './Tabs';
import AudioWaveform from './AudioWaveform';
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
    <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-[#1e293b] border-l border-white/5">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <SettingsIcon />
      </div>
      <p className="text-sm font-medium">
        {selectedCount > 1 ? `${selectedCount} files selected` : 'Select a file to edit settings'}
      </p>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
    <div className="h-full flex flex-col bg-[#1e293b] border-l border-white/5">
      <PreviewHeader file={file} isAudio={isAudio} isExtracting={isExtracting} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-6 pb-2 shrink-0">
          <MetaStats file={file} isAudio={isAudio} />

          <div className="mb-4">
            <div className="flex items-center gap-3">
              <FormatBadge format={file.mediaInfo?.format_name || 'raw'} />
              <span className="text-white/20">→</span>
              <div className="flex-1">
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
            <div className="mb-4">
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

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <SettingsPanel
            file={file}
            activeTab={activeTab}
            disabled={isDisabled}
            onChange={handleSettingsChange}
          />
        </div>
      </div>

      <div className="p-6 border-t border-white/5 bg-[#172033]">
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

function PreviewHeader({ file, isAudio, isExtracting }: { file: FileItem; isAudio: boolean; isExtracting: boolean }) {
  return (
    <div className="h-48 shrink-0 bg-[#161e2e] relative flex flex-col items-center justify-center border-b border-white/5 overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1e293b]/30 pointer-events-none" />
      <div className="relative z-10">
        <PreviewIcon isAudio={isAudio} isExtracting={isExtracting} />
      </div>
      <div className="absolute bottom-3 left-4 right-4 text-center">
        <div className="inline-block px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5 max-w-full">
          <p className="text-xs font-mono text-white/70 truncate">{file.name}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewIcon({ isAudio, isExtracting }: { isAudio: boolean; isExtracting: boolean }) {
  if (isAudio) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-48 h-24 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden">
          <AudioWaveform />
          <div className="absolute inset-0 flex items-center justify-center">
            <Music size={32} className="text-white/20" />
          </div>
        </div>
        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Audio File</span>
      </div>
    );
  }

  if (isExtracting) {
    return (
      <div className="flex items-center gap-4">
        <div className="w-20 h-14 bg-slate-800 rounded border border-white/10 flex items-center justify-center relative">
          <FileVideo size={24} className="text-slate-500" />
          <span className="absolute bottom-1 right-1 text-[8px] bg-black/50 px-1 rounded text-white/70">MOV</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-blue-500">
          <span className="text-[9px] font-bold uppercase tracking-wider">Extract</span>
          <ArrowRight size={20} className="animate-pulse" />
        </div>
        <div className="w-20 h-14 bg-blue-900/20 rounded border border-blue-500/30 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-x-2 inset-y-4 opacity-50">
            <AudioWaveform />
          </div>
          <FileAudio size={24} className="text-blue-400 relative z-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-48 h-28 bg-black/30 rounded-lg border border-white/5 flex items-center justify-center relative group-hover:border-white/10 transition-colors">
        <FileVideo size={48} className="text-slate-600 group-hover:text-slate-500 transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center border border-white/10">
            <Play size={16} className="text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Video Preview</span>
    </div>
  );
}

function MetaStats({ file, isAudio }: { file: FileItem; isAudio: boolean }) {
  const codec = isAudio
    ? file.mediaInfo?.audio_streams[0]?.codec
    : file.mediaInfo?.video_streams[0]?.codec;

  return (
    <div className="flex justify-between items-center mb-6 px-1 bg-black/10 p-3 rounded-lg border border-white/5">
      <StatItem label="Duration" value={formatDuration(file.mediaInfo?.duration || 0)} />
      <div className="w-px h-6 bg-white/5" />
      <StatItem label="Size" value={formatFileSize(file.mediaInfo?.file_size || 0)} />
      <div className="w-px h-6 bg-white/5" />
      <StatItem label="Codec" value={(codec || 'N/A').toUpperCase()} />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">{label}</div>
      <div className="text-xs font-mono text-slate-300">{value}</div>
    </div>
  );
}

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="px-2 py-1.5 text-[10px] font-mono uppercase bg-black/40 border border-white/10 text-slate-400 rounded min-w-[50px] text-center">
      {format.split(',')[0]}
    </span>
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
  if (file.status === 'pending') {
    if (!outputFolder) {
      return (
        <div className="w-full py-3.5 bg-orange-500/10 border border-orange-500/30 rounded text-orange-400 text-sm font-medium text-center flex items-center justify-center gap-2 animate-pulse">
          <FolderOpen size={18} />
          <span>Select Output Folder</span>
        </div>
      );
    }
    return (
      <button
        onClick={onStart}
        disabled={!canConvert}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded font-bold text-white shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play size={18} fill="currentColor" /> Convert File
      </button>
    );
  }

  if (isProcessing) {
    return (
      <button
        onClick={onCancel}
        className="w-full py-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
      >
        <Square size={18} fill="currentColor" /> Stop
      </button>
    );
  }

  return (
    <button
      onClick={onRetry}
      className="w-full py-3.5 bg-white/5 border border-white/10 text-white rounded font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
    >
      <RotateCcw size={18} /> Convert Again
    </button>
  );
}

export default memo(Inspector);