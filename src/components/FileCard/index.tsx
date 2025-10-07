import React, { useState, useEffect, useContext, useCallback } from 'react';
import { X, Music } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { ConversionContext } from '@/App';
import FileInfo from './FileInfo';
import ProgressBar from './ProgressBar';
import ProgressIndicator from './ProgressIndicator';
import ValidationMessages from './ValidationMessages';
import FormatSettings from './FormatSettings';
import AdvancedSettings from './AdvancedSettings';
import StatusActions from './StatusActions';
import type { FileItem, AudioFormat, VideoFormat, ValidationResult, RecommendedFormats } from '@/types';

interface FileCardProps {
  file: FileItem;
  onRemove: () => void;
  onRetry: () => void;
  gpuAvailable: boolean;
  isAdvancedOpen: boolean;
  onToggleAdvanced: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onRemove, onRetry, isAdvancedOpen, onToggleAdvanced }) => {
  const conversionContext = useContext(ConversionContext);
  if (!conversionContext) throw new Error('FileCard must be used within ConversionContext');

  const { updateFile, cancelConversion } = conversionContext;
  const [formats, setFormats] = useState<(AudioFormat | VideoFormat)[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [recommendedFormats, setRecommendedFormats] = useState<RecommendedFormats | undefined>(undefined);

  const isVideo = file.mediaInfo?.media_type === 'video';
  const isAudio = file.mediaInfo?.media_type === 'audio';
  const isDisabled = file.status !== 'pending';
  const shouldShowAudio = isVideo && file.settings.extractAudioOnly;

  useEffect(() => {
    const loadFormats = async () => {
      try {
        const data =
          shouldShowAudio || isAudio
            ? await invoke<AudioFormat[]>('get_audio_formats')
            : await invoke<VideoFormat[]>('get_video_formats');
        setFormats(data);
      } catch (error) {
        console.error('Failed to load formats:', error);
      }
    };
    loadFormats();
  }, [shouldShowAudio, isAudio]);

  useEffect(() => {
    if (file.mediaInfo && file.status === 'pending') {
      const videoCodec = file.mediaInfo.video_streams[0]?.codec || '';
      const audioCodec = file.mediaInfo.audio_streams[0]?.codec || '';
      const width = file.mediaInfo.video_streams[0]?.width;
      const height = file.mediaInfo.video_streams[0]?.height;

      invoke<RecommendedFormats>('get_recommended_formats', {
        videoCodec,
        audioCodec,
        mediaType: file.mediaInfo.media_type,
        width: width || null,
        height: height || null,
      })
        .then(setRecommendedFormats)
        .catch((error) => console.error('Failed to get recommended formats:', error));
    }
  }, [file.mediaInfo, file.status]);

  useEffect(() => {
    if (file.status === 'pending' && file.mediaInfo) {
      invoke<ValidationResult>('validate_conversion', {
        inputFormat: file.mediaInfo.format_name || '',
        outputFormat: file.outputFormat,
        mediaType: file.mediaInfo.media_type || 'unknown',
        settings: file.settings,
      })
        .then(setValidation)
        .catch((error) => console.error('Validation failed:', error));
    }
  }, [file.outputFormat, file.settings, file.status, file.mediaInfo]);

  const handleFormatChange = useCallback(
    (format: string) => {
      updateFile(file.id, { outputFormat: format, outputPath: undefined });
    },
    [file.id, updateFile]
  );

  const handleQualityChange = useCallback(
    (quality: string) => {
      updateFile(file.id, { settings: { ...file.settings, quality: quality as any } });
    },
    [file.id, file.settings, updateFile]
  );

  const handleSettingChange = useCallback(
    (updates: Partial<typeof file.settings>) => {
      updateFile(file.id, { settings: { ...file.settings, ...updates } });
    },
    [file.id, file.settings, updateFile]
  );

  const handleExtractAudioToggle = useCallback(
    (extractAudio: boolean) => {
      updateFile(file.id, {
        settings: { ...file.settings, extractAudioOnly: extractAudio },
        outputFormat: extractAudio ? 'mp3' : 'mp4',
        outputPath: undefined,
      });
    },
    [file.id, file.settings, updateFile]
  );

  const handleRetry = useCallback(() => {
    if (isRetrying) return;
    setIsRetrying(true);
    onRetry();
    setTimeout(() => setIsRetrying(false), 500);
  }, [isRetrying, onRetry]);

  return (
    <div className="glass p-4 relative group overflow-visible" style={{ isolation: 'isolate' }}>
      {file.status === 'processing' && file.progress && <ProgressBar progress={file.progress.percent} />}

      {file.status === 'pending' && (
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors opacity-0 group-hover:opacity-100 z-10"
        >
          <X size={16} className="text-red-400" />
        </button>
      )}

      {file.status === 'pending' && <ValidationMessages validation={validation} />}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <FileInfo file={file} isVideo={isVideo} />
        </div>

        <div className="col-span-6">
          <FormatSettings
            inputFormat={file.mediaInfo?.format_name || 'unknown'}
            outputFormat={file.outputFormat}
            quality={file.settings.quality}
            formats={formats}
            disabled={isDisabled}
            recommendedFormats={recommendedFormats}
            onFormatChange={handleFormatChange}
            onQualityChange={handleQualityChange}
          />

          {isVideo && file.status === 'pending' && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-white/5 rounded">
              <input
                type="checkbox"
                id={`extract-${file.id}`}
                checked={file.settings.extractAudioOnly}
                onChange={(e) => handleExtractAudioToggle(e.target.checked)}
                className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-primary-purple cursor-pointer"
              />
              <label
                htmlFor={`extract-${file.id}`}
                className="flex items-center gap-2 text-white/80 text-sm cursor-pointer"
              >
                <Music size={14} />
                <span>Extract audio only (Video → Audio)</span>
              </label>
            </div>
          )}

          <AdvancedSettings
            isOpen={isAdvancedOpen}
            isAudio={isAudio}
            extractAudioOnly={file.settings.extractAudioOnly}
            settings={file.settings}
            disabled={isDisabled}
            onToggle={onToggleAdvanced}
            onSettingChange={handleSettingChange}
          />
        </div>

        <div className="col-span-3">
          {file.status === 'processing' && file.progress ? (
            <ProgressIndicator progress={file.progress} onCancel={() => cancelConversion(file.id)} />
          ) : (
            <StatusActions
              status={file.status}
              error={file.error}
              outputPath={file.outputPath}
              isRetrying={isRetrying}
              onRetry={handleRetry}
              onRemove={onRemove}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FileCard);
