import React, { useState, useEffect, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileAudio,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Loader,
  Music,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import FormatSelector from './FormatSelector';
import { ConversionContext } from '@/App';
import {
  QUALITY_OPTIONS,
  AUDIO_SAMPLE_RATES,
  AUDIO_CHANNELS,
  VIDEO_RESOLUTIONS,
  VIDEO_FPS,
  formatFileSize,
  formatDuration,
  formatETA,
} from '@/constants';
import type { FileItem, AudioFormat, VideoFormat, ValidationResult, ConversionProgress, RecommendedFormats } from '@/types';

interface FileCardProps {
  file: FileItem;
  onRemove: () => void;
  onRetry: () => void;
  gpuAvailable: boolean;
  isAdvancedOpen: boolean;
  onToggleAdvanced: () => void;
}

const FileInfo = React.memo<{ file: FileItem; isVideo: boolean }>(({ file, isVideo }) => (
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0 mt-1">
      {isVideo ? (
        <FileVideo size={40} className="text-primary-pink" />
      ) : (
        <FileAudio size={40} className="text-primary-purple" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-white font-semibold truncate" title={file.name}>
        {file.name}
      </h4>
      <div className="flex flex-col gap-1 mt-1 text-xs text-white/60">
        <span className="px-2 py-0.5 rounded bg-white/10 uppercase font-mono inline-block w-fit">
          {isVideo ? 'Video' : 'Audio'}
        </span>
        {file.mediaInfo && (
          <>
            <span>{formatDuration(file.mediaInfo.duration)}</span>
            <span>{formatFileSize(file.mediaInfo.file_size)}</span>
          </>
        )}
      </div>
    </div>
  </div>
));
FileInfo.displayName = 'FileInfo';

const ProgressBar = React.memo<{ progress: number }>(({ progress }) => (
  <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-20">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className="h-full bg-gradient-primary shadow-lg shadow-primary-purple/50"
      transition={{ duration: 0.3 }}
    />
  </div>
));
ProgressBar.displayName = 'ProgressBar';

const ProgressIndicator = React.memo<{ progress: ConversionProgress; onCancel: () => void }>(
  ({ progress, onCancel }) => (
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
  )
);
ProgressIndicator.displayName = 'ProgressIndicator';

const ValidationMessages = React.memo<{ validation: ValidationResult | null }>(({ validation }) => {
  if (!validation) return null;

  return (
    <>
      {validation.errors.length > 0 && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded">
          <div className="text-red-400 text-xs font-semibold mb-1">⚠️ Validation Errors:</div>
          {validation.errors.map((err, idx) => (
            <div key={idx} className="text-red-300 text-xs">
              • {err}
            </div>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded">
          <div className="text-yellow-400 text-xs font-semibold mb-1">ℹ️ Warnings:</div>
          {validation.warnings.map((warn, idx) => (
            <div key={idx} className="text-yellow-300 text-xs">
              • {warn}
            </div>
          ))}
        </div>
      )}
    </>
  );
});
ValidationMessages.displayName = 'ValidationMessages';

const FileCard: React.FC<FileCardProps> = React.memo(
  ({ file, onRemove, onRetry, gpuAvailable, isAdvancedOpen, onToggleAdvanced }) => {
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
          const data = shouldShowAudio || isAudio
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
          .catch(error => console.error('Failed to get recommended formats:', error));
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
          .catch(error => console.error('Validation failed:', error));
      }
    }, [file.outputFormat, file.settings, file.status, file.mediaInfo]);

    const handleFormatChange = useCallback(
      (format: string) => {
        updateFile(file.id, { outputFormat: format, outputPath: undefined });
      },
      [file.id, updateFile]
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

    const selectClassName =
      'w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-primary-purple cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

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
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <label className="block text-white/60 text-xs mb-1">Input</label>
                <div
                  className="px-2 py-1.5 rounded bg-white/5 text-white uppercase font-mono text-xs text-center overflow-hidden"
                  title={file.mediaInfo?.format_name || 'unknown'}
                >
                  <div className="truncate">{(file.mediaInfo?.format_name || 'unknown').split(',')[0]}</div>
                </div>
              </div>

              <div className="col-span-1 flex items-end justify-center pb-2">
                <span className="text-white/40 text-lg">→</span>
              </div>

              <div className="col-span-4">
                <label className="block text-white/60 text-xs mb-1">Output</label>
                <FormatSelector
                  formats={formats}
                  selected={file.outputFormat}
                  onChange={handleFormatChange}
                  disabled={isDisabled}
                  recommendedFormats={recommendedFormats}
                />
              </div>

              <div className="col-span-4">
                <label className="block text-white/60 text-xs mb-1">Quality</label>
                <select
                  value={file.settings.quality}
                  onChange={e => handleSettingChange({ quality: e.target.value as any })}
                  disabled={isDisabled}
                  className={selectClassName}
                >
                  {QUALITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isVideo && file.status === 'pending' && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-white/5 rounded">
                <input
                  type="checkbox"
                  id={`extract-${file.id}`}
                  checked={file.settings.extractAudioOnly}
                  onChange={e => handleExtractAudioToggle(e.target.checked)}
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

            {file.status === 'pending' && (
              <button
                onClick={onToggleAdvanced}
                className="mt-3 flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
              >
                {isAdvancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span>Advanced Settings</span>
              </button>
            )}

            <AnimatePresence>
              {isAdvancedOpen && file.status === 'pending' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(isAudio || file.settings.extractAudioOnly) && (
                      <>
                        <div>
                          <label className="block text-white/60 text-xs mb-1">Sample Rate</label>
                          <select
                            value={file.settings.sampleRate || 44100}
                            onChange={e => handleSettingChange({ sampleRate: parseInt(e.target.value) })}
                            className={selectClassName}
                          >
                            {AUDIO_SAMPLE_RATES.map(rate => (
                              <option key={rate} value={rate}>
                                {rate} Hz
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-white/60 text-xs mb-1">Channels</label>
                          <select
                            value={file.settings.channels || 2}
                            onChange={e => handleSettingChange({ channels: parseInt(e.target.value) })}
                            className={selectClassName}
                          >
                            {AUDIO_CHANNELS.map(ch => (
                              <option key={ch.value} value={ch.value}>
                                {ch.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {file.settings.quality === 'custom' && (
                          <div>
                            <label className="block text-white/60 text-xs mb-1">Bitrate (kbps)</label>
                            <input
                              type="number"
                              value={file.settings.bitrate || 192}
                              onChange={e => handleSettingChange({ bitrate: parseInt(e.target.value) })}
                              min="64"
                              max="320"
                              step="32"
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-primary-purple"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {isVideo && !file.settings.extractAudioOnly && (
                      <>
                        <div>
                          <label className="block text-white/60 text-xs mb-1">Resolution</label>
                          <select
                            value={
                              file.settings.width && file.settings.height
                                ? `${file.settings.width}x${file.settings.height}`
                                : 'original'
                            }
                            onChange={e => {
                              const value = e.target.value;
                              if (value === 'original') {
                                handleSettingChange({ width: undefined, height: undefined });
                              } else {
                                const [w, h] = value.split('x').map(Number);
                                handleSettingChange({ width: w, height: h });
                              }
                            }}
                            className={selectClassName}
                          >
                            {VIDEO_RESOLUTIONS.map(res => (
                              <option key={res.value} value={res.value}>
                                {res.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-white/60 text-xs mb-1">Frame Rate</label>
                          <select
                            value={file.settings.fps?.toString() || 'original'}
                            onChange={e => {
                              const value = e.target.value;
                              handleSettingChange({ fps: value === 'original' ? undefined : parseInt(value) });
                            }}
                            className={selectClassName}
                          >
                            {VIDEO_FPS.map(fps => (
                              <option key={fps.value} value={fps.value}>
                                {fps.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="col-span-3">
            {file.status === 'pending' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Ready to convert</span>
                </div>
                {file.outputPath && (
                  <div className="text-xs text-green-400 truncate" title={file.outputPath}>
                    ✓ Path set
                  </div>
                )}
              </div>
            )}

            {file.status === 'processing' && file.progress && (
              <ProgressIndicator progress={file.progress} onCancel={() => cancelConversion(file.id)} />
            )}

            {['completed', 'failed', 'cancelled'].includes(file.status) && (
              <div className="space-y-2">
                <div
                  className={`flex items-${file.status === 'completed' ? 'center' : 'start'} gap-2 ${
                    file.status === 'completed'
                      ? 'text-status-success'
                      : file.status === 'failed'
                        ? 'text-status-error'
                        : 'text-orange-400'
                  }`}
                >
                  {file.status === 'completed' ? (
                    <CheckCircle size={20} />
                  ) : file.status === 'failed' ? (
                    <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  ) : (
                    <X size={20} />
                  )}
                  <div>
                    <div className="text-sm font-semibold capitalize">{file.status}</div>
                    {file.error && (
                      <div className="text-xs mt-1 opacity-80 line-clamp-2" title={file.error}>
                        {file.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetry}
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
            )}
          </div>
        </div>
      </div>
    );
  }
);

FileCard.displayName = 'FileCard';

export default FileCard;