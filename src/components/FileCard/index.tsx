import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { X, FileAudio, FileVideo, CheckCircle, AlertCircle, RotateCcw, Loader, AlertTriangle, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { ConversionContext } from '@/App';
import { formatFileSize, formatDuration, formatETA } from '@/utils';
import FormatSettings from './FormatSettings';
import AdvancedSettings from './AdvancedSettings';
import type { FileItem, AudioFormat, VideoFormat, ValidationResult, RecommendedFormats, ConversionProgress } from '@/types';

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

  const handleCardClick = useCallback((e: React.MouseEvent) => {
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

  const Icon = isVideo ? FileVideo : FileAudio;

  return (
    <div 
      className="glass p-4 relative group overflow-visible cursor-pointer" 
      style={{ isolation: 'isolate' }}
      onClick={handleCardClick}
    >
      {/* Progress Bar */}
      {file.status === 'processing' && file.progress && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-20 rounded-t-xl">
          <div
            className="h-full bg-primary-purple"
            style={{ width: `${file.progress.percent}%` }}
          />
        </div>
      )}

      {/* Remove Button */}
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

      {/* Validation Messages */}
      {file.status === 'pending' && validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mb-2 pr-24 space-y-1">
          {validation.errors.map((err, idx) => (
            <div
              key={`err-${idx}`}
              className="flex items-start gap-1.5 px-2 py-1 bg-red-500/10 border-l-2 border-red-500 rounded text-[10px] text-red-300 leading-tight"
            >
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5 text-red-400" />
              <span>{err}</span>
            </div>
          ))}

          {validation.warnings.map((warn, idx) => (
            <div
              key={`warn-${idx}`}
              className="flex items-start gap-1.5 px-2 py-1 bg-yellow-500/10 border-l-2 border-yellow-500 rounded text-[10px] text-yellow-300 leading-tight"
            >
              <Info size={12} className="flex-shrink-0 mt-0.5 text-yellow-400" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* FILE INFO */}
        <div className="col-span-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <Icon size={32} className={isVideo ? 'text-primary-pink' : 'text-primary-purple'} />
              <span className="px-1.5 py-0.5 rounded bg-white/10 uppercase font-mono text-[9px] text-white/70">
                {isVideo ? 'Video' : 'Audio'}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-white font-semibold truncate text-sm" title={file.name}>
                {file.name}
              </h4>
              {file.mediaInfo && (
                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/60">
                  <span>{formatDuration(file.mediaInfo.duration)}</span>
                  <span className="text-white/30">•</span>
                  <span>{formatFileSize(file.mediaInfo.file_size)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FORMAT SETTINGS */}
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

        {/* STATUS/ACTIONS */}
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

      {onCollapse && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-50 text-white/40 text-[10px] italic transition-opacity pointer-events-none">
          Click to collapse
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ProgressIndicatorProps {
  progress: ConversionProgress;
  onCancel: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress, onCancel }) => (
  <div className="w-full space-y-2">
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Loader size={16} className="animate-spin text-primary-purple" />
          <span className="text-white font-bold">{progress.percent.toFixed(1)}%</span>
        </div>
        <span className="text-white/60 text-xs">ETA: {formatETA(progress.eta_seconds)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
        {progress.fps && (
          <span className="flex items-center gap-1">
            <span className="text-white/40">FPS:</span>
            <span className="text-white font-mono">{progress.fps.toFixed(1)}</span>
          </span>
        )}
        {progress.speed && (
          <span className="flex items-center gap-1">
            <span className="text-white/40">Speed:</span>
            <span className="text-primary-pink font-mono font-bold">{progress.speed.toFixed(2)}x</span>
          </span>
        )}
      </div>
      <div className="text-xs text-white/50">
        {formatDuration(progress.current_time)} / {formatDuration(progress.total_time)}
      </div>
    </div>
    <button
      onClick={onCancel}
      className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
    >
      <X size={14} />
      Cancel
    </button>
  </div>
);

interface StatusActionsProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string | null;
  outputPath?: string;
  isRetrying: boolean;
  onRetry: () => void;
  onRemove: () => void;
}

const StatusActions: React.FC<StatusActionsProps> = ({ status, error, outputPath, isRetrying, onRetry, onRemove }) => {
  if (status === 'pending') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span>Ready to convert</span>
        </div>
        {outputPath && (
          <div className="text-xs text-green-400 truncate" title={outputPath}>
            ✓ Path set
          </div>
        )}
      </div>
    );
  }

  if (status === 'processing') {
    return null;
  }

  if (['completed', 'failed', 'cancelled'].includes(status)) {
    const statusConfig = {
      completed: { icon: CheckCircle, color: 'text-status-success', label: 'Completed' },
      failed: { icon: AlertCircle, color: 'text-status-error', label: 'Failed' },
      cancelled: { icon: X, color: 'text-orange-400', label: 'Cancelled' },
    }[status as 'completed' | 'failed' | 'cancelled']!;

    const Icon = statusConfig.icon;

    return (
      <div className="space-y-2">
        <div className={`flex items-${status === 'completed' ? 'center' : 'start'} gap-2 ${statusConfig.color}`}>
          <Icon size={20} className={status !== 'completed' ? 'mt-0.5 flex-shrink-0' : ''} />
          <div>
            <div className="text-sm font-semibold">{statusConfig.label}</div>
            {error && (
              <div className="text-xs mt-1 opacity-80 line-clamp-2" title={error}>
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-1 px-3 py-1.5 bg-primary-purple/20 hover:bg-primary-purple/30 rounded text-primary-purple text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <RotateCcw size={12} />
            Retry
          </button>
          <button
            onClick={onRemove}
            className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/60 text-xs font-semibold transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default React.memo(FileCard);