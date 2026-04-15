<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  import type { Component } from 'svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    titleIcon?: Component;
    titleClass?: string;
    maxWidth?: string;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    isOpen,
    onClose,
    title,
    titleIcon,
    titleClass = '',
    maxWidth = 'max-w-2xl',
    children,
    footer,
  }: Props = $props();
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
  >
    <div
      class="w-full {maxWidth} bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
    >
      {#if title}
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 {titleClass}"
        >
          <div class="flex items-center gap-2">
            {#if titleIcon}
              {@const Icon = titleIcon}
              <Icon size={18} />
            {/if}
            <span class="font-semibold">{title}</span>
          </div>
          <button
            onclick={onClose}
            class="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      {/if}

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {@render children()}
      </div>

      {#if footer}
        <div
          class="flex items-center gap-2 p-4 border-t border-white/10 bg-black/20 shrink-0"
        >
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}