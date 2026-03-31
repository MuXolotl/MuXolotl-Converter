<script lang="ts">
  import { AlertTriangle, XCircle, Info, Zap, Copy } from 'lucide-svelte';
  import type { ValidationResult } from '@/types';

  interface Props {
    validation: ValidationResult;
  }

  let { validation }: Props = $props();

  let hasErrors = $derived(validation.errors.length > 0);
  let hasWarnings = $derived(validation.warnings.length > 0);
  let hasInfo = $derived(validation.info.length > 0);
  let hasCopy = $derived(validation.can_copy_video || validation.can_copy_audio);
  let hasContent = $derived(hasErrors || hasWarnings || hasInfo || hasCopy);
</script>

{#if hasContent}
  <div class="space-y-2">
    <!-- Copy badges -->
    {#if hasCopy}
      <div class="flex gap-2 flex-wrap">
        {#if validation.can_copy_video}
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-lg"
          >
            <Zap size={12} class="text-emerald-400" />
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wide"
              >Video Copy</span
            >
          </div>
        {/if}
        {#if validation.can_copy_audio}
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/30 rounded-lg"
          >
            <Copy size={12} class="text-cyan-400" />
            <span class="text-[10px] font-bold text-cyan-400 uppercase tracking-wide"
              >Audio Copy</span
            >
          </div>
        {/if}
      </div>
    {/if}

    <!-- Errors and warnings -->
    {#if hasErrors || hasWarnings}
      <div
        class="p-3 rounded-lg space-y-1.5 {hasErrors
          ? 'bg-red-500/10 border border-red-500/20'
          : 'bg-yellow-500/10 border border-yellow-500/20'}"
      >
        {#each validation.errors as error}
          <div class="flex items-start gap-2 text-xs text-red-400">
            <XCircle size={14} class="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        {/each}

        {#each validation.warnings as warning}
          <div class="flex items-start gap-2 text-xs text-yellow-400">
            <AlertTriangle size={14} class="shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        {/each}

        {#if validation.alternative_codec}
          <div class="flex items-start gap-2 text-xs text-blue-400 mt-2">
            <Info size={14} class="shrink-0 mt-0.5" />
            <span>Suggested codec: {validation.alternative_codec}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Info messages -->
    {#if hasInfo}
      <div class="p-2.5 rounded-lg bg-blue-500/8 border border-blue-500/15 space-y-1.5">
        {#each validation.info as msg}
          <div class="flex items-start gap-2 text-xs text-blue-300/80">
            <Info size={12} class="shrink-0 mt-0.5 text-blue-400/60" />
            <span>{msg}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}