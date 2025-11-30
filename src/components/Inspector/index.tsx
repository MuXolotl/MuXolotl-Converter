import React, { useContext, useCallback } from 'react';
import { FileVideo, RotateCcw, Play, Square, Settings, FolderOpen } from 'lucide-react';
import { ConversionContext } from '@/App';
import { useFileSettings } from '@/hooks/useFileSettings';
import { formatDuration, formatFileSize } from '@/utils';
import FormatSelector from '@/components/FormatSelector';
import SettingsPanel from './SettingsPanel';
import ValidationBanner from './ValidationBanner';
import AudioWaveform from './AudioWaveform';
import type { FileItem, FileSettings as FileSettingsType } from '@/types';

interface InspectorProps {
  file: FileItem | null;
  selectedCount: number;
  outputFolder: string;
  onRetry: (id: string) => void;
}

const Inspector: React.FC<InspectorProps> = ({ file, selectedCount, outputFolder, onRetry }) => {
  const context = useContext(ConversionContext);

  if (!file || !context) {
    return <EmptyState selectedCount={selectedCount} />;
  }

  return (
    <InspectorContent
      file={file}
      selectedCount={selectedCount}
      outputFolder={outputFolder}
      context={context}
      onRetry={onRetry}
    />
  );
};

const EmptyState: React.FC<{ selectedCount: number }> = ({ selectedCount }) => (
  <div className="h-full flex flex-col items-center justify-center text-white/20 p-8 text-center bg-black/20">
    <Settings size={48} strokeWidth={1} className="mb-4 opacity-50" />
    <p className="text-sm">
      {selectedCount > 1
        ? `${selectedCount} files selected`
        : 'Select a file to configure'
      }
    </p>
  </div>
);

interface InspectorContentProps {
  file: FileItem;
  selectedCount: number;
  outputFolder: string;
  context: NonNullable<React.ContextType<typeof ConversionContext>>;
  onRetry: (id: string) => void;
}

const InspectorContent: React.FC<InspectorContentProps> = ({
  file,
  selectedCount,
  outputFolder,
  context,
  onRetry,
}) => {
  const { updateFile, startConversion, cancelConversion } = context;
  const { formats, recommendations, validation } = useFileSettings(file);

  const isVideo = file.mediaInfo?.media_type === 'video';
  const isAudio = file.mediaInfo?.media_type === 'audio';
  const isDisabled = file.status !== 'pending';
  const isProcessing = file.status === 'processing';
  const canConvert = file.status === 'pending' && !!outputFolder;

  // Handlers
  const handleFormatChange = useCallback((format: string) => {
    updateFile(file.id, { outputFormat: format, outputPath: undefined });
  }, [updateFile, file.id]);

  const handleSettingsChange = useCallback((updates: Partial<FileSettingsType>) => {
    updateFile(file.id, { settings: { ...file.settings, ...updates } });
  }, [updateFile, file.id, file.settings]);

  const handleExtractAudioToggle = useCallback((extract: boolean) => {
    updateFile(file.id, {
      settings: { ...file.settings, extractAudioOnly: extract },
      outputFormat: extract ? 'mp3' : 'mp4',
      outputPath: undefined,
    });
  }, [updateFile, file.id, file.settings]);

  return (
    <div className="h-full flex flex-col bg-black/20 border-l border-white/10">
      {/* Header / Preview */}
      <FileHeader file={file} isVideo={isVideo} isAudio={isAudio} />

      {/* File Details */}
      <FileDetails file={file} />

      {/* Settings */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Multi-select indicator */}
        {selectedCount > 1 && (
          <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-300">
            Editing settings for 1 of {selectedCount} selected files
          </div>
        )}

        {/* Validation */}
        {!isDisabled && validation && (
          <ValidationBanner validation={validation} />
        )}

        {/* Format Selection */}
        <Section title="Output Format">
          <div className="flex items-center gap-3">
            <FormatBadge format={file.mediaInfo?.format_name || 'unknown'} />
            <span className="text-white/30">→</span>
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

          {/* Extract Audio Toggle */}
          {isVideo && !isDisabled && (
            <label className="flex items-center gap-2 mt-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={file.settings.extractAudioOnly}
                onChange={e => handleExtractAudioToggle(e.target.checked)}
                className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-purple-500"
              />
              <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                Extract audio only
              </span>
            </label>
          )}
        </Section>

        {/* Advanced Settings */}
        <Section title="Settings">
          <SettingsPanel
            file={file}
            disabled={isDisabled}
            onChange={handleSettingsChange}
          />
        </Section>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 bg-black/30">
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
};

// Sub-components

const FileHeader: React.FC<{ file: FileItem; isVideo: boolean; isAudio: boolean }> = ({
  file,
  isVideo,
  isAudio,
}) => {
  return (
    <div className="h-36 bg-gradient-to-b from-white/5 to-transparent flex flex-col items-center justify-center relative overflow-hidden">
      {isAudio ? (
        <AudioWaveform />
      ) : (
        <FileVideo
          size={40}
          className="opacity-40 text-pink-400"
        />
      )}
      
      <div className="absolute bottom-2 left-2 right-2">
        <div className="text-xs font-mono text-white/60 bg-black/40 px-2 py-1 rounded truncate text-center backdrop-blur-sm">
          {file.name}
        </div>
      </div>
    </div>
  );
};

const FileDetails: React.FC<{ file: FileItem }> = ({ file }) => {
  const video = file.mediaInfo?.video_streams[0];
  const audio = file.mediaInfo?.audio_streams[0];

  const details = [
    { label: 'Duration', value: formatDuration(file.mediaInfo?.duration || 0) },
    { label: 'Size', value: formatFileSize(file.mediaInfo?.file_size || 0) },
    { label: 'Resolution', value: video ? `${video.width}×${video.height}` : 'N/A' },
    { label: 'Codec', value: video?.codec || audio?.codec || 'N/A' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4 border-b border-white/5">
      {details.map(({ label, value }) => (
        <div key={label}>
          <div className="text-[10px] text-white/40 uppercase">{label}</div>
          <div className="text-xs text-white font-mono">{value}</div>
        </div>
      ))}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
      {title}
    </h3>
    {children}
  </div>
);

const FormatBadge: React.FC<{ format: string }> = ({ format }) => (
  <span className="px-2 py-1 text-[10px] font-mono uppercase bg-white/5 text-white/50 rounded">
    {format.split(',')[0]}
  </span>
);

interface ActionButtonProps {
  file: FileItem;
  isProcessing: boolean;
  canConvert: boolean;
  outputFolder: string;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  file,
  isProcessing,
  canConvert,
  outputFolder,
  onStart,
  onCancel,
  onRetry,
}) => {
  if (file.status === 'pending') {
    if (!outputFolder) {
      return (
        <div className="w-full py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm text-center flex items-center justify-center gap-2">
          <FolderOpen size={16} />
          Select output folder first
        </div>
      );
    }

    return (
      <button
        onClick={onStart}
        disabled={!canConvert}
        className="w-full py-3 bg-gradient-primary rounded-lg text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play size={16} fill="currentColor" />
        Convert
      </button>
    );
  }

  if (isProcessing) {
    return (
      <button
        onClick={onCancel}
        className="w-full py-3 bg-red-500/20 text-red-400 rounded-lg font-bold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
      >
        <Square size={16} />
        Cancel
      </button>
    );
  }

  return (
    <button
      onClick={onRetry}
      className="w-full py-3 bg-white/10 text-white rounded-lg font-bold hover:bg-white/20 flex items-center justify-center gap-2 transition-colors"
    >
      <RotateCcw size={16} />
      Retry
    </button>
  );
};

export default React.memo(Inspector);