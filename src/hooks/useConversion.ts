import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import type { FileItem, ConversionProgress, GpuInfo, ConversionContextType } from '@/types';

const PROGRESS_THROTTLE_MS = 150;

export const useConversion = (
  updateFile: (fileId: string, updates: Partial<FileItem>) => void,
  gpuInfo: GpuInfo
): ConversionContextType => {
  const [activeConversions, setActiveConversions] = useState<Set<string>>(new Set());
  const progressTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const unlistenFns = useRef<UnlistenFn[]>([]);
  const isMountedRef = useRef(true);

  const isConverting = activeConversions.size > 0;

  const clearProgressTimeout = useCallback((taskId: string) => {
    const timeout = progressTimeouts.current.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      progressTimeouts.current.delete(taskId);
    }
  }, []);

  const clearAllProgressTimeouts = useCallback(() => {
    progressTimeouts.current.forEach(timeout => clearTimeout(timeout));
    progressTimeouts.current.clear();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const setupListeners = async () => {
      const listeners = await Promise.all([
        listen<ConversionProgress>('conversion-progress', event => {
          if (!isMountedRef.current) return;
          
          const progress = event.payload;
          const existing = progressTimeouts.current.get(progress.task_id);

          if (existing) clearTimeout(existing);

          const timeout = setTimeout(() => {
            if (!isMountedRef.current) return;
            
            updateFile(progress.task_id, { status: 'processing', progress });
            progressTimeouts.current.delete(progress.task_id);
          }, PROGRESS_THROTTLE_MS);

          progressTimeouts.current.set(progress.task_id, timeout);
        }),

        listen<string>('conversion-completed', event => {
          if (!isMountedRef.current) return;
          
          const taskId = event.payload;
          console.log('✅ Conversion completed:', taskId);

          clearProgressTimeout(taskId);

          updateFile(taskId, {
            status: 'completed',
            progress: null,
            completedAt: Date.now(),
          });

          setActiveConversions(prev => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        }),

        listen<{ task_id: string; error: string }>('conversion-error', event => {
          if (!isMountedRef.current) return;
          
          console.error('❌ Conversion error:', event.payload);

          clearProgressTimeout(event.payload.task_id);

          updateFile(event.payload.task_id, {
            status: 'failed',
            error: event.payload.error,
            completedAt: Date.now(),
          });

          setActiveConversions(prev => {
            const next = new Set(prev);
            next.delete(event.payload.task_id);
            return next;
          });
        }),
      ]);

      unlistenFns.current = listeners;
    };

    setupListeners();

    return () => {
      isMountedRef.current = false;
      clearAllProgressTimeouts();
      unlistenFns.current.forEach(fn => fn());
      unlistenFns.current = [];
    };
  }, [updateFile, clearProgressTimeout, clearAllProgressTimeouts]);

  const selectOutputPath = async (file: FileItem, outputFormat: string): Promise<string | null> => {
    const lastDotIndex = file.name.lastIndexOf('.');
    const inputName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
    const defaultFileName = `${inputName}.${outputFormat}`;

    return await save({
      defaultPath: defaultFileName,
      filters: [{ name: outputFormat.toUpperCase(), extensions: [outputFormat] }],
    });
  };

  const startConversion = useCallback(
    async (file: FileItem) => {
      setActiveConversions(prev => new Set(prev).add(file.id));

      try {
        const outputFormat = file.outputFormat;
        let outputPath = file.outputPath;

        if (!outputPath) {
          const selected = await selectOutputPath(file, outputFormat);
          if (!selected) {
            console.log('❌ User cancelled output path selection');
            setActiveConversions(prev => {
              const next = new Set(prev);
              next.delete(file.id);
              return next;
            });
            return;
          }
          outputPath = selected;
          updateFile(file.id, { outputPath });
        }

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
        setActiveConversions(prev => {
          const next = new Set(prev);
          next.delete(file.id);
          return next;
        });
        throw error;
      }
    },
    [updateFile, gpuInfo]
  );

  const cancelConversion = useCallback(
    async (fileId: string) => {
      try {
        await invoke('cancel_conversion', { taskId: fileId });

        clearProgressTimeout(fileId);

        updateFile(fileId, {
          status: 'cancelled',
          progress: null,
          completedAt: Date.now(),
        });

        setActiveConversions(prev => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
      } catch (error) {
        console.error('Failed to cancel conversion:', error);
      }
    },
    [updateFile, clearProgressTimeout]
  );

  return { updateFile, startConversion, cancelConversion, isConverting };
};