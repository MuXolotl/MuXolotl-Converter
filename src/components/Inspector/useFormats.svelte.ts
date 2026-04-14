import { invoke } from '@tauri-apps/api/core';
import type { AudioFormat, VideoFormat, MediaType } from '@/types';

export type FormatList = (AudioFormat | VideoFormat)[];

/**
 * Load available formats for the given media type.
 * Returns a reactive object with the loaded formats array.
 */
export function useFormats() {
  let formats = $state<FormatList>([]);

  async function load(mediaType: MediaType | string | null) {
    if (!mediaType) {
      formats = [];
      return;
    }

    const command =
      mediaType === 'audio' ? 'get_audio_formats' : 'get_video_formats';

    try {
      formats = await invoke<FormatList>(command);
    } catch (e) {
      console.error('Failed to load formats:', e);
      formats = [];
    }
  }

  return {
    get formats() {
      return formats;
    },
    load,
  };
}