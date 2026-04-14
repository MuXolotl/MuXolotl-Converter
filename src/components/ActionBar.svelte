<script lang="ts">
  import {
    PlayCircle,
    StopCircle,
    Trash2,
    CheckCircle,
    CopyCheck,
    XCircle,
    Check,
    RotateCcw,
  } from 'lucide-svelte';
  import { conversionStore } from '@/stores/conversion.svelte';
  import { fileQueueStore } from '@/stores/fileQueue.svelte';
  import type { FileItem } from '@/types';

  interface Props {
    selectedFile: FileItem | null;
  }

  let { selectedFile }: Props = $props();

  let applySuccess = $state(false);
  let appliedLabel = $state('');

  // --- Derived from store ---
  let stats = $derived(fileQueueStore.stats);
  let outputFolder = $derived(fileQueueStore.outputFolder);

  let hasPending = $derived(stats.pending > 0);
  let hasCompleted = $derived(stats.completed > 0);
  let hasProcessing = $derived(stats.processing > 0);
  let hasFiles = $derived(stats.total > 0);
  let canStartAll = $derived(hasPending && !!outputFolder);

  // Count finished files (completed + failed + cancelled) for Retry All
  let finishedCount = $derived(
    fileQueueStore.files.filter(f =>
      f.status === 'completed' || f.status === 'failed' || f.status === 'cancelled'
    ).length
  );
  let hasFinished = $derived(finishedCount > 0);

  // --- Apply to All: count targets of the same media type ---
  let selectedMediaType = $derived(selectedFile?.mediaInfo?.media_type || null);

  let applyTargetCount = $derived.by(() => {
    if (!selectedFile || selectedFile.status !== 'pending' || !selectedMediaType || selectedMediaType === 'unknown') return 0;
    return fileQueueStore.files.filter(f =>
      f.id !== selectedFile!.id &&
      f.status === 'pending' &&
      f.mediaInfo?.media_type === selectedMediaType
    ).length;
  });

  let applyTypeLabel = $derived(selectedMediaType === 'audio' ? 'Audio' : 'Video');
  let canApply = $derived(applyTargetCount > 0 && !applySuccess);

  // --- Handlers ---
  async function handleConvertAll() {
    if (!canStartAll) return;
    await conversionStore.startAll();
  }

  async function handleCancelAll() {
    await conversionStore.cancelAll();
  }

  function handleRetryAll() {
    fileQueueStore.retryAll();
  }

  function handleClearCompleted() {
    fileQueueStore.clearCompleted();
  }

  function handleClearAll() {
    conversionStore.cancelAll().then(() => {
      fileQueueStore.clearAll();
    });
  }

  function handleApplyToAll() {
    if (!selectedFile || applyTargetCount === 0) return;
    appliedLabel = applyTypeLabel;
    fileQueueStore.applySettingsToAll(selectedFile.id);
    applySuccess = true;
    setTimeout(() => (applySuccess = false), 1500);
  }
</script>

{#if hasFiles}
  <div
    class="bg-surface-base border-b border-white/10 flex items-center px-2 py-1.5 gap-1.5 shrink-0 overflow-x-auto"
  >
    <!-- Convert All -->
    <button
      onclick={handleConvertAll}
      disabled={!canStartAll}
      title={!outputFolder ? 'Select output folder first' : !hasPending ? 'No pending files' : 'Convert all pending files'}
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-all shrink-0
        {canStartAll
          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 active:scale-[0.97]'
          : 'bg-white/5 text-white/20 cursor-not-allowed'}"
    >
      <PlayCircle size={13} />
      <span>Convert All</span>
      {#if hasPending}
        <span
          class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none
            {canStartAll ? 'bg-white/20' : 'bg-white/5'}"
        >
          {stats.pending}
        </span>
      {/if}
    </button>

    <!-- Cancel All -->
    {#if hasProcessing}
      <button
        onclick={handleCancelAll}
        title="Cancel all active conversions"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-all shrink-0
          bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-[0.97]"
      >
        <StopCircle size={13} />
        <span>Cancel All</span>
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-red-500/20">
          {stats.processing}
        </span>
      </button>
    {/if}

    <!-- Retry All -->
    {#if hasFinished && !hasProcessing}
      <button
        onclick={handleRetryAll}
        title="Reset all completed, failed, and cancelled files back to pending"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all shrink-0
          bg-white/5 text-white/60 hover:bg-blue-500/15 hover:text-blue-300 active:scale-[0.97]"
      >
        <RotateCcw size={13} />
        <span>Retry All</span>
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-blue-500/15 text-blue-400">
          {finishedCount}
        </span>
      </button>
    {/if}

    <!-- Separator -->
    {#if canApply || applySuccess}
      <div class="w-px h-5 bg-white/10 mx-0.5 shrink-0"></div>
    {/if}

    <!-- Apply to All [Type] -->
    {#if applySuccess}
      <div
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium shrink-0
          bg-green-500/15 text-green-400"
      >
        <Check size={13} />
        <span>Applied to {appliedLabel}!</span>
      </div>
    {:else if canApply}
      <button
        onclick={handleApplyToAll}
        title="Copy format & settings from selected file to all other pending {applyTypeLabel.toLowerCase()} files"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all shrink-0
          bg-white/5 text-white/60 hover:bg-purple-500/15 hover:text-purple-300 active:scale-[0.97]"
      >
        <CopyCheck size={13} />
        <span>Apply to {applyTargetCount} {applyTypeLabel}</span>
      </button>
    {/if}

    <!-- Separator -->
    {#if hasCompleted}
      <div class="w-px h-5 bg-white/10 mx-0.5 shrink-0"></div>
    {/if}

    <!-- Clear Completed -->
    {#if hasCompleted}
      <button
        onclick={handleClearCompleted}
        title="Remove all completed files from queue"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all shrink-0
          bg-white/5 text-white/60 hover:bg-green-500/15 hover:text-green-300 active:scale-[0.97]"
      >
        <CheckCircle size={13} />
        <span>Clear Done</span>
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-green-500/15 text-green-400">
          {stats.completed}
        </span>
      </button>
    {/if}

    <!-- Spacer pushes Clear All to the right -->
    <div class="flex-1"></div>

    <!-- Clear All / Stop & Clear (right-aligned) -->
    {#if hasProcessing}
      <button
        onclick={handleClearAll}
        title="Cancel all conversions and clear queue"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all shrink-0
          text-red-400/60 hover:bg-red-500/10 hover:text-red-400 active:scale-[0.97]"
      >
        <XCircle size={13} />
        <span>Stop & Clear</span>
      </button>
    {:else}
      <button
        onclick={handleClearAll}
        title="Remove all files from queue"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all shrink-0
          text-white/30 hover:bg-red-500/10 hover:text-red-400 active:scale-[0.97]"
      >
        <Trash2 size={13} />
        <span>Clear All</span>
      </button>
    {/if}
  </div>
{/if}