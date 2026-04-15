<script lang="ts">
  import {
    QUALITY_OPTIONS,
    AUDIO_SAMPLE_RATES,
    AUDIO_CHANNELS,
    VIDEO_RESOLUTIONS,
    VIDEO_FPS,
  } from '@/constants';
  import Select from '@/components/ui/Select.svelte';
  import Input from '@/components/ui/Input.svelte';
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

{#if activeTab === 'general'}
  <div class="space-y-4">
    <div class="group">
      <label
        for="setting-quality"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Quality Preset
      </label>
      <Select
        id="setting-quality"
        value={file.settings.quality}
        onchange={(e) => onChange({ quality: (e.target as HTMLSelectElement).value as FileSettings['quality'] })}
        {disabled}
      >
        {#each QUALITY_OPTIONS as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </Select>
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
      <Select
        id="setting-resolution"
        value={currentResolution()}
        onchange={handleResolutionChange}
        {disabled}
      >
        {#each VIDEO_RESOLUTIONS as r (r.value)}
          <option value={r.value}>{r.label}</option>
        {/each}
      </Select>
    </div>

    <div class="group">
      <label
        for="setting-fps"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Frame Rate
      </label>
      <Select
        id="setting-fps"
        value={file.settings.fps?.toString() || 'original'}
        onchange={handleFpsChange}
        {disabled}
      >
        {#each VIDEO_FPS as f (f.value)}
          <option value={f.value}>{f.label}</option>
        {/each}
      </Select>
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
      <Select
        id="setting-samplerate"
        value={file.settings.sampleRate?.toString() || '44100'}
        onchange={(e) => onChange({ sampleRate: parseInt((e.target as HTMLSelectElement).value) })}
        {disabled}
      >
        {#each AUDIO_SAMPLE_RATES as r (r)}
          <option value={r.toString()}>{r} Hz</option>
        {/each}
      </Select>
    </div>

    <div class="group">
      <label
        for="setting-channels"
        class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
      >
        Channels
      </label>
      <Select
        id="setting-channels"
        value={file.settings.channels?.toString() || '2'}
        onchange={(e) => onChange({ channels: parseInt((e.target as HTMLSelectElement).value) })}
        {disabled}
      >
        {#each AUDIO_CHANNELS as c (c.value)}
          <option value={c.value.toString()}>{c.label}</option>
        {/each}
      </Select>
    </div>

    {#if file.settings.quality === 'custom'}
      <div class="group">
        <label
          for="setting-bitrate"
          class="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors"
        >
          Bitrate (kbps)
        </label>
        <Input
          id="setting-bitrate"
          type="number"
          value={file.settings.bitrate || 192}
          onchange={(e) => onChange({ bitrate: parseInt((e.target as HTMLInputElement).value) })}
          {disabled}
          min={64}
          max={320}
          step={32}
        />
      </div>
    {/if}
  </div>
{:else if activeTab === 'metadata'}
  <div class="flex items-center justify-center py-8 text-white/30 text-xs">
    Metadata editing coming soon...
  </div>
{/if}