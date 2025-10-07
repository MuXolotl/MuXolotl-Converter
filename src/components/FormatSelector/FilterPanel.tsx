import React from 'react';
import { Filter, AlertTriangle, Zap, Check, Wrench } from 'lucide-react';
import type { RecommendedFormats } from '@/types';

interface FilterPanelProps {
  showAllFormats: boolean;
  hiddenCount: number;
  recommendedFormats?: RecommendedFormats;
  onToggle: (show: boolean) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  showAllFormats,
  hiddenCount,
  recommendedFormats,
  onToggle,
}) => (
  <div className="flex-shrink-0 p-2.5 border-b border-white/10 bg-gradient-to-r from-slate-700 to-slate-800">
    <label className="flex items-center gap-2 cursor-pointer text-xs">
      <input
        type="checkbox"
        checked={showAllFormats}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 checked:bg-primary-purple cursor-pointer"
      />
      <Filter size={12} className="text-white/60" />
      <span className="text-white/80 font-medium">
        Show risky formats {hiddenCount > 0 && `(+${hiddenCount} hidden)`}
      </span>
    </label>

    {!showAllFormats && hiddenCount > 0 && (
      <div className="mt-1.5 text-[10px] text-white/50 flex items-start gap-1">
        <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
        <span>
          Hiding {hiddenCount} experimental/problematic format{hiddenCount !== 1 ? 's' : ''}
        </span>
      </div>
    )}

    {!showAllFormats && recommendedFormats && (
      <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
        {recommendedFormats.fast.length > 0 && (
          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded flex items-center gap-1">
            <Zap size={8} />
            {recommendedFormats.fast.length} fast
          </span>
        )}
        {recommendedFormats.safe.length > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded flex items-center gap-1">
            <Check size={8} />
            {recommendedFormats.safe.length} safe
          </span>
        )}
        {recommendedFormats.setup.length > 0 && (
          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded flex items-center gap-1">
            <Wrench size={8} />
            {recommendedFormats.setup.length} setup
          </span>
        )}
      </div>
    )}
  </div>
);

export default React.memo(FilterPanel);