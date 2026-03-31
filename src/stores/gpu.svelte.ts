import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { GpuInfo } from '@/types';

const DEFAULT_GPU: GpuInfo = {
  vendor: 'none',
  name: 'CPU Only',
  encoder_h264: null,
  encoder_h265: null,
  decoder: null,
  available: false,
};

class GpuStore {
  info: GpuInfo = $state(DEFAULT_GPU);
  isLoading = $state(true);
  #unlisten: UnlistenFn | null = null;

  async init() {
    try {
      // Listen for backend GPU detection event (may arrive before invoke returns)
      this.#unlisten = await listen<GpuInfo>('gpu-detected', (event) => {
        this.info = event.payload;
        this.isLoading = false;
      });

      // Also explicitly request GPU info
      const info = await invoke<GpuInfo>('detect_gpu');
      this.info = info;
    } catch (error) {
      console.error('GPU detection failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  destroy() {
    this.#unlisten?.();
    this.#unlisten = null;
  }
}

export const gpuStore = new GpuStore();