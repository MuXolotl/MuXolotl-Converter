import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import type { GpuInfo } from '@/types';

const DEFAULT_GPU: GpuInfo = {
  vendor: 'none',
  name: 'CPU Only',
  encoder_h264: null,
  encoder_h265: null,
  decoder: null,
  available: false,
};

export function useGpu() {
  const [gpuInfo, setGpuInfo] = useState<GpuInfo>(DEFAULT_GPU);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const info = await invoke<GpuInfo>('detect_gpu');
        if (mounted) {
          setGpuInfo(info);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('GPU detection failed:', error);
        if (mounted) setIsLoading(false);
      }
    };

    const unlisten = listen<GpuInfo>('gpu-detected', event => {
      if (mounted) {
        setGpuInfo(event.payload);
        setIsLoading(false);
      }
    });

    init();

    return () => {
      mounted = false;
      unlisten.then(fn => fn());
    };
  }, []);

  return { gpuInfo, isLoading };
}