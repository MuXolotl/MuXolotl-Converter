<script lang="ts">
  import type { Snippet } from 'svelte';

  type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'success' | 'warning' | 'gradient';
  type ButtonSize = 'sm' | 'md';

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    full?: boolean;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    title?: string;
    class?: string;
    children: Snippet;
  }

  let {
    variant = 'ghost',
    size = 'md',
    full = false,
    disabled = false,
    onclick,
    title,
    class: className = '',
    children,
  }: Props = $props();

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 active:scale-[0.97]',
    danger:
      'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-[0.97]',
    ghost:
      'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white active:scale-[0.97]',
    success:
      'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 active:scale-[0.97]',
    warning:
      'bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20',
    gradient:
      'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/20',
  };
</script>

<button
  {onclick}
  {disabled}
  {title}
  class="flex items-center justify-center rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
    {full
      ? 'w-full py-2.5 text-xs font-bold gap-1.5'
      : size === 'sm'
        ? 'px-2.5 py-1.5 text-[11px] gap-1.5 font-semibold'
        : 'px-3 py-2.5 text-sm gap-2'}
    {variantClasses[variant]}
    {className}"
>
  {@render children()}
</button>