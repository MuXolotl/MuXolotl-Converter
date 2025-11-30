import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import type { FileItem, AudioFormat, VideoFormat, ValidationResult, RecommendedFormats } from '@/types';

export const useFileSettings = (file: FileItem) => {
  const [formats, setFormats] = useState<(AudioFormat | VideoFormat)[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedFormats | undefined>();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  
  const isMounted = useRef(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isVideo = file.mediaInfo?.media_type === 'video';
  const isAudio = file.mediaInfo?.media_type === 'audio';
  const extractAudio = file.settings.extractAudioOnly;

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 1. Load Available Formats
  useEffect(() => {
    const loadFormats = async () => {
      try {
        const target = (extractAudio || isAudio) ? 'get_audio_formats' : 'get_video_formats';
        const data = await invoke<(AudioFormat | VideoFormat)[]>(target);
        if (isMounted.current) setFormats(data);
      } catch (e) {
        console.error('Failed to load formats', e);
      }
    };
    loadFormats();
  }, [extractAudio, isAudio]);

  // 2. Load Recommendations
  useEffect(() => {
    if (!file.mediaInfo || file.status !== 'pending') return;

    const fetchRecs = async () => {
      try {
        const recs = await invoke<RecommendedFormats>('get_recommended_formats', {
          videoCodec: file.mediaInfo?.video_streams[0]?.codec || '',
          audioCodec: file.mediaInfo?.audio_streams[0]?.codec || '',
          mediaType: extractAudio ? 'audio' : file.mediaInfo?.media_type,
          width: file.mediaInfo?.video_streams[0]?.width || null,
          height: file.mediaInfo?.video_streams[0]?.height || null,
        });
        if (isMounted.current) setRecommendations(recs);
      } catch (e) {
        console.error('Recs error', e);
      }
    };
    fetchRecs();
  }, [file.mediaInfo, extractAudio]);

  // 3. Validation (Debounced)
  useEffect(() => {
    if (file.status !== 'pending' || !file.mediaInfo) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await invoke<ValidationResult>('validate_conversion', {
          inputFormat: file.mediaInfo?.format_name || '',
          outputFormat: file.outputFormat,
          mediaType: extractAudio ? 'audio' : file.mediaInfo?.media_type || 'unknown',
          settings: file.settings,
        });
        if (isMounted.current) setValidation(res);
      } catch (e) {
        console.error('Validation error', e);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [file.outputFormat, file.settings, extractAudio, file.status]);

  return { formats, recommendations, validation };
};