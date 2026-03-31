<script lang="ts">
  import { ChevronDown, Filter } from 'lucide-svelte';
  import { STABILITY_CONFIG, CATEGORY_LABELS } from '@/constants';
  import type { AudioFormat, VideoFormat, RecommendedFormats, Category } from '@/types';

  interface Props {
    formats: (AudioFormat | VideoFormat)[];
    selected: string;
    onChange: (format: string) => void;
    disabled?: boolean;
    recommendedFormats?: RecommendedFormats;
  }

  let { formats, selected, onChange, disabled = false, recommendedFormats }: Props = $props();

  let isOpen = $state(false);
  let showAll = $state(false);
  let buttonEl: HTMLButtonElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();
  let position = $state({ top: 0, left: 0, width: 320 });

  // --- Derived ---

  let visibleFormats = $derived.by(() => {
    if (!recommendedFormats || showAll) return formats;
    const recommended = new Set([
      ...recommendedFormats.fast,
      ...recommendedFormats.safe,
      ...recommendedFormats.setup,
    ]);
    const visible = formats.filter((f) => recommended.has(f.extension));
    return visible.length > 0 ? visible : formats;
  });

  let hiddenCount = $derived(formats.length - visibleFormats.length);

  let groupedFormats = $derived.by(() => {
    const groups: Record<string, (AudioFormat | VideoFormat)[]> = {};
    for (const format of visibleFormats) {
      if (!groups[format.category]) groups[format.category] = [];
      groups[format.category].push(format);
    }
    return groups;
  });

  let selectedFormat = $derived(formats.find((f) => f.extension === selected));

  // --- Helpers ---

  function getBadge(ext: string): { label: string; className: string } | null {
    if (!recommendedFormats) return null;
    if (recommendedFormats.fast.includes(ext))
      return { label: 'FAST', className: 'bg-green-500/20 text-green-400' };
    if (recommendedFormats.safe.includes(ext))
      return { label: 'SAFE', className: 'bg-blue-500/20 text-blue-400' };
    if (recommendedFormats.setup.includes(ext))
      return { label: 'SETUP', className: 'bg-yellow-500/20 text-yellow-400' };
    if (recommendedFormats.experimental.includes(ext))
      return { label: 'BETA', className: 'bg-orange-500/20 text-orange-400' };
    if (recommendedFormats.problematic.includes(ext))
      return { label: 'RISKY', className: 'bg-red-500/20 text-red-400' };
    return null;
  }

  function updatePosition() {
    if (!buttonEl) return;
    const rect = buttonEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const dropdownHeight = 400;
    const openUpward = spaceBelow < 200;

    position = {
      top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: Math.max(10, Math.min(rect.left, window.innerWidth - 330)),
      width: 320,
    };
  }

  function handleSelect(ext: string) {
    onChange(ext);
    isOpen = false;
  }

  function toggleOpen() {
    if (disabled) return;
    isOpen = !isOpen;
  }

  // --- Manage open state: position, outside click, keyboard, scroll ---
  $effect(() => {
    if (!isOpen) return;

    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!buttonEl?.contains(target) && !dropdownEl?.contains(target)) {
        isOpen = false;
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') isOpen = false;
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  });

  let selectedBadge = $derived(getBadge(selected));
</script>

<button
  bind:this={buttonEl}
  onclick={toggleOpen}
  {disabled}
  class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded flex items-center justify-between text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  <div class="flex items-center gap-2">
    <span class="text-xs">{STABILITY_CONFIG[selectedFormat?.stability || 'stable'].icon}</span>
    <span class="font-mono uppercase">{selected}</span>
    {#if selectedBadge}
      <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold {selectedBadge.className}">
        {selectedBadge.label}
      </span>
    {/if}
  </div>
  <ChevronDown
    size={14}
    class="text-white/40 transition-transform {isOpen ? 'rotate-180' : ''}"
  />
</button>

{#if isOpen}
  <div
    bind:this={dropdownEl}
    class="fixed z-[9999] bg-slate-800 border border-purple-500/50 rounded-xl shadow-2xl overflow-hidden"
    style="top: {position.top}px; left: {position.left}px; width: {position.width}px; max-height: 400px;"
  >
    {#if hiddenCount > 0}
      <div class="p-2 border-b border-white/10 bg-slate-700/50">
        <label class="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            bind:checked={showAll}
            class="w-3.5 h-3.5 rounded bg-white/10 border-white/20 checked:bg-purple-500"
          />
          <Filter size={12} class="text-white/50" />
          <span class="text-white/70">Show all formats (+{hiddenCount} hidden)</span>
        </label>
      </div>
    {/if}

    <div class="overflow-y-auto max-h-[340px]">
      {#each Object.entries(groupedFormats) as [category, categoryFormats]}
        <div>
          <div
            class="sticky top-0 px-3 py-1.5 bg-slate-700 text-[10px] font-bold text-white/50 uppercase tracking-wider"
          >
            {CATEGORY_LABELS[category as Category]}
          </div>
          {#each categoryFormats as format (format.extension)}
            {@const badge = getBadge(format.extension)}
            {@const isSelected = format.extension === selected}
            <button
              onclick={() => handleSelect(format.extension)}
              class="w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-purple-500/10 transition-colors
                {isSelected ? 'bg-purple-500/20' : ''}"
            >
              <span class="text-sm mt-0.5"
                >{STABILITY_CONFIG[format.stability].icon}</span
              >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-mono font-bold text-white uppercase"
                    >{format.extension}</span
                  >
                  {#if badge}
                    <span
                      class="text-[9px] px-1.5 py-0.5 rounded font-semibold {badge.className}"
                    >
                      {badge.label}
                    </span>
                  {/if}
                </div>
                <div class="text-xs text-white/60 mt-0.5 truncate">{format.name}</div>
              </div>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}