<script lang="ts">
  interface Props {
    id?: string;
    type?: string;
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    onchange?: (e: Event) => void;
    oninput?: (e: Event) => void;
    class?: string;
  }

  let {
    id,
    type = 'text',
    value = '',
    placeholder,
    disabled = false,
    min,
    max,
    step,
    onchange,
    oninput,
    class: className = '',
  }: Props = $props();
</script>

<input
  {id}
  {type}
  {value}
  {placeholder}
  {disabled}
  {min}
  {max}
  {step}
  {onchange}
  {oninput}
  class="w-full px-3 py-2 bg-surface-base border border-white/10 rounded text-sm text-white
    focus:outline-none focus:border-blue-500 disabled:opacity-50 {className}"
/>