<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { FileVideo, FileAudio, Check, AlertTriangle, X, Trash2, ArrowRight, FolderOpen } from 'lucide-svelte';
  import { formatEta } from '@/utils';
  import type { FileItem } from '@/types';

  interface Props {
    file: FileItem;
    index: number;
    isSelected: boolean;
    onClick: (e: MouseEvent) => void;
    onRemove: () => void;
  }

  let { file, index, isSelected, onClick, onRemove }: Props = $props();

  let isVideo = $derived(file.mediaInfo?.media_type === 'video');
  let canReveal = $derived(file.status === 'completed' && !!file.outputPath);

  function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    onRemove();
  }

  function handleReveal(e: MouseEvent) {
    e.stopPropagation();
    if (!file.outputPath) return;
    invoke('reveal_in_folder', { path: file.outputPath }).catch((err) => {
      console.error('Failed to reveal file:', err);
    });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={onClick}
  class="flex items-center gap-2 px-2 h-full cursor-pointer transition-colors select-none group border-b border-white/5
    {isSelected ? 'bg-blue-500/15 border-l-2 border-l-blue-500' : 'hover:bg-white/[0.03]'}"
>
  <!-- Index -->
  <div class="w-6 text-white/30 font-mono text-[10px] text-center shrink-0">
    {index + 1}
  </div>

  <!-- Icon + Name -->
  <div class="flex items-center gap-2 flex-1 min-w-0">
    <div
      class="shrink-0 p-1 rounded {isSelected
        ? 'bg-blue-500/20 text-blue-400'
        : 'bg-white/5 text-white/40'}"
    >
      {#if isVideo}
        <FileVideo size={12} />
      {:else}
        <FileAudio size={12} />
      {/if}
    </div>
    <div
      class="text-[11px] truncate font-medium {isSelected ? 'text-white' : 'text-slate-300'}"
      title={file.name}
    >
      {file.name}
    </div>
  </div>

  <!-- Format -->
  <div class="w-16 flex items-center gap-1 font-mono text-[9px] shrink-0">
    <ArrowRight size={8} class="text-white/20" />
    <span class="text-blue-400 font-bold uppercase truncate">{file.outputFormat}</span>
  </div>

  <!-- Status -->
  <div class="w-20 shrink-0">
    {#if file.status === 'processing' && file.progress}
      <div class="w-full">
        <div class="flex justify-between text-[9px] text-blue-400 mb-0.5 font-mono">
          <span>{file.progress.percent.toFixed(0)}%</span>
          <span class="opacity-70">{formatEta(file.progress.eta_seconds)}</span>
        </div>
        <div class="w-full h-1 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            style="width: {file.progress.percent}%"
          ></div>
        </div>
      </div>
    {:else if file.status === 'completed'}
      <span class="flex items-center gap-1 text-[10px] font-medium text-green-400">
        <Check size={10} />
        <span class="truncate">Done</span>
      </span>
    {:else if file.status === 'failed'}
      <span
        class="flex items-center gap-1 text-[10px] font-medium text-red-400"
        title={file.error || undefined}
      >
        <AlertTriangle size={10} />
        <span class="truncate">Failed</span>
      </span>
    {:else if file.status === 'cancelled'}
      <span class="flex items-center gap-1 text-[10px] font-medium text-orange-400">
        <X size={10} />
        <span class="truncate">Stopped</span>
      </span>
    {:else}
      <span class="flex items-center gap-1 text-[10px] font-medium text-white/30">
        <span class="truncate">Pending</span>
      </span>
    {/if}
  </div>

  <!-- Action buttons -->
  <div class="w-8 flex items-center justify-center gap-0.5 shrink-0">
    {#if canReveal}
      <button
        onclick={handleReveal}
        class="p-1 text-white/20 hover:text-green-400 hover:bg-green-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
        title="Open in folder"
      >
        <FolderOpen size={12} />
      </button>
    {/if}
    <button
      onclick={handleRemove}
      class="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
      title="Remove"
    >
      <Trash2 size={12} />
    </button>
  </div>
</div>