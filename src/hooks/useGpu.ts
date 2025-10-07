import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import type { GpuInfo } from '@/types';

const DEFAULT_GPU_INFO: GpuInfo = {
  vendor: 'none',
  name: 'CPU Only',
  encoder_h264: null,
  encoder_h265: null,
  decoder: null,
  available: false,
};

export const useGpu = () => {
  const [gpuInfo, setGpuInfo] = useState<GpuInfo>(DEFAULT_GPU_INFO);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initGpu = async () => {
      try {
        const info = await invoke<GpuInfo>('detect_gpu');
        if (isMounted) {
          setGpuInfo(info);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to detect GPU:', error);
        if (isMounted) setIsLoading(false);
      }
    };

    const unlisten = listen<GpuInfo>('gpu-detected', (event) => {
      if (isMounted) {
        setGpuInfo(event.payload);
        setIsLoading(false);
      }
    });

    initGpu();

    return () => {
      isMounted = false;
      unlisten.then((fn) => fn());
    };
  }, []);

  return { gpuInfo, isLoading };
};