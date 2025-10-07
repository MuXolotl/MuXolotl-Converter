import React from 'react';
import FormatSelector from '@/components/FormatSelector';
import { QUALITY_OPTIONS } from '@/constants';
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
}) => {
  const selectClassName =
    'w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-primary-purple cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-3">
        <label className="block text-white/60 text-xs mb-1">Input</label>
        <div
          className="px-2 py-1.5 rounded bg-white/5 text-white uppercase font-mono text-xs text-center overflow-hidden"
          title={inputFormat}
        >
          <div className="truncate">{inputFormat.split(',')[0]}</div>
        </div>
      </div>

      <div className="col-span-1 flex items-end justify-center pb-2">
        <span className="text-white/40 text-lg">→</span>
      </div>

      <div className="col-span-4">
        <label className="block text-white/60 text-xs mb-1">Output</label>
        <FormatSelector
          formats={formats}
          selected={outputFormat}
          onChange={onFormatChange}
          disabled={disabled}
          recommendedFormats={recommendedFormats}
        />
      </div>

      <div className="col-span-4">
        <label className="block text-white/60 text-xs mb-1">Quality</label>
        <select
          value={quality}
          onChange={(e) => onQualityChange(e.target.value)}
          disabled={disabled}
          className={selectClassName}
        >
          {QUALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default React.memo(FormatSettings);
