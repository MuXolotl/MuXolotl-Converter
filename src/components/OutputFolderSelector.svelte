<script lang="ts">
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import { FolderOpen, ExternalLink } from 'lucide-svelte';
  import { truncatePath } from '@/utils';

  interface Props {
    outputFolder: string;
    onFolderChange: (folder: string) => void;
  }

  let { outputFolder, onFolderChange }: Props = $props();

  async function handleSelect() {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        onFolderChange(selected);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }

  function handleOpen(e: MouseEvent) {
    e.stopPropagation();
    if (!outputFolder) return;
    invoke('open_folder', { path: outputFolder }).catch((error) => {
      console.error('Failed to open folder:', error);
    });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleSelect}
  class="flex items-center gap-2 px-2 py-1 border rounded cursor-pointer transition-all min-w-0 max-w-full {outputFolder
    ? 'bg-[#1e293b] border-white/10 hover:border-blue-500/50'
    : 'bg-blue-900/10 border-blue-500/30 hover:bg-blue-900/20'}"
  title={outputFolder || 'Click to select output folder'}
>
  <FolderOpen
    size={12}
    class="shrink-0 {outputFolder ? 'text-blue-400' : 'text-blue-300 animate-pulse'}"
  />

  <span
    class="text-[10px] font-mono truncate min-w-0 {outputFolder
      ? 'text-slate-300'
      : 'text-blue-300/70 italic'}"
  >
    {outputFolder ? truncatePath(outputFolder, 25) : 'Output...'}
  </span>

  {#if outputFolder}
    <button
      onclick={handleOpen}
      class="p-0.5 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0"
      title="Open in Explorer"
    >
      <ExternalLink size={10} />
    </button>
  {/if}
</div>