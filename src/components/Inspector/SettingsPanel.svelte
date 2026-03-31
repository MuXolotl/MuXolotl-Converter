<script lang="ts">
  import {
    QUALITY_OPTIONS,
    AUDIO_SAMPLE_RATES,
    AUDIO_CHANNELS,
    VIDEO_RESOLUTIONS,
    VIDEO_FPS,
  } from '@/constants';
  import type { FileItem, FileSettings } from '@/types';
  import type { TabId } from './Tabs.svelte';

  interface Props {
    file: FileItem;
    activeTab: TabId;
    disabled: boolean;
    onChange: (updates: Partial<FileSettings>) => void;
  }

  let { file, activeTab, disabled, onChange }: Props = $props();

  let isVideo = $derived(file.mediaInfo?.media_type === 'video');

  function currentResolution(): string {
    if (file.settings.width && file.settings.height) {
      return `${file.settings.width}x${file.settings.height}`;
    }
    return 'original';
  }

  function handleResolutionChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (val === 'original') {
      onChange({ width: undefined, height: undefined });
    } else {
      const [w, h] = val.split('x').map(Number);
      onChange({ width: w, height: h });
    }
  }

  function handleFpsChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    onChange({ fps: val === 'original' ? undefined : parseInt(val) });
  }
</script>

{#snippet selectField(id: string, value: string, onchange: (e: Event) => void, options: { value: string; label: string }[])}
  <div class="relative">
    <select
      {id}
      {value}
      {onchange}
      {disabled}
      class="w-full px-3 py-2.5 bg-[#0f172a] border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer appearance-none"
    >
      {#each options as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
    <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
        <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
  </div>
{/snippet}

{#if activeTab === 'general'}
  <div class="space-y-4">
    <div class="group">
      <label
        for="setting-quality"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Quality Preset
      </label>
      {@render selectField(
        'setting-quality',
        file.settings.quality,
        (e) => onChange({ quality: (e.target as HTMLSelectElement).value as FileSettings['quality'] }),
        QUALITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      )}
    </div>

    {#if isVideo}
      <div class="pt-4 border-t border-white/5">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="flex items-start gap-3 cursor-pointer group p-2 hover:bg-white/5 rounded transition-colors">
          <input
            type="checkbox"
            checked={file.settings.extractAudioOnly}
            onchange={(e) => onChange({ extractAudioOnly: (e.target as HTMLInputElement).checked })}
            {disabled}
            class="mt-0.5 shrink-0"
          />
          <div class="min-w-0">
            <div class="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
              Extract Audio
            </div>
            <div class="text-xs text-white/40">Convert video file to audio only</div>
          </div>
        </label>
      </div>
    {/if}
  </div>
{:else if activeTab === 'video' && !file.settings.extractAudioOnly}
  <div class="space-y-4">
    <div class="group">
      <label
        for="setting-resolution"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Resolution
      </label>
      {@render selectField(
        'setting-resolution',
        currentResolution(),
        handleResolutionChange,
        VIDEO_RESOLUTIONS.map((r) => ({ value: r.value, label: r.label })),
      )}
    </div>

    <div class="group">
      <label
        for="setting-fps"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Frame Rate
      </label>
      {@render selectField(
        'setting-fps',
        file.settings.fps?.toString() || 'original',
        handleFpsChange,
        VIDEO_FPS.map((f) => ({ value: f.value, label: f.label })),
      )}
    </div>
  </div>
{:else if activeTab === 'audio'}
  <div class="space-y-4">
    <div class="group">
      <label
        for="setting-samplerate"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Sample Rate
      </label>
      {@render selectField(
        'setting-samplerate',
        file.settings.sampleRate?.toString() || '44100',
        (e) => onChange({ sampleRate: parseInt((e.target as HTMLSelectElement).value) }),
        AUDIO_SAMPLE_RATES.map((r) => ({ value: r.toString(), label: `${r} Hz` })),
      )}
    </div>

    <div class="group">
      <label
        for="setting-channels"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Channels
      </label>
      {@render selectField(
        'setting-channels',
        file.settings.channels?.toString() || '2',
        (e) => onChange({ channels: parseInt((e.target as HTMLSelectElement).value) }),
        AUDIO_CHANNELS.map((c) => ({ value: c.value.toString(), label: c.label })),
      )}
    </div>

    {#if file.settings.quality === 'custom'}
      <div class="group">
        <label
          for="setting-bitrate"
          class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
        >
          Bitrate (kbps)
        </label>
        <input
          id="setting-bitrate"
          type="number"
          value={file.settings.bitrate || 192}
          onchange={(e) => onChange({ bitrate: parseInt((e.target as HTMLInputElement).value) })}
          {disabled}
          min={64}
          max={320}
          step={32}
          class="w-full px-3 py-2 bg-[#0f172a] border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>
    {/if}
  </div>
{:else if activeTab === 'metadata'}
  <div class="flex items-center justify-center py-8 text-white/30 text-xs">
    Metadata editing coming soon...
  </div>
{/if}