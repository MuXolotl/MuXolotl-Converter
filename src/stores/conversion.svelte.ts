import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { APP_CONFIG } from '@/config';
import { generateOutputPath } from '@/utils';
import { fileQueueStore } from './fileQueue.svelte';
import { gpuStore } from './gpu.svelte';
import type { FileItem, ConversionProgress } from '@/types';

class ConversionStore {
  activeCount = $state(0);

  #unlisteners: UnlistenFn[] = [];
  #lastUpdate = new Map<string, number>();
  #onError: ((file: FileItem, error: string) => void) | null = null;
  #abortPipeline = false;
  #activeTaskIds = new Set<string>();

  get isConverting(): boolean {
    return this.activeCount > 0;
  }

  setErrorHandler(handler: (file: FileItem, error: string) => void) {
    this.#onError = handler;
  }

  async init() {
    const listeners = await Promise.all([
      listen<ConversionProgress>('conversion-progress', (e) => {
        const { task_id, percent } = e.payload;
        const now = Date.now();
        const lastUpdate = this.#lastUpdate.get(task_id) || 0;

        if (
          now - lastUpdate < APP_CONFIG.limits.progressThrottleMs &&
          percent > 0 &&
          percent < 100
        ) {
          return;
        }

        this.#lastUpdate.set(task_id, now);
        fileQueueStore.updateFile(task_id, {
          status: 'processing',
          progress: e.payload,
        });
      }),

      listen<string>('conversion-completed', (e) => {
        const taskId = e.payload;
        this.#lastUpdate.delete(taskId);
        this.#activeTaskIds.delete(taskId);
        fileQueueStore.updateFile(taskId, {
          status: 'completed',
          progress: null,
          completedAt: Date.now(),
        });
        this.activeCount = Math.max(0, this.activeCount - 1);
      }),

      listen<string>('conversion-cancelled', (e) => {
        const taskId = e.payload;
        this.#lastUpdate.delete(taskId);
        this.#activeTaskIds.delete(taskId);
        fileQueueStore.updateFile(taskId, {
          status: 'cancelled',
          progress: null,
          completedAt: Date.now(),
        });
        this.activeCount = Math.max(0, this.activeCount - 1);
      }),

      listen<{ task_id: string; error: string }>('conversion-error', (e) => {
        const { task_id, error } = e.payload;
        this.#lastUpdate.delete(task_id);
        this.#activeTaskIds.delete(task_id);

        fileQueueStore.updateFile(task_id, {
          status: 'failed',
          error,
          progress: null,
          completedAt: Date.now(),
        });
        this.activeCount = Math.max(0, this.activeCount - 1);
      }),
    ]);

    this.#unlisteners = listeners;
  }

  async startConversion(file: FileItem) {
    const outputFolder = fileQueueStore.outputFolder;

    if (!outputFolder) {
      const error = 'No output folder selected';
      fileQueueStore.updateFile(file.id, { status: 'failed', error });
      return;
    }

    if (!file.mediaInfo) {
      const error = 'File has no media information';
      fileQueueStore.updateFile(file.id, { status: 'failed', error });
      return;
    }

    if (this.#activeTaskIds.has(file.id)) return;

    try {
      const existingPaths = new Set(
        fileQueueStore.files
          .filter(f => f.id !== file.id && f.outputPath)
          .map(f => f.outputPath!)
      );
      const outputPath = generateOutputPath(file, outputFolder, existingPaths);

      this.activeCount++;
      this.#activeTaskIds.add(file.id);

      fileQueueStore.updateFile(file.id, {
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
      const command = isAudio
        ? 'convert_audio'
        : extractAudio
          ? 'extract_audio'
          : 'convert_video';

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
        params.gpuInfo = gpuStore.info;
      }

      await invoke(command, params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      const currentFile = fileQueueStore.files.find(f => f.id === file.id);
      if (currentFile?.status === 'processing') {
        fileQueueStore.updateFile(file.id, {
          status: 'failed',
          error: errorMessage,
          progress: null,
        });
        this.activeCount = Math.max(0, this.activeCount - 1);

        if (this.#onError) this.#onError(file, errorMessage);
      }

      this.#activeTaskIds.delete(file.id);
    }
  }

  async startAll() {
    if (!fileQueueStore.outputFolder) return;

    this.#abortPipeline = false;

    const maxParallel = APP_CONFIG.limits.maxParallelConversions;

    const targetIds = new Set(fileQueueStore.pendingFiles.map(f => f.id));

    const worker = async () => {
      while (!this.#abortPipeline) {
        const nextFile = fileQueueStore.files.find(
          f => f.status === 'pending' && targetIds.has(f.id) && !this.#activeTaskIds.has(f.id)
        );

        if (!nextFile) break;

        await this.startConversion(nextFile);
      }
    };

    const workers = Array.from(
      { length: Math.min(maxParallel, targetIds.size) },
      () => worker()
    );

    await Promise.all(workers);
  }

  async cancelConversion(id: string) {
    try {
      this.#activeTaskIds.delete(id);
      await invoke('cancel_conversion', { taskId: id });
    } catch {
      this.#lastUpdate.delete(id);
      this.#activeTaskIds.delete(id);
      fileQueueStore.updateFile(id, {
        status: 'cancelled',
        progress: null,
        completedAt: Date.now(),
      });
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }

  async cancelAll() {
    this.#abortPipeline = true;

    const processing = fileQueueStore.files.filter(f => f.status === 'processing');
    await Promise.all(processing.map(f => this.cancelConversion(f.id)));
  }

  destroy() {
    this.#abortPipeline = true;
    this.#unlisteners.forEach(fn => fn());
    this.#unlisteners = [];
    this.#lastUpdate.clear();
    this.#activeTaskIds.clear();
  }
}

export const conversionStore = new ConversionStore();