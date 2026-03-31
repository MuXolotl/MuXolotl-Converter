<script lang="ts">
  import { Terminal, Activity, CheckCircle, AlertCircle, XCircle } from 'lucide-svelte';
  import type { FileItem } from '@/types';

  interface Props {
    isOpen: boolean;
    onToggle: () => void;
    lastFile: FileItem | null;
  }

  let { isOpen, onToggle, lastFile }: Props = $props();
</script>

<div class="flex flex-col shrink-0 z-30">
  {#if isOpen}
    <div class="h-32 bg-[#0b1120] border-t border-white/10 p-2 font-mono text-xs text-slate-300 overflow-y-auto shadow-inner">
      <div class="opacity-50 select-none">// FFmpeg Output Log (Coming Soon)</div>
      <div class="mt-1 text-blue-400">$ ffmpeg -i input.mp4 -c:v libx264 output.mp4</div>
    </div>
  {/if}

  <div class="h-6 bg-[#0f172a] border-t border-white/5 flex items-center justify-between px-3 text-[10px] font-mono select-none">
    <div class="flex items-center flex-1 min-w-0 mr-4">
      {#if !lastFile}
        <span class="text-slate-500">Ready</span>
      {:else if lastFile.status === 'processing'}
        <div class="flex items-center gap-2 text-blue-400">
          <Activity size={12} class="animate-pulse" />
          <span>Processing: {lastFile.name} ({lastFile.progress?.percent.toFixed(1)}%)</span>
        </div>
      {:else if lastFile.status === 'completed'}
        <div class="flex items-center gap-2 text-green-400">
          <CheckCircle size={12} />
          <span>Finished: {lastFile.name}</span>
        </div>
      {:else if lastFile.status === 'failed'}
        <div class="flex items-center gap-2 text-red-400">
          <AlertCircle size={12} />
          <span>Error: {lastFile.name} - {lastFile.error}</span>
        </div>
      {:else if lastFile.status === 'cancelled'}
        <div class="flex items-center gap-2 text-orange-400">
          <XCircle size={12} />
          <span>Cancelled: {lastFile.name}</span>
        </div>
      {:else}
        <span class="text-slate-500">Ready</span>
      {/if}
    </div>

    <button
      onclick={onToggle}
      class="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 transition-colors {isOpen ? 'text-blue-400 bg-white/5' : 'text-slate-500'}"
    >
      <Terminal size={10} />
      <span>CONSOLE</span>
    </button>
  </div>
</div>