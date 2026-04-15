<script lang="ts">
  import { Upload } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { listen } from '@tauri-apps/api/event';
  import { MEDIA_EXTENSIONS } from '@/constants';
  import { processFilePaths } from '@/utils';
  import type { FileItem } from '@/types';

  interface DragDropPayload {
    paths: string[];
    position: { x: number; y: number };
  }

  interface Props {
    onFilesAdded: (files: FileItem[]) => void;
    currentCount: number;
    maxCount: number;
    compact?: boolean;
  }

  let { onFilesAdded, currentCount, maxCount, compact = false }: Props = $props();

  let isDragging = $state(false);
  let isProcessing = $state(false);

  let isFull = $derived(currentCount >= maxCount);
  let isDisabled = $derived(isFull || isProcessing);

  async function handlePaths(paths: string[]) {
    if (paths.length === 0) return;
    isProcessing = true;
    try {
      const files = await processFilePaths(paths);
      if (files.length > 0) onFilesAdded(files);
    } finally {
      isProcessing = false;
    }
  }

  async function handleBrowse() {
    if (isDisabled) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media Files', extensions: [...MEDIA_EXTENSIONS] }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await handlePaths(paths);
      }
    } catch (error) {
      console.error('File selection error:', error);
    }
  }

  $effect(() => {
    const promises = [
      listen<DragDropPayload>('tauri://drag-drop', async (event) => {
        isDragging = false;
        await handlePaths(event.payload.paths);
      }),
      listen<DragDropPayload>('tauri://drag-over', () => {
        isDragging = true;
      }),
      listen('tauri://drag-leave', () => {
        isDragging = false;
      }),
    ];

    const unlisteners = Promise.all(promises);

    return () => {
      unlisteners.then((fns) => fns.forEach((fn) => fn()));
    };
  });
</script>

{#if compact}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onclick={isDisabled ? undefined : handleBrowse}
    class="w-full py-2 flex items-center justify-center gap-2 border border-dashed rounded transition-all cursor-pointer
      {isFull
        ? 'border-red-500/30 opacity-50 cursor-not-allowed'
        : isDragging
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-white/10 hover:border-blue-500/30 hover:bg-white/5'}"
  >
    <Upload size={14} class="text-white/40" />
    <span class="text-xs text-white/40 font-medium">Add more files...</span>
  </div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onclick={isDisabled ? undefined : handleBrowse}
    class="w-full py-12 flex flex-col items-center justify-center gap-4 border border-dashed rounded-xl transition-all cursor-pointer bg-surface-base/50
      {isFull
        ? 'border-red-500/30 cursor-not-allowed opacity-50'
        : isDragging
          ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
          : isProcessing
            ? 'border-blue-500/50'
            : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5'}"
  >
    <div
      class="p-4 rounded-full transition-colors {isDragging
        ? 'bg-blue-500/20 text-blue-400'
        : 'bg-white/5 text-white/30'}"
    >
      {#if isProcessing}
        <div class="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      {:else}
        <Upload size={32} />
      {/if}
    </div>
    <div class="text-center">
      <p class="text-lg font-medium text-white/80">
        {#if isFull}
          Queue Full
        {:else if isProcessing}
          Analyzing...
        {:else}
          Drop files here
        {/if}
      </p>
      <p class="text-sm text-white/40 mt-1">or click to browse</p>
    </div>
  </div>
{/if}