import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
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
  onCollapse?: () => void;
}

const VALIDATION_DEBOUNCE_MS = 200;

const FileCard: React.FC<FileCardProps> = ({
  file,
  onRemove,
  onRetry,
  isAdvancedOpen,
  onToggleAdvanced,
  onCollapse,
}) => {
  const conversionContext = useContext(ConversionContext);
  if (!conversionContext) throw new Error('FileCard must be used within ConversionContext');

  const { updateFile, cancelConversion } = conversionContext;
  const [formats, setFormats] = useState<(AudioFormat | VideoFormat)[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [recommendedFormats, setRecommendedFormats] = useState<RecommendedFormats | undefined>(undefined);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      const mediaType = file.settings.extractAudioOnly ? 'audio' : file.mediaInfo.media_type;

      invoke<RecommendedFormats>('get_recommended_formats', {
        videoCodec,
        audioCodec,
        mediaType: mediaType,
        width: width || null,
        height: height || null,
      })
        .then(setRecommendedFormats)
        .catch(error => console.error('Failed to get recommended formats:', error));
    }
  }, [file.mediaInfo, file.status, file.settings.extractAudioOnly]);

  useEffect(() => {
    if (file.status === 'pending' && file.mediaInfo) {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      validationTimeoutRef.current = setTimeout(() => {
        const mediaType = file.settings.extractAudioOnly ? 'audio' : file.mediaInfo.media_type || 'unknown';

        invoke<ValidationResult>('validate_conversion', {
          inputFormat: file.mediaInfo.format_name || '',
          outputFormat: file.outputFormat,
          mediaType: mediaType,
          settings: file.settings,
        })
          .then(setValidation)
          .catch(error => console.error('Validation failed:', error));
      }, VALIDATION_DEBOUNCE_MS);
    }

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
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

  // Обработка клика по карточке для сворачивания
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Игнорируем клики по интерактивным элементам
    const target = e.target as HTMLElement;
    const isInteractive = 
      target.tagName === 'BUTTON' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'INPUT' ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input');

    if (!isInteractive && onCollapse) {
      onCollapse();
    }
  }, [onCollapse]);

  return (
    <div 
      className="glass p-4 relative group overflow-visible cursor-pointer" 
      style={{ isolation: 'isolate' }}
      onClick={handleCardClick}
    >
      {file.status === 'processing' && file.progress && <ProgressBar progress={file.progress.percent} />}

      {/* Только кнопка Remove в углу для pending */}
      {file.status === 'pending' && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors"
            title="Remove from queue"
          >
            <X size={16} className="text-red-400" />
          </button>
        </div>
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
            isAdvancedOpen={isAdvancedOpen}
            onToggleAdvanced={onToggleAdvanced}
            isVideo={isVideo}
            extractAudioOnly={file.settings.extractAudioOnly}
            onToggleExtractAudio={handleExtractAudioToggle}
          />

          <AdvancedSettings
            isOpen={isAdvancedOpen}
            isAudio={isAudio}
            extractAudioOnly={file.settings.extractAudioOnly}
            settings={file.settings}
            disabled={isDisabled}
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

      {/* Hint для пользователя */}
      {onCollapse && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-50 text-white/40 text-[10px] italic transition-opacity pointer-events-none">
          Click to collapse
        </div>
      )}
    </div>
  );
};

export default React.memo(FileCard);