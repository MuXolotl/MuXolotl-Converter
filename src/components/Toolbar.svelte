<script lang="ts">
  import { Zap, Cpu } from 'lucide-svelte';
  import OutputFolderSelector from '@/components/OutputFolderSelector.svelte';
  import type { GpuInfo, QueueStats } from '@/types';

  interface Props {
    stats: QueueStats;
    gpuInfo: GpuInfo;
    gpuLoading: boolean;
    outputFolder: string;
    onFolderChange: (folder: string) => void;
  }

  let { stats, gpuInfo, gpuLoading, outputFolder, onFolderChange }: Props = $props();
</script>

<div class="h-10 bg-[#0f172a] border-b border-white/5 flex items-center px-2 gap-2 shrink-0 overflow-hidden">
  <!-- Left: GPU + Stats -->
  <div class="flex items-center gap-2 text-[10px] font-mono text-slate-500 shrink-0">
    {#if !gpuLoading}
      <div
        class="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/5 rounded border border-white/5"
        title={gpuInfo.name}
      >
        {#if gpuInfo.available}
          <Zap size={10} class="text-yellow-500" fill="currentColor" />
        {:else}
          <Cpu size={10} class="text-slate-500" />
        {/if}
        <span class={gpuInfo.available ? 'text-yellow-500/90 font-bold' : ''}>
          {gpuInfo.available ? 'GPU' : 'CPU'}
        </span>
      </div>
    {/if}

    <div class="w-px h-4 bg-white/10"></div>

    <div class="flex gap-2">
      <div class="flex gap-1 {stats.total > 0 ? 'opacity-100' : 'opacity-40'}" title="Total">
        <span class="font-semibold">T</span>
        <span>{stats.total}</span>
      </div>
      <div
        class="flex gap-1 {stats.pending > 0 ? 'opacity-100' : 'opacity-40'}"
        title="Pending"
      >
        <span class="font-semibold">P</span>
        <span class={stats.pending > 0 ? 'text-blue-400' : ''}>{stats.pending}</span>
      </div>
      <div
        class="flex gap-1 {stats.completed > 0 ? 'opacity-100' : 'opacity-40'}"
        title="Done"
      >
        <span class="font-semibold">D</span>
        <span class={stats.completed > 0 ? 'text-green-500' : ''}>{stats.completed}</span>
      </div>
      {#if stats.failed > 0}
        <div class="flex gap-1 opacity-100" title="Failed">
          <span class="font-semibold">F</span>
          <span class="text-red-500">{stats.failed}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: Output Folder -->
  <div class="flex-1 min-w-0 flex justify-end">
    <OutputFolderSelector {outputFolder} {onFolderChange} />
  </div>
</div>