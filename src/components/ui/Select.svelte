<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id?: string;
    value?: string;
    disabled?: boolean;
    onchange?: (e: Event) => void;
    class?: string;
    children: Snippet;
  }

  let {
    id,
    value = '',
    disabled = false,
    onchange,
    class: className = '',
    children,
  }: Props = $props();
</script>

<div class="relative {className}">
  <select
    {id}
    {value}
    {disabled}
    {onchange}
    class="w-full px-3 py-2.5 bg-surface-base border border-white/10 rounded text-sm text-white
      focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer appearance-none"
  >
    {@render children()}
  </select>
  <div
    class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30"
  >
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path
        d="M1 1L5 5L9 1"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</div>