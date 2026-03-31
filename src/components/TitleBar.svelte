<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { Minus, Square, X, Maximize2 } from 'lucide-svelte';
  import { APP_CONFIG } from '@/config';

  let isMaximized = $state(true);

  onMount(() => {
    // Check once on mount
    invoke<boolean>('window_is_maximized')
      .then((v) => (isMaximized = v))
      .catch(() => {});

    // Listen for window resize events (fires on maximize/unmaximize/snap/etc.)
    let debounceTimer: ReturnType<typeof setTimeout>;

    const unlisten = listen('tauri://resize', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          isMaximized = await invoke<boolean>('window_is_maximized');
        } catch {
          // ignore
        }
      }, 150);
    });

    return () => {
      clearTimeout(debounceTimer);
      unlisten.then((fn) => fn());
    };
  });

  function handleMinimize() {
    invoke('window_minimize').catch(() => {});
  }

  async function handleMaximize() {
    try {
      await invoke('window_maximize');
      // Optimistic toggle — UI responds instantly
      isMaximized = !isMaximized;
    } catch {
      // ignore
    }
  }

  function handleClose() {
    invoke('window_close').catch(() => {});
  }
</script>

<div
  data-tauri-drag-region
  class="relative h-9 bg-[#0f172a] flex items-center justify-between px-2 select-none shrink-0 border-b border-white/5"
>
  <div class="flex items-center w-20 pl-2">
    <span class="text-lg">🦎</span>
  </div>

  <div
    data-tauri-drag-region
    class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium tracking-widest text-slate-400 uppercase opacity-80"
  >
    {APP_CONFIG.name}
  </div>

  <div class="flex items-center h-full">
    <button
      onclick={handleMinimize}
      title="Minimize"
      class="h-full aspect-square flex items-center justify-center transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
    >
      <Minus size={14} />
    </button>
    <button
      onclick={handleMaximize}
      title="Maximize"
      class="h-full aspect-square flex items-center justify-center transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
    >
      {#if isMaximized}
        <Maximize2 size={12} />
      {:else}
        <Square size={12} />
      {/if}
    </button>
    <button
      onclick={handleClose}
      title="Close"
      class="h-full aspect-square flex items-center justify-center transition-colors hover:bg-red-600 text-slate-400 hover:text-white"
    >
      <X size={14} />
    </button>
  </div>
</div>