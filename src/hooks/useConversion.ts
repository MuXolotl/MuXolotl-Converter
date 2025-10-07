import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import type { FileItem, ConversionProgress, GpuInfo, ConversionContextType } from '@/types';

const PROGRESS_THROTTLE_MS = 50;

export const useConversion = (
  updateFile: (fileId: string, updates: Partial<FileItem>) => void,
  gpuInfo: GpuInfo
): ConversionContextType => {
  const [isConverting, setIsConverting] = useState(false);
  const progressTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const unlistenFns = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setupListeners = async () => {
      const listeners = await Promise.all([
        listen<string>('conversion-started', (event) => {
          console.log('✅ Conversion started:', event.payload);
        }),

        listen<ConversionProgress>('conversion-progress', (event) => {
          const progress = event.payload;
          const existing = progressTimeouts.current.get(progress.task_id);

          if (existing) clearTimeout(existing);

          const timeout = setTimeout(() => {
            updateFile(progress.task_id, { status: 'processing', progress });
            progressTimeouts.current.delete(progress.task_id);
          }, PROGRESS_THROTTLE_MS);

          progressTimeouts.current.set(progress.task_id, timeout);
        }),

        listen<string>('conversion-completed', (event) => {
          const taskId = event.payload;
          console.log('✅ Conversion completed:', taskId);

          const timeout = progressTimeouts.current.get(taskId);
          if (timeout) {
            clearTimeout(timeout);
            progressTimeouts.current.delete(taskId);
          }

          updateFile(taskId, {
            status: 'completed',
            progress: null,
            completedAt: Date.now(),
          });
          setIsConverting(false);
        }),

        listen<{ task_id: string; error: string }>('conversion-error', (event) => {
          console.error('❌ Conversion error:', event.payload);

          const timeout = progressTimeouts.current.get(event.payload.task_id);
          if (timeout) {
            clearTimeout(timeout);
            progressTimeouts.current.delete(event.payload.task_id);
          }

          updateFile(event.payload.task_id, {
            status: 'failed',
            error: event.payload.error,
            completedAt: Date.now(),
          });
          setIsConverting(false);
        }),
      ]);

      unlistenFns.current = listeners;
    };

    setupListeners();

    return () => {
      progressTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      progressTimeouts.current.clear();
      unlistenFns.current.forEach((fn) => fn());
      unlistenFns.current = [];
    };
  }, [updateFile]);

  const selectOutputPath = async (file: FileItem, outputFormat: string): Promise<string | null> => {
    const inputName = file.name.substring(0, file.name.lastIndexOf('.'));
    const defaultFileName = `${inputName}_converted.${outputFormat}`;

    return await save({
      defaultPath: defaultFileName,
      filters: [{ name: outputFormat.toUpperCase(), extensions: [outputFormat] }],
    });
  };

  const startConversion = useCallback(
    async (file: FileItem) => {
      try {
        const outputFormat = file.outputFormat;
        let outputPath = file.outputPath;

        if (!outputPath) {
          const selected = await selectOutputPath(file, outputFormat);
          if (!selected) {
            console.log('❌ User cancelled output path selection');
            return;
          }
          outputPath = selected;
          updateFile(file.id, { outputPath });
        }

        setIsConverting(true);
        updateFile(file.id, {
          status: 'processing',
          progress: {
            task_id: file.id,
            percent: 0,
            fps: null,
            speed: null,
            eta_seconds: null,
            current_time: 0,
            total_time: file.mediaInfo?.duration || 0,
          },
        });

        console.log('🚀 Starting conversion:', {
          input: file.path,
          output: outputPath,
          format: outputFormat,
        });

        const conversionSettings = {
          taskId: file.id,
          quality: file.settings.quality,
          bitrate: file.settings.bitrate,
          sampleRate: file.settings.sampleRate,
          channels: file.settings.channels,
          useGpu: file.settings.useGpu,
        };

        const isVideo = file.mediaInfo?.media_type === 'video';
        const extractAudio = file.settings.extractAudioOnly;

        if (extractAudio && isVideo) {
          await invoke<string>('extract_audio', {
            input: file.path,
            output: outputPath,
            format: outputFormat,
            settings: { ...conversionSettings, copyAudio: false },
          });
        } else if (file.mediaInfo?.media_type === 'audio') {
          await invoke<string>('convert_audio', {
            input: file.path,
            output: outputPath,
            format: outputFormat,
            settings: conversionSettings,
          });
        } else if (isVideo) {
          await invoke<string>('convert_video', {
            input: file.path,
            output: outputPath,
            format: outputFormat,
            gpuInfo,
            settings: conversionSettings,
          });
        }
      } catch (error) {
        console.error('❌ Conversion failed:', error);
        updateFile(file.id, {
          status: 'failed',
          error: String(error),
          completedAt: Date.now(),
        });
        setIsConverting(false);
        throw error;
      }
    },
    [updateFile, gpuInfo]
  );

  const cancelConversion = useCallback(
    async (fileId: string) => {
      try {
        await invoke('cancel_conversion', { taskId: fileId });

        const timeout = progressTimeouts.current.get(fileId);
        if (timeout) {
          clearTimeout(timeout);
          progressTimeouts.current.delete(fileId);
        }

        updateFile(fileId, {
          status: 'cancelled',
          progress: null,
          completedAt: Date.now(),
        });
        setIsConverting(false);
      } catch (error) {
        console.error('Failed to cancel conversion:', error);
      }
    },
    [updateFile]
  );

  return { updateFile, startConversion, cancelConversion, isConverting };
};
