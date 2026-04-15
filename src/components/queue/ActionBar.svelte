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
  import Button from '@/components/ui/Button.svelte';
  import { conversionStore } from '@/stores/conversion.svelte';
  import { fileQueueStore } from '@/stores/fileQueue.svelte';
  import type { FileItem } from '@/types';

  interface Props {
    selectedFile: FileItem | null;
  }

  let { selectedFile }: Props = $props();

  let applySuccess = $state(false);
  let appliedLabel = $state('');

  let stats = $derived(fileQueueStore.stats);
  let outputFolder = $derived(fileQueueStore.outputFolder);

  let hasPending = $derived(stats.pending > 0);
  let hasCompleted = $derived(stats.completed > 0);
  let hasProcessing = $derived(stats.processing > 0);
  let hasFiles = $derived(stats.total > 0);
  let canStartAll = $derived(hasPending && !!outputFolder);

  let finishedCount = $derived(
    fileQueueStore.files.filter(f =>
      f.status === 'completed' || f.status === 'failed' || f.status === 'cancelled'
    ).length
  );
  let hasFinished = $derived(finishedCount > 0);

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
  <div class="bg-surface-base border-b border-white/10 flex items-center px-2 py-1.5 gap-1.5 shrink-0 overflow-x-auto">
    <!-- Convert All -->
    <Button
      variant={canStartAll ? 'primary' : 'ghost'}
      size="sm"
      onclick={handleConvertAll}
      disabled={!canStartAll}
      title={!outputFolder ? 'Select output folder first' : !hasPending ? 'No pending files' : 'Convert all pending files'}
    >
      <PlayCircle size={13} />
      <span>Convert All</span>
      {#if hasPending}
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none {canStartAll ? 'bg-white/20' : 'bg-white/5'}">
          {stats.pending}
        </span>
      {/if}
    </Button>

    <!-- Cancel All -->
    {#if hasProcessing}
      <Button variant="danger" size="sm" onclick={handleCancelAll} title="Cancel all active conversions">
        <StopCircle size={13} />
        <span>Cancel All</span>
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-red-500/20">
          {stats.processing}
        </span>
      </Button>
    {/if}

    <!-- Retry All -->
    {#if hasFinished && !hasProcessing}
      <Button variant="ghost" size="sm" onclick={handleRetryAll} title="Reset all completed, failed, and cancelled files back to pending" class="hover:!bg-blue-500/15 hover:!text-blue-300">
        <RotateCcw size={13} />
        <span>Retry All</span>
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-blue-500/15 text-blue-400">
          {finishedCount}
        </span>
      </Button>
    {/if}

    <!-- Separator -->
    {#if canApply || applySuccess}
      <div class="w-px h-5 bg-white/10 mx-0.5 shrink-0"></div>
    {/if}

    <!-- Apply to All -->
    {#if applySuccess}
      <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium shrink-0 bg-green-500/15 text-green-400">
        <Check size={13} />
        <span>Applied to {appliedLabel}!</span>
      </div>
    {:else if canApply}
      <Button variant="ghost" size="sm" onclick={handleApplyToAll} title="Copy format & settings from selected file to all other pending {applyTypeLabel.toLowerCase()} files" class="hover:!bg-purple-500/15 hover:!text-purple-300">
        <CopyCheck size={13} />
        <span>Apply to {applyTargetCount} {applyTypeLabel}</span>
      </Button>
    {/if}

    <!-- Separator -->
    {#if hasCompleted}
      <div class="w-px h-5 bg-white/10 mx-0.5 shrink-0"></div>
    {/if}

    <!-- Clear Completed -->
    {#if hasCompleted}
      <Button variant="ghost" size="sm" onclick={handleClearCompleted} title="Remove all completed files from queue" class="hover:!bg-green-500/15 hover:!text-green-300">
        <CheckCircle size={13} />
        <span>Clear Done</span>
        <span class="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-green-500/15 text-green-400">
          {stats.completed}
        </span>
      </Button>
    {/if}

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Clear All / Stop & Clear -->
    {#if hasProcessing}
      <Button variant="danger" size="sm" onclick={handleClearAll} title="Cancel all conversions and clear queue" class="text-red-400/60 hover:!text-red-400">
        <XCircle size={13} />
        <span>Stop & Clear</span>
      </Button>
    {:else}
      <Button variant="ghost" size="sm" onclick={handleClearAll} title="Remove all files from queue" class="text-white/30 hover:!bg-red-500/10 hover:!text-red-400">
        <Trash2 size={13} />
        <span>Clear All</span>
      </Button>
    {/if}
  </div>
{/if}