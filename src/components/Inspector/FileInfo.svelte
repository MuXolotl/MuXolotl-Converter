<script lang="ts">
  import { Copy, Check, Film, Music, HardDrive, FileText } from 'lucide-svelte';
  import { formatDuration, formatFileSize } from '@/utils';
  import type { FileItem } from '@/types';

  interface Props {
    file: FileItem;
  }

  let { file }: Props = $props();

  let copied = $state(false);

  let media = $derived(file.mediaInfo);
  let videoStreams = $derived(media?.video_streams || []);
  let audioStreams = $derived(media?.audio_streams || []);

  // --- Formatters ---

  function formatBitrate(bps: number | null | undefined): string {
    if (!bps) return '—';
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    if (bps >= 1_000) return `${Math.round(bps / 1_000)} kbps`;
    return `${bps} bps`;
  }

  function formatSampleRate(hz: number): string {
    if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz`;
    return `${hz} Hz`;
  }

  function formatChannels(ch: number): string {
    switch (ch) {
      case 1: return 'Mono';
      case 2: return 'Stereo';
      case 6: return '5.1 Surround';
      case 8: return '7.1 Surround';
      default: return `${ch} ch`;
    }
  }

  function formatFps(fps: number): string {
    if (fps === 0) return '—';
    if (Math.abs(fps - 23.976) < 0.01) return '23.976';
    if (Math.abs(fps - 29.97) < 0.01) return '29.97';
    if (Math.abs(fps - 59.94) < 0.01) return '59.94';
    return fps % 1 === 0 ? fps.toFixed(0) : fps.toFixed(2);
  }

  function getResolutionLabel(w: number, h: number): string {
    if (w >= 7680 || h >= 4320) return '8K';
    if (w >= 3840 || h >= 2160) return '4K';
    if (w >= 2560 || h >= 1440) return '1440p';
    if (w >= 1920 || h >= 1080) return '1080p';
    if (w >= 1280 || h >= 720) return '720p';
    if (w >= 854 || h >= 480) return '480p';
    return `${h}p`;
  }

  function getAspectRatio(w: number, h: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const d = gcd(w, h);
    const rw = w / d;
    const rh = h / d;
    if (rw <= 64 && rh <= 64) return `${rw}:${rh}`;
    return `${(w / h).toFixed(2)}:1`;
  }

  function getTotalBitrate(): string {
    if (!media) return '—';
    let total = 0;
    let hasAny = false;
    for (const v of media.video_streams) {
      if (v.bitrate) { total += v.bitrate; hasAny = true; }
    }
    for (const a of media.audio_streams) {
      if (a.bitrate) { total += a.bitrate; hasAny = true; }
    }
    if (!hasAny && media.duration > 0 && media.file_size > 0) {
      total = Math.round((media.file_size * 8) / media.duration);
      hasAny = true;
    }
    return hasAny ? formatBitrate(total) : '—';
  }

  function formatStreamCount(): string {
    const v = videoStreams.length;
    const a = audioStreams.length;
    const parts: string[] = [];
    if (v > 0) parts.push(`${v} video`);
    if (a > 0) parts.push(`${a} audio`);
    return parts.join(', ') || 'None';
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(file.path);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch { /* ignore */ }
  }
</script>

{#snippet infoCard(label: string, value: string, colorClass?: string)}
  <div class="p-2 bg-black/20 rounded border border-white/5">
    <div class="text-[8px] uppercase text-slate-500 font-bold mb-0.5">{label}</div>
    <div
      class="text-[11px] font-mono truncate {colorClass || 'text-slate-200'}"
      title={value}
    >
      {value}
    </div>
  </div>
{/snippet}

{#if !media}
  <div class="flex items-center justify-center py-8 text-white/30 text-xs">
    No media information available
  </div>
{:else}
  <div class="space-y-4">
    <!-- Source Path -->
    <div>
      <div class="flex items-center gap-1.5 mb-2">
        <HardDrive size={12} class="text-slate-500" />
        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source</span>
      </div>
      <div class="flex items-center gap-2 p-2 bg-black/20 rounded border border-white/5">
        <div
          class="flex-1 min-w-0 text-[10px] font-mono text-slate-400 truncate"
          title={file.path}
        >
          {file.path}
        </div>
        <button
          onclick={copyPath}
          class="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0"
          title="Copy path"
        >
          {#if copied}
            <Check size={12} class="text-green-400" />
          {:else}
            <Copy size={12} />
          {/if}
        </button>
      </div>
    </div>

    <!-- General Info -->
    <div>
      <div class="flex items-center gap-1.5 mb-2">
        <FileText size={12} class="text-slate-500" />
        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">General</span>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        {@render infoCard('Container', media.format_name.split(',')[0].toUpperCase())}
        {@render infoCard('Size', formatFileSize(media.file_size))}
        {@render infoCard('Duration', formatDuration(media.duration))}
      </div>
      <div class="grid grid-cols-2 gap-1.5 mt-1.5">
        {@render infoCard('Total Bitrate', getTotalBitrate())}
        {@render infoCard('Streams', formatStreamCount())}
      </div>
    </div>

    <!-- Video Streams -->
    {#each videoStreams as stream, i}
      <div>
        <div class="flex items-center gap-1.5 mb-2">
          <Film size={12} class="text-blue-400/60" />
          <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Video{videoStreams.length > 1 ? ` #${i + 1}` : ''}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          {@render infoCard('Codec', stream.codec.toUpperCase(), 'text-blue-400')}
          {@render infoCard('Resolution', `${stream.width}×${stream.height} (${getResolutionLabel(stream.width, stream.height)})`)}
          {@render infoCard('FPS', `${formatFps(stream.fps)} fps`)}
        </div>
        <div class="grid grid-cols-2 gap-1.5 mt-1.5">
          {@render infoCard('Bitrate', formatBitrate(stream.bitrate))}
          {@render infoCard('Aspect Ratio', getAspectRatio(stream.width, stream.height))}
        </div>
      </div>
    {/each}

    <!-- Audio Streams -->
    {#each audioStreams as stream, i}
      <div>
        <div class="flex items-center gap-1.5 mb-2">
          <Music size={12} class="text-emerald-400/60" />
          <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Audio{audioStreams.length > 1 ? ` #${i + 1}` : ''}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          {@render infoCard('Codec', stream.codec.toUpperCase(), 'text-emerald-400')}
          {@render infoCard('Sample Rate', formatSampleRate(stream.sample_rate))}
        </div>
        <div class="grid grid-cols-2 gap-1.5 mt-1.5">
          {@render infoCard('Channels', formatChannels(stream.channels))}
          {@render infoCard('Bitrate', formatBitrate(stream.bitrate))}
        </div>
      </div>
    {/each}
  </div>
{/if}