import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { generateOutputPath } from '@/utils';
import type { FileItem, ConversionProgress, GpuInfo, ConversionContextType } from '@/types';

const PROGRESS_THROTTLE_MS = 100;

export function useConversion(
  updateFile: (id: string, updates: Partial<FileItem>) => void,
  gpuInfo: GpuInfo,
  filesRef: React.MutableRefObject<FileItem[]>,
  outputFolder: string,
  onError?: (file: FileItem, error: string) => void
): ConversionContextType {
  const [activeCount, setActiveCount] = useState(0);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const throttleTimers = useRef<Map<string, number>>(new Map());

  // Setup event listeners
  useEffect(() => {
    const setup = async () => {
      const listeners = await Promise.all([
        // Progress updates
        listen<ConversionProgress>('conversion-progress', e => {
          const { task_id, percent } = e.payload;
          const now = Date.now();
          const lastUpdate = throttleTimers.current.get(task_id) || 0;
          
          if (now - lastUpdate < PROGRESS_THROTTLE_MS && percent > 0 && percent < 100) {
            return;
          }

          throttleTimers.current.set(task_id, now);
          updateFile(task_id, { 
            status: 'processing', 
            progress: e.payload 
          });
        }),

        // Completed successfully
        listen<string>('conversion-completed', e => {
          const taskId = e.payload;
          throttleTimers.current.delete(taskId);
          updateFile(taskId, {
            status: 'completed',
            progress: null,
            completedAt: Date.now(),
          });
          setActiveCount(c => Math.max(0, c - 1));
        }),

        // Cancelled by user - NOT an error
        listen<string>('conversion-cancelled', e => {
          const taskId = e.payload;
          throttleTimers.current.delete(taskId);
          console.log('[Conversion] Cancelled:', taskId);
          updateFile(taskId, {
            status: 'cancelled',
            progress: null,
            completedAt: Date.now(),
          });
          setActiveCount(c => Math.max(0, c - 1));
        }),

        // Error - show error modal
        listen<{ task_id: string; error: string }>('conversion-error', e => {
          const { task_id, error } = e.payload;
          throttleTimers.current.delete(task_id);
          
          // Find the file for error callback
          const file = filesRef.current.find(f => f.id === task_id);
          if (file && onError) {
            onError(file, error);
          }
          
          updateFile(task_id, {
            status: 'failed',
            error: error,
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
      throttleTimers.current.clear();
    };
  }, [updateFile, filesRef, onError]);

  const startConversion = useCallback(async (file: FileItem) => {
    if (!outputFolder) {
      const error = 'No output folder selected. Please select an output folder first.';
      updateFile(file.id, { status: 'failed', error });
      if (onError) onError(file, error);
      return;
    }

    if (!file.mediaInfo) {
      const error = 'File has no media information. The file might be corrupted.';
      updateFile(file.id, { status: 'failed', error });
      if (onError) onError(file, error);
      return;
    }

    try {
      const outputPath = generateOutputPath(file, outputFolder);
      
      console.log('[Conversion] Starting:', {
        id: file.id,
        input: file.path,
        output: outputPath,
        format: file.outputFormat,
      });

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
      
      let command: string;
      if (isAudio) {
        command = 'convert_audio';
      } else if (extractAudio) {
        command = 'extract_audio';
      } else {
        command = 'convert_video';
      }

      // Build settings with snake_case only
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
      console.error('[Conversion] Error:', errorMessage);
      
      updateFile(file.id, { 
        status: 'failed', 
        error: errorMessage,
        progress: null,
      });
      
      if (onError) onError(file, errorMessage);
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
      console.log('[Conversion] Requesting cancel:', id);
      await invoke('cancel_conversion', { taskId: id });
      // Status will be updated by the 'conversion-cancelled' event listener
    } catch (e) {
      console.error('[Conversion] Cancel failed:', e);
      // If cancel command fails, update status manually
      throttleTimers.current.delete(id);
      updateFile(id, { 
        status: 'cancelled', 
        progress: null,
        completedAt: Date.now(),
      });
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