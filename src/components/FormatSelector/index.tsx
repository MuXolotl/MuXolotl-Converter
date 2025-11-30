import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Filter } from 'lucide-react';
import { STABILITY_CONFIG, CATEGORY_LABELS } from '@/constants';
import type { AudioFormat, VideoFormat, RecommendedFormats, Category } from '@/types';

interface FormatSelectorProps {
  formats: (AudioFormat | VideoFormat)[];
  selected: string;
  onChange: (format: string) => void;
  disabled?: boolean;
  recommendedFormats?: RecommendedFormats;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({
  formats,
  selected,
  onChange,
  disabled = false,
  recommendedFormats,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter formats based on recommendations
  const { visibleFormats, hiddenCount } = useMemo(() => {
    if (!recommendedFormats || showAll) {
      return { visibleFormats: formats, hiddenCount: 0 };
    }

    const recommended = new Set([
      ...recommendedFormats.fast,
      ...recommendedFormats.safe,
      ...recommendedFormats.setup,
    ]);

    const visible = formats.filter(f => recommended.has(f.extension));
    return {
      visibleFormats: visible.length > 0 ? visible : formats,
      hiddenCount: formats.length - visible.length,
    };
  }, [formats, recommendedFormats, showAll]);

  // Group by category
  const groupedFormats = useMemo(() => {
    const groups: Record<string, (AudioFormat | VideoFormat)[]> = {};
    
    for (const format of visibleFormats) {
      const cat = format.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(format);
    }
    
    return groups;
  }, [visibleFormats]);

  // Selected format info
  const selectedFormat = useMemo(
    () => formats.find(f => f.extension === selected),
    [formats, selected]
  );

  // Position calculation
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 400;
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const openUpward = spaceBelow < 200;

    setPosition({
      top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: Math.max(10, Math.min(rect.left, window.innerWidth - 330)),
      width: 320,
    });
  }, []);

  // Open/close handling
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          !buttonRef.current?.contains(target) &&
          !dropdownRef.current?.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  const handleSelect = useCallback((ext: string) => {
    onChange(ext);
    setIsOpen(false);
  }, [onChange]);

  const getBadge = useCallback((ext: string): { label: string; className: string } | null => {
    if (!recommendedFormats) return null;
    
    if (recommendedFormats.fast.includes(ext)) {
      return { label: 'FAST', className: 'bg-green-500/20 text-green-400' };
    }
    if (recommendedFormats.safe.includes(ext)) {
      return { label: 'SAFE', className: 'bg-blue-500/20 text-blue-400' };
    }
    if (recommendedFormats.setup.includes(ext)) {
      return { label: 'SETUP', className: 'bg-yellow-500/20 text-yellow-400' };
    }
    if (recommendedFormats.experimental.includes(ext)) {
      return { label: 'BETA', className: 'bg-orange-500/20 text-orange-400' };
    }
    if (recommendedFormats.problematic.includes(ext)) {
      return { label: 'RISKY', className: 'bg-red-500/20 text-red-400' };
    }
    return null;
  }, [recommendedFormats]);

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded flex items-center justify-between text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">
            {STABILITY_CONFIG[selectedFormat?.stability || 'stable'].icon}
          </span>
          <span className="font-mono uppercase">{selected}</span>
          {selectedFormat && getBadge(selected) && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${getBadge(selected)!.className}`}>
              {getBadge(selected)!.label}
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-slate-800 border border-purple-500/50 rounded-xl shadow-2xl overflow-hidden"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: 400,
          }}
        >
          {/* Filter Toggle */}
          {hiddenCount > 0 && (
            <div className="p-2 border-b border-white/10 bg-slate-700/50">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={e => setShowAll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 checked:bg-purple-500"
                />
                <Filter size={12} className="text-white/50" />
                <span className="text-white/70">
                  Show all formats (+{hiddenCount} hidden)
                </span>
              </label>
            </div>
          )}

          {/* Format List */}
          <div className="overflow-y-auto max-h-[340px]">
            {Object.entries(groupedFormats).map(([category, categoryFormats]) => (
              <div key={category}>
                <div className="sticky top-0 px-3 py-1.5 bg-slate-700 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  {CATEGORY_LABELS[category as Category]}
                </div>
                
                {categoryFormats.map(format => {
                  const badge = getBadge(format.extension);
                  const isSelected = format.extension === selected;
                  
                  return (
                    <button
                      key={format.extension}
                      onClick={() => handleSelect(format.extension)}
                      className={`w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-purple-500/10 transition-colors ${
                        isSelected ? 'bg-purple-500/20' : ''
                      }`}
                    >
                      <span className="text-sm mt-0.5">
                        {STABILITY_CONFIG[format.stability].icon}
                      </span>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-white uppercase">
                            {format.extension}
                          </span>
                          {badge && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${badge.className}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 mt-0.5 truncate">
                          {format.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default React.memo(FormatSelector);