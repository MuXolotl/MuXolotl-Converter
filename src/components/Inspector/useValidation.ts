import { invoke } from '@tauri-apps/api/core';
import { APP_CONFIG } from '@/config';
import { gpuStore } from '@/stores/gpu.svelte';
import type {
  FileItem,
  MediaType,
  RecommendedFormats,
  ValidationResult,
} from '@/types';

/**
 * Reactive validation and format recommendations for a selected file.
 *
 * - `loadRecommendations()` fetches recommended formats for the file
 * - `runValidation()` performs a debounced validation via the Rust backend
 * - Both are reactive: they reset when the file or its settings change
 */
export function useValidation() {
  let recommendations = $state<RecommendedFormats | undefined>();
  let validation = $state<ValidationResult | null>(null);

  let #debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadRecommendations(
    file: FileItem,
    targetType: MediaType | string,
  ): Promise<void> {
    const mediaInfo = file.mediaInfo;
    if (!mediaInfo || file.status !== 'pending' || !targetType) {
      recommendations = undefined;
      return;
    }

    try {
      recommendations = await invoke<RecommendedFormats>(
        'get_recommended_formats',
        {
          videoCodec: mediaInfo.video_streams[0]?.codec || '',
          audioCodec: mediaInfo.audio_streams[0]?.codec || '',
          mediaType: targetType,
          width: mediaInfo.video_streams[0]?.width || null,
          height: mediaInfo.video_streams[0]?.height || null,
        },
      );
    } catch (e) {
      console.error('Failed to load recommendations:', e);
      recommendations = undefined;
    }
  }

  function runValidation(
    file: FileItem,
    targetType: MediaType | string,
  ): void {
    const mediaInfo = file.mediaInfo;
    if (!mediaInfo || file.status !== 'pending') {
      validation = null;
      return;
    }

    if (#debounceTimer) clearTimeout(#debounceTimer);

    #debounceTimer = setTimeout(async () => {
      try {
        const gpu = gpuStore.info;

        validation = await invoke<ValidationResult>('validate_conversion', {
          context: {
            input_format: mediaInfo.format_name || '',
            output_format: file.outputFormat,
            media_type: targetType,
            settings: file.settings,
            input_video_codec: mediaInfo.video_streams[0]?.codec || null,
            input_audio_codec: mediaInfo.audio_streams[0]?.codec || null,
            input_width: mediaInfo.video_streams[0]?.width || null,
            input_height: mediaInfo.video_streams[0]?.height || null,
            gpu_vendor: gpu.vendor !== 'none' ? gpu.vendor : null,
            gpu_name: gpu.available ? gpu.name : null,
            gpu_available: gpu.available,
          },
        });
      } catch (e) {
        console.error('Validation error:', e);
      }
    }, APP_CONFIG.limits.validationDebounceMs);
  }

  function reset(): void {
    if (#debounceTimer) clearTimeout(#debounceTimer);
    recommendations = undefined;
    validation = null;
  }

  return {
    get recommendations() {
      return recommendations;
    },
    get validation() {
      return validation;
    },
    loadRecommendations,
    runValidation,
    reset,
  };
}