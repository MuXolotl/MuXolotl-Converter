<script lang="ts">
  import { Cpu, Zap } from 'lucide-svelte';
  import type { GpuInfo } from '@/types';

  interface Props {
    gpuInfo: GpuInfo;
    compact?: boolean;
  }

  let { gpuInfo, compact = false }: Props = $props();
</script>

{#if compact}
  <div class="flex items-center gap-1.5 text-xs">
    {#if gpuInfo.available}
      <Zap size={12} class="text-yellow-400" />
      <span class="text-white/60">{gpuInfo.name}</span>
    {:else}
      <Cpu size={12} class="text-orange-400" />
      <span class="text-white/40">CPU Only</span>
    {/if}
  </div>
{:else}
  <div class="glass px-3 py-2 flex items-center gap-2">
    {#if gpuInfo.available}
      <Zap size={16} class="text-yellow-400" />
      <div>
        <div class="text-white text-sm font-medium">{gpuInfo.name}</div>
        <div class="text-white/40 text-xs">GPU Acceleration</div>
      </div>
    {:else}
      <Cpu size={16} class="text-orange-400" />
      <div>
        <div class="text-white text-sm font-medium">CPU Only</div>
        <div class="text-white/40 text-xs">No GPU Detected</div>
      </div>
    {/if}
  </div>
{/if}