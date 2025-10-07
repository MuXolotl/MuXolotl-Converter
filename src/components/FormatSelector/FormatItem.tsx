import React from 'react';
import { Check, Info } from 'lucide-react';
import { STABILITY_ICONS } from '@/constants';
import { getBadgeInfo } from './utils';
import type { AudioFormat, VideoFormat, RecommendedFormats } from '@/types';

interface FormatItemProps {
  format: AudioFormat | VideoFormat;
  isSelected: boolean;
  recommended?: RecommendedFormats;
  onClick: () => void;
}

const FormatItem: React.FC<FormatItemProps> = ({ format, isSelected, recommended, onClick }) => {
  const badge = getBadgeInfo(format, recommended);

  const bgClass = isSelected
    ? 'bg-primary-purple/25'
    : badge?.label === 'FAST'
      ? 'bg-green-500/5 hover:bg-green-500/10'
      : badge?.label === 'SAFE'
        ? 'hover:bg-blue-500/5'
        : 'hover:bg-primary-purple/12';

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-start gap-2.5 text-left border-b border-white/5 transition-colors ${bgClass}`}
    >
      <span className="w-5 text-center text-lg flex-shrink-0 mt-0.5">{STABILITY_ICONS[format.stability]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-white font-bold text-sm uppercase font-mono">{format.extension}</span>
          {badge && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 ${badge.className}`}
            >
              {badge.icon} {badge.label}
            </span>
          )}
          {isSelected && <Check size={15} className="text-primary-purple flex-shrink-0" />}
        </div>
        <div className="text-white/95 text-xs mb-0.5 font-medium">{format.name}</div>
        <div className="text-white/70 text-[11px] mb-1 leading-snug">{format.description}</div>
        <div className="flex items-center gap-1 text-white/50 text-[10px] italic">
          <Info size={11} />
          <span>{format.typical_use}</span>
        </div>
      </div>
    </button>
  );
};

export default React.memo(FormatItem);
