import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import type { FileItem, ConversionProgress, GpuInfo, ConversionContextType } from '@/types';

export const useConversion = (
  updateFile: (fileId: string, updates: Partial<FileItem>) => void,
  gpuInfo: GpuInfo
): ConversionContextType => {
  const [isConverting, setIsConverting] = useState(false);
  const progressUpdateTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const unlistenStart = listen<string>('conversion-started', event => {
      console.log('✅ Conversion started:', event.payload);
    });

    const unlistenProgress = listen<ConversionProgress>('conversion-progress', event => {
      const progress = event.payload;
      const existingTimeout = progressUpdateTimeouts.current.get(progress.task_id);
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeout = setTimeout(() => {
        updateFile(progress.task_id, { status: 'processing', progress });
        progressUpdateTimeouts.current.delete(progress.task_id);
      }, 50);

      progressUpdateTimeouts.current.set(progress.task_id, timeout);
    });

    const unlistenComplete = listen<string>('conversion-completed', event => {
      console.log('✅ Conversion completed:', event.payload);
      const taskId = event.payload;
      const timeout = progressUpdateTimeouts.current.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        progressUpdateTimeouts.current.delete(taskId);
      }
      updateFile(taskId, { status: 'completed', progress: null, completedAt: Date.now() });
      setIsConverting(false);
    });

    const unlistenError = listen<{ task_id: string; error: string }>('conversion-error', event => {
      console.error('❌ Conversion error:', event.payload);
      const timeout = progressUpdateTimeouts.current.get(event.payload.task_id);
      if (timeout) {
        clearTimeout(timeout);
        progressUpdateTimeouts.current.delete(event.payload.task_id);
      }
      updateFile(event.payload.task_id, {
        status: 'failed',
        error: event.payload.error,
        completedAt: Date.now(),
      });
      setIsConverting(false);
    });

    return () => {
      progressUpdateTimeouts.current.forEach(timeout => clearTimeout(timeout));
      progressUpdateTimeouts.current.clear();
      unlistenStart.then(fn => fn());
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
      unlistenError.then(fn => fn());
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

        console.log('🚀 Starting conversion:', { input: file.path, output: outputPath, format: outputFormat });

        const conversionSettings = {
          taskId: file.id,
          quality: file.settings.quality,
          bitrate: file.settings.bitrate,
          sampleRate: file.settings.sampleRate,
          channels: file.settings.channels,
          useGpu: file.settings.useGpu,
        };

        if (file.settings.extractAudioOnly && file.mediaInfo?.media_type === 'video') {
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
        } else if (file.mediaInfo?.media_type === 'video') {
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
        const timeout = progressUpdateTimeouts.current.get(fileId);
        if (timeout) {
          clearTimeout(timeout);
          progressUpdateTimeouts.current.delete(fileId);
        }
        updateFile(fileId, { status: 'cancelled', progress: null, completedAt: Date.now() });
        setIsConverting(false);
      } catch (error) {
        console.error('Failed to cancel conversion:', error);
      }
    },
    [updateFile]
  );

  return { updateFile, startConversion, cancelConversion, isConverting };
};