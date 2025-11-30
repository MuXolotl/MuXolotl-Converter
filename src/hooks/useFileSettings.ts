import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import type { FileItem, AudioFormat, VideoFormat, ValidationResult, RecommendedFormats } from '@/types';

const VALIDATION_DEBOUNCE_MS = 300;

export function useFileSettings(file: FileItem | null) {
  const [formats, setFormats] = useState<(AudioFormat | VideoFormat)[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedFormats | undefined>();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  
  const mountedRef = useRef(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isVideo = file?.mediaInfo?.media_type === 'video';
  const isAudio = file?.mediaInfo?.media_type === 'audio';
  const extractAudio = file?.settings.extractAudioOnly;

  // Determine target type
  const targetType = useMemo(() => {
    if (!file) return null;
    return (extractAudio || isAudio) ? 'audio' : 'video';
  }, [file, extractAudio, isAudio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load formats
  useEffect(() => {
    if (!targetType) return;

    const load = async () => {
      try {
        const command = targetType === 'audio' ? 'get_audio_formats' : 'get_video_formats';
        const data = await invoke<(AudioFormat | VideoFormat)[]>(command);
        
        if (mountedRef.current) {
          setFormats(data);
        }
      } catch (e) {
        console.error('Failed to load formats:', e);
      }
    };

    load();
  }, [targetType]);

  // Load recommendations
  useEffect(() => {
    if (!file?.mediaInfo || file.status !== 'pending') return;

    const load = async () => {
      try {
        const recs = await invoke<RecommendedFormats>('get_recommended_formats', {
          videoCodec: file.mediaInfo?.video_streams[0]?.codec || '',
          audioCodec: file.mediaInfo?.audio_streams[0]?.codec || '',
          mediaType: targetType,
          width: file.mediaInfo?.video_streams[0]?.width || null,
          height: file.mediaInfo?.video_streams[0]?.height || null,
        });

        if (mountedRef.current) {
          setRecommendations(recs);
        }
      } catch (e) {
        console.error('Failed to load recommendations:', e);
      }
    };

    load();
  }, [file?.mediaInfo, targetType, file?.status]);

  // Validation (debounced)
  useEffect(() => {
    if (!file || file.status !== 'pending' || !file.mediaInfo) {
      setValidation(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await invoke<ValidationResult>('validate_conversion', {
          inputFormat: file.mediaInfo?.format_name || '',
          outputFormat: file.outputFormat,
          mediaType: targetType,
          settings: file.settings,
        });

        if (mountedRef.current) {
          setValidation(result);
        }
      } catch (e) {
        console.error('Validation error:', e);
      }
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [file?.outputFormat, file?.settings, file?.status, targetType]);

  return { formats, recommendations, validation };
}