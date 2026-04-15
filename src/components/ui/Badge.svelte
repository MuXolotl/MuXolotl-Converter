<script lang="ts">
  import type { Snippet } from 'svelte';

  type BadgeVariant = 'fast' | 'safe' | 'setup' | 'beta' | 'risky' | 'success' | 'info';
  type BadgeSize = 'sm' | 'md';

  interface Props {
    variant: BadgeVariant;
    size?: BadgeSize;
    children: Snippet;
  }

  let { variant, size = 'sm', children }: Props = $props();

  const variantClasses: Record<BadgeVariant, string> = {
    fast: 'bg-green-500/20 text-green-400',
    safe: 'bg-blue-500/20 text-blue-400',
    setup: 'bg-yellow-500/20 text-yellow-400',
    beta: 'bg-orange-500/20 text-orange-400',
    risky: 'bg-red-500/20 text-red-400',
    success: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
    info: 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400',
  };

  const sizeClasses: Record<BadgeSize, string> = {
    sm: 'text-[9px] px-1.5 py-0.5 rounded font-semibold',
    md: 'text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide',
  };
</script>

<span
  class="inline-flex items-center gap-1 {sizeClasses[size]} {variantClasses[variant]}"
>
  {@render children()}
</span>