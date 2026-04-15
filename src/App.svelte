<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { gpuStore } from '@/stores/gpu.svelte';
  import { fileQueueStore } from '@/stores/fileQueue.svelte';
  import { conversionStore } from '@/stores/conversion.svelte';
  import type { FileItem, GpuInfo } from '@/types';

  import TitleBar from '@/components/layout/TitleBar.svelte';
  import Sidebar from '@/components/layout/Sidebar.svelte';
  import Toolbar from '@/components/layout/Toolbar.svelte';
  import SplitPane from '@/components/layout/SplitPane.svelte';
  import Queue from '@/components/queue/Queue.svelte';
  import Inspector from '@/components/inspector/Inspector.svelte';
  import ErrorModal from '@/components/modals/ErrorModal.svelte';
  import FeedbackModal from '@/components/modals/FeedbackModal.svelte';
  import Footer from '@/components/layout/Footer.svelte';

  // --- Error types ---
  interface ErrorState {
    title: string;
    message: string;
    details?: string;
    fileInfo?: {
      name: string;
      path: string;
      format: string;
      outputFormat: string;
      duration?: number;
      size?: number;
    };
    settings?: {
      quality: string;
      useGpu: boolean;
      sampleRate?: number;
      channels?: number;
      width?: number;
      height?: number;
    };
    gpuInfo?: GpuInfo;
  }

  interface FfmpegError {
    code?: string;
    message: string;
    details?: string;
  }

  // --- State ---
  let ffmpegReady: boolean | null = $state(null);
  let ffmpegError: FfmpegError | null = $state(null);
  let isLoaded = $state(false);
  let selectedIds = $state(new Set<string>());
  let errorModal: ErrorState | null = $state(null);
  let feedbackOpen = $state(false);
  let isConsoleOpen = $state(false);

  // --- Derived ---
  let selectedFile = $derived.by(() => {
    if (selectedIds.size === 0) return null;
    const firstId = Array.from(selectedIds)[0];
    return fileQueueStore.files.find((f) => f.id === firstId) || null;
  });

  let lastActiveFile = $derived.by(() => {
    const processing = fileQueueStore.files.find(f => f.status === 'processing');
    if (processing) return processing;

    const finished = fileQueueStore.files
      .filter(f => f.completedAt)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    return finished[0] || null;
  });

  // --- Error handler ---
  function handleConversionError(file: FileItem, error: string) {
    const isCritical = error.toLowerCase().includes('ipc') || error.toLowerCase().includes('tauri');

    if (isCritical) {
      errorModal = {
        title: 'Critical Error',
        message: error || 'Error',
        details: error,
        fileInfo: {
          name: file.name,
          path: file.path,
          format: file.mediaInfo?.format_name.split(',')[0] || 'unknown',
          outputFormat: file.outputFormat,
          duration: file.mediaInfo?.duration,
          size: file.mediaInfo?.file_size,
        },
        settings: { ...file.settings },
        gpuInfo: gpuStore.info,
      };
    }
  }

  // --- Initialization ---
  onMount(async () => {
    fileQueueStore.init();
    await gpuStore.init();
    await conversionStore.init();
    conversionStore.setErrorHandler(handleConversionError);

    await fileQueueStore.validateOnStartup();

    try {
      const isReady = await invoke<boolean>('check_ffmpeg');
      ffmpegReady = isReady;
      isLoaded = true;
      setTimeout(() => invoke('close_splash').catch(() => {}), 500);
    } catch (err: unknown) {
      ffmpegReady = false;
      let parsed: FfmpegError = { message: String(err) };
      if (typeof err === 'string') {
        try {
          parsed = JSON.parse(err) as FfmpegError;
        } catch {
          parsed = { message: err };
        }
      }
      ffmpegError = parsed;
      isLoaded = true;
      invoke('close_splash').catch(() => {});
    }

    return () => {
      gpuStore.destroy();
      conversionStore.destroy();
    };
  });

  // --- Handlers ---
  function handleFilesAdded(newFiles: FileItem[]) {
    fileQueueStore.addFiles(newFiles);
    if (newFiles.length > 0) selectedIds = new Set([newFiles[0].id]);
  }

  function handleSelect(id: string, multi: boolean) {
    if (multi) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      selectedIds = next;
    } else {
      selectedIds = new Set([id]);
    }
  }

  function handleSelectAll() {
    selectedIds = new Set(fileQueueStore.files.map((f) => f.id));
  }

  function handleDeselectAll() {
    selectedIds = new Set();
  }

  function handleRemove(id: string) {
    fileQueueStore.removeFile(id);
    const next = new Set(selectedIds);
    next.delete(id);
    selectedIds = next;
  }

  function handleRemoveSelected() {
    selectedIds.forEach((id) => fileQueueStore.removeFile(id));
    selectedIds = new Set();
  }

  function handleFolderChange(folder: string) {
    fileQueueStore.setOutputFolder(folder);
  }
</script>

{#if ffmpegReady === null}
  <!-- Loading... -->
{:else if ffmpegReady === false}
  <div class="h-screen w-screen bg-surface-base text-white flex items-center justify-center">
    <div class="max-w-lg w-full text-center p-8">
      <div class="text-6xl mb-4">⚠️</div>
      <h1 class="text-xl font-bold mb-2">FFmpeg Not Found</h1>
      <p class="text-white/60 mb-4">
        Place <code class="text-blue-400">ffmpeg.exe</code> and
        <code class="text-blue-400">ffprobe.exe</code> in the same folder as the application.
      </p>

      {#if ffmpegError}
        <details class="text-left mt-4">
          <summary class="text-white/40 text-xs cursor-pointer hover:text-white/60 transition-colors mb-2">
            Show diagnostic info
          </summary>
          <div class="bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-white/50 break-all whitespace-pre-wrap">
            {ffmpegError.details || ffmpegError.message}
          </div>
        </details>
      {/if}
    </div>
  </div>
{:else}
  <div class="h-screen w-screen bg-surface-base text-white flex flex-col overflow-hidden">
    <TitleBar />
    <div class="flex-1 flex overflow-hidden min-h-0">
      <Sidebar onFeedbackClick={() => (feedbackOpen = true)} />
      <div class="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        <Toolbar
          stats={fileQueueStore.stats}
          gpuInfo={gpuStore.info}
          gpuLoading={gpuStore.isLoading}
          outputFolder={fileQueueStore.outputFolder}
          onFolderChange={handleFolderChange}
        />
        <div class="flex-1 min-h-0">
          <SplitPane minLeftWidth={350} minRightWidth={280} defaultLeftRatio={0.6}>
            {#snippet left()}
              <Queue
                files={fileQueueStore.sortedFiles}
                {selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onRemove={handleRemove}
                onRemoveSelected={handleRemoveSelected}
                onFilesAdded={handleFilesAdded}
              />
            {/snippet}
            {#snippet right()}
              <Inspector
                file={selectedFile}
                selectedCount={selectedIds.size}
                outputFolder={fileQueueStore.outputFolder}
                onRetry={(id) => fileQueueStore.retryFile(id)}
              />
            {/snippet}
          </SplitPane>
        </div>
        <Footer
          isOpen={isConsoleOpen}
          onToggle={() => (isConsoleOpen = !isConsoleOpen)}
          lastFile={lastActiveFile}
        />
      </div>
    </div>
    <ErrorModal
      isOpen={!!errorModal}
      error={errorModal}
      onClose={() => (errorModal = null)}
    />
    <FeedbackModal
      isOpen={feedbackOpen}
      onClose={() => (feedbackOpen = false)}
      gpuInfo={gpuStore.info}
      stats={fileQueueStore.stats}
    />
  </div>
{/if}