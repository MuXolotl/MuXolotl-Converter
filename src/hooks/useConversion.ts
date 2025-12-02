import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { APP_CONFIG } from '@/config';
import { generateOutputPath } from '@/utils';
import type { FileItem, ConversionProgress, GpuInfo, ConversionContextType } from '@/types';

export function useConversion(
  updateFile: (id: string, updates: Partial<FileItem>) => void,
  gpuInfo: GpuInfo,
  filesRef: React.MutableRefObject<FileItem[]>,
  outputFolder: string,
  onError?: (file: FileItem, error: string) => void
): ConversionContextType {
  const [activeCount, setActiveCount] = useState(0);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const lastUpdateRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const setup = async () => {
      const listeners = await Promise.all([
        listen<ConversionProgress>('conversion-progress', e => {
          const { task_id, percent } = e.payload;
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(task_id) || 0;

          if (now - lastUpdate < APP_CONFIG.limits.progressThrottleMs && percent > 0 && percent < 100) {
            return;
          }

          lastUpdateRef.current.set(task_id, now);
          updateFile(task_id, { status: 'processing', progress: e.payload });
        }),

        listen<string>('conversion-completed', e => {
          const taskId = e.payload;
          lastUpdateRef.current.delete(taskId);
          updateFile(taskId, {
            status: 'completed',
            progress: null,
            completedAt: Date.now(),
          });
          setActiveCount(c => Math.max(0, c - 1));
        }),

        listen<string>('conversion-cancelled', e => {
          const taskId = e.payload;
          lastUpdateRef.current.delete(taskId);
          updateFile(taskId, {
            status: 'cancelled',
            progress: null,
            completedAt: Date.now(),
          });
          setActiveCount(c => Math.max(0, c - 1));
        }),

        listen<{ task_id: string; error: string }>('conversion-error', e => {
          const { task_id, error } = e.payload;
          lastUpdateRef.current.delete(task_id);

          const file = filesRef.current.find(f => f.id === task_id);
          if (file && onError) {
            onError(file, error);
          }

          updateFile(task_id, {
            status: 'failed',
            error,
            progress: null,
            completedAt: Date.now(),
          });
          setActiveCount(c => Math.max(0, c - 1));
        }),
      ]);

      unlistenRef.current = listeners;
    };

    setup();

    return () => {
      unlistenRef.current.forEach(fn => fn());
      lastUpdateRef.current.clear();
    };
  }, [updateFile, filesRef, onError]);

  const startConversion = useCallback(async (file: FileItem) => {
    if (!outputFolder) {
      const error = 'No output folder selected';
      updateFile(file.id, { status: 'failed', error });
      onError?.(file, error);
      return;
    }

    if (!file.mediaInfo) {
      const error = 'File has no media information';
      updateFile(file.id, { status: 'failed', error });
      onError?.(file, error);
      return;
    }

    try {
      const outputPath = generateOutputPath(file, outputFolder);
      setActiveCount(c => c + 1);

      updateFile(file.id, {
        outputPath,
        status: 'processing',
        error: null,
        progress: {
          task_id: file.id,
          percent: 0,
          fps: null,
          speed: null,
          eta_seconds: null,
          current_time: 0,
          total_time: file.mediaInfo.duration || 1,
        },
      });

      const isAudio = file.mediaInfo.media_type === 'audio';
      const extractAudio = file.settings.extractAudioOnly;

      const command = isAudio ? 'convert_audio' : extractAudio ? 'extract_audio' : 'convert_video';

      const settings = {
        task_id: file.id,
        quality: file.settings.quality,
        bitrate: file.settings.bitrate,
        sample_rate: file.settings.sampleRate,
        channels: file.settings.channels,
        width: file.settings.width,
        height: file.settings.height,
        fps: file.settings.fps,
        video_codec: file.settings.videoCodec,
        audio_codec: file.settings.audioCodec,
        use_gpu: file.settings.useGpu,
        copy_audio: file.settings.copyAudio,
        extract_audio_only: file.settings.extractAudioOnly,
        metadata: file.settings.metadata,
      };

      const params: Record<string, unknown> = {
        input: file.path,
        output: outputPath,
        format: file.outputFormat,
        settings,
      };

      if (command === 'convert_video') {
        params.gpuInfo = gpuInfo;
      }

      await invoke(command, params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateFile(file.id, { status: 'failed', error: errorMessage, progress: null });
      onError?.(file, errorMessage);
      setActiveCount(c => Math.max(0, c - 1));
    }
  }, [gpuInfo, updateFile, outputFolder, onError]);

  const startAll = useCallback(async () => {
    if (!outputFolder) return;
    const pending = filesRef.current.filter(f => f.status === 'pending');
    for (const file of pending) {
      await startConversion(file);
    }
  }, [filesRef, startConversion, outputFolder]);

  const cancelConversion = useCallback(async (id: string) => {
    try {
      await invoke('cancel_conversion', { taskId: id });
    } catch {
      lastUpdateRef.current.delete(id);
      updateFile(id, { status: 'cancelled', progress: null, completedAt: Date.now() });
      setActiveCount(c => Math.max(0, c - 1));
    }
  }, [updateFile]);

  const cancelAll = useCallback(async () => {
    const processing = filesRef.current.filter(f => f.status === 'processing');
    await Promise.all(processing.map(f => cancelConversion(f.id)));
  }, [filesRef, cancelConversion]);

  return {
    isConverting: activeCount > 0,
    activeCount,
    startConversion,
    startAll,
    cancelConversion,
    cancelAll,
    updateFile,
  };
}