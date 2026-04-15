<script lang="ts">
  import { APP_CONFIG } from '@/config';
  import DropZone from './DropZone.svelte';
  import ActionBar from './ActionBar.svelte';
  import QueueItem from './QueueItem.svelte';
  import type { FileItem } from '@/types';

  interface Props {
    files: FileItem[];
    selectedIds: Set<string>;
    onSelect: (id: string, multi: boolean) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onRemove: (id: string) => void;
    onRemoveSelected: () => void;
    onFilesAdded: (files: FileItem[]) => void;
  }

  let {
    files,
    selectedIds,
    onSelect,
    onSelectAll,
    onDeselectAll,
    onRemove,
    onRemoveSelected,
    onFilesAdded,
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onRemoveSelected();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      onSelectAll();
    }
    if (e.key === 'Escape') {
      onDeselectAll();
    }
  }
</script>

{#if files.length === 0}
  <div class="h-full flex flex-col items-center justify-center p-4 bg-surface-panel/30">
    <DropZone {onFilesAdded} currentCount={0} maxCount={APP_CONFIG.limits.maxQueueSize} />
  </div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="h-full flex flex-col bg-surface-panel/30 outline-none"
    role="listbox"
    tabindex="0"
    onkeydown={handleKeyDown}
    onclick={onDeselectAll}
  >
    <!-- Batch Actions -->
    <ActionBar selectedFile={selectedIds.size > 0 ? files.find(f => selectedIds.has(f.id)) || null : null} />

    <!-- Header -->
    <div class="shrink-0 bg-surface-base border-b border-white/10 select-none px-2 py-1.5">
      <div class="flex items-center gap-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
        <div class="w-6 text-center">#</div>
        <div class="flex-1 min-w-0">File</div>
        <div class="w-16">Format</div>
        <div class="w-20">Status</div>
        <div class="w-6"></div>
      </div>
    </div>

    <!-- List -->
    <div bind:this={containerEl} class="flex-1 min-h-0 overflow-y-auto">
      {#each files as file, index (file.id)}
        <div style="height: 48px;">
          <QueueItem
            {file}
            {index}
            isSelected={selectedIds.has(file.id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(file.id, e.ctrlKey || e.metaKey);
            }}
            onRemove={() => onRemove(file.id)}
          />
        </div>
      {/each}
    </div>

    <!-- Compact drop zone at bottom -->
    {#if files.length < APP_CONFIG.limits.maxQueueSize}
      <div class="p-2 opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <DropZone
          {onFilesAdded}
          currentCount={files.length}
          maxCount={APP_CONFIG.limits.maxQueueSize}
          compact
        />
      </div>
    {/if}
  </div>
{/if}