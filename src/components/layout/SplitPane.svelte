<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    left: Snippet;
    right: Snippet;
    minLeftWidth?: number;
    minRightWidth?: number;
    defaultLeftRatio?: number;
  }

  let {
    left,
    right,
    minLeftWidth = 400,
    minRightWidth = 300,
    defaultLeftRatio = 0.65,
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let leftWidth: number | null = $state(null);
  let isDragging = $state(false);
  let dragStart: { x: number; width: number } | null = null;

  function getConstrainedWidth(desired: number, containerWidth: number): number {
    const maxLeft = containerWidth - minRightWidth;
    return Math.max(minLeftWidth, Math.min(maxLeft, desired));
  }

  $effect(() => {
    if (!containerEl) return;

    const updateWidth = () => {
      if (!containerEl) return;
      const cw = containerEl.offsetWidth;
      if (leftWidth === null) {
        leftWidth = getConstrainedWidth(cw * defaultLeftRatio, cw);
      } else {
        leftWidth = getConstrainedWidth(leftWidth, cw);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerEl);

    return () => observer.disconnect();
  });

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    if (leftWidth === null) return;
    dragStart = { x: e.clientX, width: leftWidth };
    isDragging = true;
  }

  $effect(() => {
    if (!isDragging || !dragStart) return;

    const startData = dragStart;

    function handleMouseMove(e: MouseEvent) {
      if (!containerEl || !startData) return;
      const cw = containerEl.offsetWidth;
      const delta = e.clientX - startData.x;
      leftWidth = getConstrainedWidth(startData.width + delta, cw);
    }

    function handleMouseUp() {
      isDragging = false;
      dragStart = null;
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  });
</script>

<div bind:this={containerEl} class="flex h-full w-full overflow-hidden">
  {#if leftWidth !== null}
    <div style="width: {leftWidth}px; flex-shrink: 0;" class="h-full overflow-hidden">
      {@render left()}
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      onmousedown={handleMouseDown}
      class="w-1 h-full cursor-col-resize flex-shrink-0 transition-colors hover:bg-purple-500/50 active:bg-purple-500
        {isDragging ? 'bg-purple-500' : 'bg-white/10'}"
    ></div>

    <div class="flex-1 h-full min-w-0 overflow-hidden">
      {@render right()}
    </div>
  {/if}
</div>