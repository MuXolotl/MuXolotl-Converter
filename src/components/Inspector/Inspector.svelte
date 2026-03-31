<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import {
    Play,
    Square,
    RotateCcw,
    FolderOpen,
    ArrowRight,
    FileVideo,
    Music,
    FileAudio,
  } from 'lucide-svelte';
  import { APP_CONFIG } from '@/config';
  import { formatDuration, formatFileSize } from '@/utils';
  import { fileQueueStore } from '@/stores/fileQueue.svelte';
  import { conversionStore } from '@/stores/conversion.svelte';
  import FormatSelector from '@/components/FormatSelector.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import ValidationBanner from './ValidationBanner.svelte';
  import Tabs from './Tabs.svelte';
  import type { TabId } from './Tabs.svelte';
  import type {
    FileItem,
    FileSettings,
    AudioFormat,
    VideoFormat,
    ValidationResult,
    RecommendedFormats,
  } from '@/types';

  interface Props {
    file: FileItem | null;
    selectedCount: number;
    outputFolder: string;
    onRetry: (id: string) => void;
  }

  let { file, selectedCount, outputFolder, onRetry }: Props = $props();

  // --- Local state ---
  let formats = $state<(AudioFormat | VideoFormat)[]>([]);
  let recommendations = $state<RecommendedFormats | undefined>();
  let validation = $state<ValidationResult | null>(null);
  let activeTab = $state<TabId>('general');

  // Track previous values to avoid unnecessary tab resets
  let prevFileId: string | undefined;
  let prevExtractAudio: boolean | undefined;

  // --- Derived ---
  let isVideo = $derived(file?.mediaInfo?.media_type === 'video');
  let isAudio = $derived(file?.mediaInfo?.media_type === 'audio');
  let isExtracting = $derived(!!file?.settings.extractAudioOnly && isVideo);
  let isDisabled = $derived(file?.status !== 'pending');
  let isProcessing = $derived(file?.status === 'processing');
  let canConvert = $derived(file?.status === 'pending' && !!outputFolder);

  let targetType = $derived.by(() => {
    if (!file) return null;
    return isExtracting || isAudio ? 'audio' : 'video';
  });

  let codecName = $derived.by(() => {
    if (!file?.mediaInfo) return 'N/A';
    if (isAudio) return file.mediaInfo.audio_streams?.[0]?.codec || 'N/A';
    return file.mediaInfo.video_streams?.[0]?.codec || 'N/A';
  });

  // --- Effect: reset tab only when file ID or extractAudio actually changes ---
  $effect(() => {
    const currentId = file?.id;
    const currentExtract = file?.settings.extractAudioOnly ?? false;

    if (currentId !== prevFileId || currentExtract !== prevExtractAudio) {
      activeTab = 'general';
    }

    prevFileId = currentId;
    prevExtractAudio = currentExtract;
  });

  // --- Effect: load formats ---
  $effect(() => {
    const type = targetType;
    if (!type) return;

    let cancelled = false;
    const command = type === 'audio' ? 'get_audio_formats' : 'get_video_formats';

    invoke<(AudioFormat | VideoFormat)[]>(command)
      .then((data) => {
        if (!cancelled) formats = data;
      })
      .catch((e) => console.error('Failed to load formats:', e));

    return () => {
      cancelled = true;
    };
  });

  // --- Effect: load recommendations ---
  $effect(() => {
    const mediaInfo = file?.mediaInfo;
    const status = file?.status;
    const type = targetType;

    if (!mediaInfo || status !== 'pending' || !type) return;

    let cancelled = false;

    invoke<RecommendedFormats>('get_recommended_formats', {
      videoCodec: mediaInfo.video_streams[0]?.codec || '',
      audioCodec: mediaInfo.audio_streams[0]?.codec || '',
      mediaType: type,
      width: mediaInfo.video_streams[0]?.width || null,
      height: mediaInfo.video_streams[0]?.height || null,
    })
      .then((recs) => {
        if (!cancelled) recommendations = recs;
      })
      .catch((e) => console.error('Failed to load recommendations:', e));

    return () => {
      cancelled = true;
    };
  });

  // --- Effect: validate (debounced) ---
  $effect(() => {
    const currentFile = file;
    const _format = currentFile?.outputFormat;
    const _settings = currentFile?.settings;
    const _status = currentFile?.status;
    const _mediaInfo = currentFile?.mediaInfo;
    const type = targetType;

    if (!currentFile || _status !== 'pending' || !_mediaInfo) {
      validation = null;
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const result = await invoke<ValidationResult>('validate_conversion', {
          inputFormat: _mediaInfo.format_name || '',
          outputFormat: currentFile.outputFormat,
          mediaType: type,
          settings: currentFile.settings,
        });
        validation = result;
      } catch (e) {
        console.error('Validation error:', e);
      }
    }, APP_CONFIG.limits.validationDebounceMs);

    return () => clearTimeout(timeout);
  });

  // --- Handlers ---
  function handleFormatChange(format: string) {
    if (!file) return;
    fileQueueStore.updateFile(file.id, { outputFormat: format, outputPath: undefined });
  }

  function handleSettingsChange(updates: Partial<FileSettings>) {
    if (!file) return;
    if ('extractAudioOnly' in updates) {
      fileQueueStore.updateFile(file.id, {
        settings: { ...file.settings, ...updates },
        outputFormat: updates.extractAudioOnly ? 'mp3' : 'mp4',
        outputPath: undefined,
      });
    } else {
      fileQueueStore.updateFile(file.id, {
        settings: { ...file.settings, ...updates },
      });
    }
  }

  function handleStart() {
    if (file) conversionStore.startConversion(file);
  }

  function handleCancel() {
    if (file) conversionStore.cancelConversion(file.id);
  }

  function handleRetry() {
    if (file) onRetry(file.id);
  }
</script>

{#if !file}
  <!-- Empty state -->
  <div
    class="h-full flex flex-col items-center justify-center text-slate-500 bg-[#1e293b] border-l border-white/5 p-4"
  >
    <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </div>
    <p class="text-xs font-medium text-center">
      {selectedCount > 1 ? `${selectedCount} files selected` : 'Select a file'}
    </p>
  </div>
{:else}
  <div class="h-full flex flex-col bg-[#1e293b] border-l border-white/5 overflow-hidden">
    <!-- Preview Header -->
    <div
      class="h-28 shrink-0 bg-[#161e2e] relative flex flex-col items-center justify-center border-b border-white/5 overflow-hidden"
    >
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent to-[#1e293b]/30 pointer-events-none"
      ></div>

      {#if isAudio}
        <div
          class="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-white/10 flex items-center justify-center"
        >
          <Music size={24} class="text-blue-400" />
        </div>
      {:else if isExtracting}
        <div class="flex items-center gap-2">
          <div
            class="w-10 h-10 bg-slate-800 rounded border border-white/10 flex items-center justify-center"
          >
            <FileVideo size={16} class="text-slate-500" />
          </div>
          <ArrowRight size={14} class="text-blue-500 animate-pulse" />
          <div
            class="w-10 h-10 bg-blue-900/20 rounded border border-blue-500/30 flex items-center justify-center"
          >
            <FileAudio size={16} class="text-blue-400" />
          </div>
        </div>
      {:else}
        <div
          class="w-16 h-12 bg-black/30 rounded border border-white/5 flex items-center justify-center"
        >
          <FileVideo size={20} class="text-slate-600" />
        </div>
      {/if}

      <div class="absolute bottom-2 left-2 right-2 text-center">
        <div
          class="inline-block px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 max-w-full"
        >
          <p class="text-[9px] font-mono text-white/70 truncate">{file.name}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col min-h-0">
      <div class="p-3 pb-1 shrink-0">
        <!-- Meta Stats -->
        <div
          class="flex justify-between items-center mb-3 bg-black/10 p-2 rounded border border-white/5"
        >
          <div class="text-center flex-1 min-w-0 px-1">
            <div class="text-[8px] uppercase text-slate-500 font-bold">Dur</div>
            <div class="text-[10px] font-mono text-slate-300 truncate">
              {formatDuration(file.mediaInfo?.duration || 0)}
            </div>
          </div>
          <div class="w-px h-4 bg-white/5"></div>
          <div class="text-center flex-1 min-w-0 px-1">
            <div class="text-[8px] uppercase text-slate-500 font-bold">Size</div>
            <div class="text-[10px] font-mono text-slate-300 truncate">
              {formatFileSize(file.mediaInfo?.file_size || 0)}
            </div>
          </div>
          <div class="w-px h-4 bg-white/5"></div>
          <div class="text-center flex-1 min-w-0 px-1">
            <div class="text-[8px] uppercase text-slate-500 font-bold">Codec</div>
            <div class="text-[10px] font-mono text-slate-300 truncate">
              {codecName.toUpperCase()}
            </div>
          </div>
        </div>

        <!-- Format Selector -->
        <div class="mb-3">
          <div class="flex items-center gap-2">
            <span
              class="px-1.5 py-1 text-[9px] font-mono uppercase bg-black/40 border border-white/10 text-slate-400 rounded shrink-0"
            >
              {(file.mediaInfo?.format_name || 'raw').split(',')[0]}
            </span>
            <ArrowRight size={10} class="text-white/20 shrink-0" />
            <div class="flex-1 min-w-0">
              <FormatSelector
                {formats}
                selected={file.outputFormat}
                onChange={handleFormatChange}
                disabled={isDisabled}
                recommendedFormats={recommendations}
              />
            </div>
          </div>
        </div>

        {#if !isDisabled && validation}
          <div class="mb-3">
            <ValidationBanner {validation} />
          </div>
        {/if}

        <Tabs
          {activeTab}
          onTabChange={(tab) => (activeTab = tab)}
          hasVideo={isVideo && !isExtracting}
          hasAudio={true}
        />
      </div>

      <!-- Settings Panel -->
      <div class="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        <SettingsPanel
          {file}
          {activeTab}
          disabled={isDisabled}
          onChange={handleSettingsChange}
        />
      </div>
    </div>

    <!-- Action Button -->
    <div class="p-3 border-t border-white/5 bg-[#172033] shrink-0">
      {#if file.status === 'pending'}
        {#if !outputFolder}
          <div
            class="w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 animate-pulse"
          >
            <FolderOpen size={14} />
            <span>Select Folder</span>
          </div>
        {:else}
          <button
            onclick={handleStart}
            disabled={!canConvert}
            class="w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Play size={14} fill="currentColor" />
            <span>Convert</span>
          </button>
        {/if}
      {:else if isProcessing}
        <button
          onclick={handleCancel}
          class="w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
        >
          <Square size={14} fill="currentColor" />
          <span>Stop</span>
        </button>
      {:else}
        <button
          onclick={handleRetry}
          class="w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
        >
          <RotateCcw size={14} />
          <span>Retry</span>
        </button>
      {/if}
    </div>
  </div>
{/if}