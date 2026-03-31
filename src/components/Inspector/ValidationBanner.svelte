<script lang="ts">
  import { AlertTriangle, XCircle, Info } from 'lucide-svelte';
  import type { ValidationResult } from '@/types';

  interface Props {
    validation: ValidationResult;
  }

  let { validation }: Props = $props();

  let hasErrors = $derived(validation.errors.length > 0);
  let hasWarnings = $derived(validation.warnings.length > 0);
</script>

{#if hasErrors || hasWarnings}
  <div
    class="p-3 rounded-lg space-y-1.5 {hasErrors
      ? 'bg-red-500/10 border border-red-500/20'
      : 'bg-yellow-500/10 border border-yellow-500/20'}"
  >
    {#each validation.errors as error, i}
      <div class="flex items-start gap-2 text-xs text-red-400">
        <XCircle size={14} class="shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    {/each}

    {#each validation.warnings as warning, i}
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