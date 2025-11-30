import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import type { FileItem, ConversionProgress, GpuInfo, ConversionContextType } from '@/types';

export const useConversion = (
  updateFile: (id: string, updates: Partial<FileItem>) => void,
  gpuInfo: GpuInfo,
  filesRef: React.MutableRefObject<FileItem[]> // Pass ref to avoid closure staleness
): ConversionContextType => {
  const [activeCount, setActiveCount] = useState(0);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  
  // Map task_id -> debounce timer
  const progressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const setup = async () => {
      const fns = await Promise.all([
        // Progress
        listen<ConversionProgress>('conversion-progress', e => {
          const p = e.payload;
          if (progressTimers.current.has(p.task_id)) return;

          // Update immediately, then throttle
          updateFile(p.task_id, { status: 'processing', progress: p });
          
          const timer = setTimeout(() => {
            progressTimers.current.delete(p.task_id);
          }, 200); // 200ms throttle
          progressTimers.current.set(p.task_id, timer);
        }),

        // Completed
        listen<string>('conversion-completed', e => {
          const id = e.payload;
          updateFile(id, { status: 'completed', progress: null, completedAt: Date.now() });
          setActiveCount(c => Math.max(0, c - 1));
        }),

        // Error
        listen<{ task_id: string; error: string }>('conversion-error', e => {
          const { task_id, error } = e.payload;
          updateFile(task_id, { status: 'failed', error, progress: null, completedAt: Date.now() });
          setActiveCount(c => Math.max(0, c - 1));
        })
      ]);
      unlistenRef.current = fns;
    };

    setup();

    return () => {
      unlistenRef.current.forEach(f => f());
      progressTimers.current.forEach(t => clearTimeout(t));
    };
  }, [updateFile]);

  const startConversion = useCallback(async (file: FileItem) => {
    try {
      setActiveCount(c => c + 1);
      
      // 1. Output Path Selection (if missing)
      let outputPath = file.outputPath;
      if (!outputPath) {
        const saved = await save({
          defaultPath: file.name.replace(/\.[^.]+$/, `.${file.outputFormat}`),
          filters: [{ name: file.outputFormat, extensions: [file.outputFormat] }]
        });
        if (!saved) {
          setActiveCount(c => Math.max(0, c - 1));
          return; // Cancelled by user
        }
        outputPath = saved;
        updateFile(file.id, { outputPath });
      }

      // 2. Init State
      updateFile(file.id, { 
        status: 'processing', 
        progress: { 
          task_id: file.id, percent: 0, fps: null, speed: null, 
          eta_seconds: null, current_time: 0, total_time: file.mediaInfo?.duration || 1 
        }
      });

      // 3. Invoke Backend
      const cmd = file.mediaInfo?.media_type === 'audio' ? 'convert_audio'
                : file.settings.extractAudioOnly ? 'extract_audio'
                : 'convert_video';
      
      await invoke(cmd, {
        input: file.path,
        output: outputPath,
        format: file.outputFormat,
        gpuInfo,
        settings: { ...file.settings, task_id: file.id }
      });

    } catch (err) {
      console.error('Conversion launch failed:', err);
      updateFile(file.id, { status: 'failed', error: String(err) });
      setActiveCount(c => Math.max(0, c - 1));
    }
  }, [gpuInfo, updateFile]);

  const cancelConversion = useCallback(async (id: string) => {
    try {
      await invoke('cancel_conversion', { taskId: id });
      // Status update handled by listener or here if needed immediately
      updateFile(id, { status: 'cancelled', progress: null });
      setActiveCount(c => Math.max(0, c - 1));
    } catch (e) {
      console.error('Cancel failed', e);
    }
  }, [updateFile]);

  return {
    isConverting: activeCount > 0,
    startConversion,
    cancelConversion,
    updateFile // Re-export for context consumers
  };
};