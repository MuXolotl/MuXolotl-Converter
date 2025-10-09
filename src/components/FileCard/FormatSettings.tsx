import React from 'react';
import FormatSelector from '@/components/FormatSelector';
import { QUALITY_OPTIONS } from '@/constants';
import { ArrowRight, Settings, Music } from 'lucide-react';
import type { AudioFormat, VideoFormat, RecommendedFormats } from '@/types';

interface FormatSettingsProps {
  inputFormat: string;
  outputFormat: string;
  quality: string;
  formats: (AudioFormat | VideoFormat)[];
  disabled: boolean;
  recommendedFormats?: RecommendedFormats;
  onFormatChange: (format: string) => void;
  onQualityChange: (quality: string) => void;
  isAdvancedOpen?: boolean;
  onToggleAdvanced?: () => void;
  isVideo?: boolean;
  extractAudioOnly?: boolean;
  onToggleExtractAudio?: (value: boolean) => void;
}

const FormatSettings: React.FC<FormatSettingsProps> = ({
  inputFormat,
  outputFormat,
  quality,
  formats,
  disabled,
  recommendedFormats,
  onFormatChange,
  onQualityChange,
  isAdvancedOpen = false,
  onToggleAdvanced,
  isVideo = false,
  extractAudioOnly = false,
  onToggleExtractAudio,
}) => {
  return (
    <div>
      <div className="flex items-end gap-2">
        {/* Input Format */}
        <div className="flex-shrink-0">
          <div className="h-[14px] mb-1" />
          <div className="flex items-center gap-2 h-8">
            <div className="px-2 py-1 rounded bg-white/5 text-white/60 uppercase font-mono text-[10px] border border-white/5">
              {inputFormat.split(',')[0]}
            </div>
            <ArrowRight size={14} className="text-white/30" />
          </div>
        </div>

        {/* Output Format */}
        <div className="w-32">
          <label className="block text-white/60 text-[10px] mb-1">Output Format</label>
          <FormatSelector
            formats={formats}
            selected={outputFormat}
            onChange={onFormatChange}
            disabled={disabled}
            recommendedFormats={recommendedFormats}
          />
        </div>

        {/* Quality */}
        <div className="w-28">
          <label className="block text-white/60 text-[10px] mb-1">Quality</label>
          <select
            value={quality}
            onChange={e => onQualityChange(e.target.value)}
            disabled={disabled}
            className="w-full h-8 px-2 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-primary-purple cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {QUALITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Settings Button */}
        {!disabled && onToggleAdvanced && (
          <div className="flex-shrink-0">
            <div className="h-[14px] mb-1" />
            <button
              onClick={onToggleAdvanced}
              className={`h-8 w-8 flex items-center justify-center rounded transition-all ${
                isAdvancedOpen
                  ? 'bg-primary-purple/20 text-primary-purple'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title="Advanced Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Extract Audio Checkbox */}
      {isVideo && !disabled && onToggleExtractAudio && (
        <div className="mt-1 ml-[100px]">
          <div
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded hover:bg-white/[0.07] transition-colors cursor-pointer"
            onClick={() => onToggleExtractAudio(!extractAudioOnly)}
          >
            <input
              type="checkbox"
              checked={extractAudioOnly}
              onChange={e => onToggleExtractAudio(e.target.checked)}
              className="w-3 h-3 rounded bg-white/10 border-white/20 checked:bg-primary-pink cursor-pointer"
              onClick={e => e.stopPropagation()}
            />
            <Music size={10} className="text-primary-pink" />
            <span className="text-white/70 text-[10px]">Video → Audio</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(FormatSettings);