import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Info, Filter, Zap, AlertTriangle, Wrench, Flame } from 'lucide-react';
import { STABILITY_ICONS, CATEGORY_LABELS } from '@/constants';
import type { AudioFormat, VideoFormat, Category, RecommendedFormats } from '@/types';

interface FormatSelectorProps {
  formats: (AudioFormat | VideoFormat)[];
  selected: string;
  onChange: (format: string) => void;
  disabled?: boolean;
  recommendedFormats?: RecommendedFormats;
}

const getBadgeInfo = (
  format: AudioFormat | VideoFormat,
  recommended?: RecommendedFormats
): { label: string; icon: React.ReactNode; className: string } | null => {
  if (!recommended) return null;

  if (recommended.fast.includes(format.extension)) {
    return {
      label: 'FAST',
      icon: <Zap size={10} />,
      className: 'bg-green-500/30 text-green-300 border border-green-500/50',
    };
  }

  if (recommended.safe.includes(format.extension)) {
    return {
      label: 'SAFE',
      icon: <Check size={10} />,
      className: 'bg-blue-500/30 text-blue-300 border border-blue-500/50',
    };
  }

  if (recommended.setup.includes(format.extension)) {
    return {
      label: 'SETUP',
      icon: <Wrench size={10} />,
      className: 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50',
    };
  }

  if (recommended.experimental.includes(format.extension)) {
    return {
      label: 'BETA',
      icon: <Flame size={10} />,
      className: 'bg-orange-500/30 text-orange-300 border border-orange-500/50',
    };
  }

  if (recommended.problematic.includes(format.extension)) {
    return {
      label: 'RISK',
      icon: <AlertTriangle size={10} />,
      className: 'bg-red-500/30 text-red-300 border border-red-500/50',
    };
  }

  return null;
};

const FormatItem = React.memo<{
  format: AudioFormat | VideoFormat;
  isSelected: boolean;
  recommended?: RecommendedFormats;
  onClick: () => void;
}>(({ format, isSelected, recommended, onClick }) => {
  const badge = getBadgeInfo(format, recommended);

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-start gap-2.5 text-left border-b border-white/5 transition-colors ${
        isSelected
          ? 'bg-primary-purple/25'
          : badge?.label === 'FAST'
            ? 'bg-green-500/5 hover:bg-green-500/10'
            : badge?.label === 'SAFE'
              ? 'hover:bg-blue-500/5'
              : 'hover:bg-primary-purple/12'
      }`}
    >
      <span className="w-5 text-center text-lg flex-shrink-0 mt-0.5">{STABILITY_ICONS[format.stability]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-white font-bold text-sm uppercase font-mono">{format.extension}</span>
          {badge && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 ${badge.className}`}>
              {badge.icon}
              {badge.label}
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
});
FormatItem.displayName = 'FormatItem';

const FormatSelector: React.FC<FormatSelectorProps> = React.memo(
  ({ formats, selected, onChange, disabled = false, recommendedFormats }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showAllFormats, setShowAllFormats] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const updatePosition = useCallback(() => {
      if (!buttonRef.current) return;

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const dropdownWidth = Math.max(rect.width, 320);
        const spaceBelow = viewportHeight - rect.bottom - 10;
        const spaceAbove = rect.top - 10;

        let maxHeight = 450;
        let top = rect.bottom + 4;

        if (spaceBelow < 300 && spaceAbove > spaceBelow) {
          maxHeight = Math.min(spaceAbove, 450);
          top = rect.top - maxHeight - 4;
        } else {
          maxHeight = Math.min(spaceBelow, 450);
        }

        let left = rect.left;
        if (left + dropdownWidth > viewportWidth - 10) left = viewportWidth - dropdownWidth - 10;
        if (left < 10) left = 10;

        setPosition({ top, left, width: dropdownWidth, maxHeight });
      }, 16);
    }, []);

    useEffect(() => {
      if (isOpen) updatePosition();
    }, [isOpen, updatePosition]);

    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
          buttonRef.current &&
          !buttonRef.current.contains(target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setIsOpen(false);
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('resize', updatePosition, { passive: true });
      window.addEventListener('scroll', updatePosition, { passive: true, capture: true });

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);

        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = undefined;
        }
      };
    }, [isOpen, updatePosition]);

    const selectedFormat = useMemo(() => formats.find(f => f.extension === selected), [formats, selected]);

    const hasRecommended = recommendedFormats && (
      recommendedFormats.fast.length > 0 ||
      recommendedFormats.safe.length > 0 ||
      recommendedFormats.setup.length > 0
    );

    const filteredFormats = useMemo(() => {
      if (!hasRecommended || showAllFormats) {
        return formats;
      }

      return formats.filter(f => {
        if (!recommendedFormats) return true;
        
        return (
          recommendedFormats.fast.includes(f.extension) ||
          recommendedFormats.safe.includes(f.extension) ||
          recommendedFormats.setup.includes(f.extension)
        );
      });
    }, [formats, recommendedFormats, showAllFormats, hasRecommended]);

    const hiddenCount = formats.length - filteredFormats.length;

    const groupedFormats = useMemo(() => {
      return filteredFormats.reduce(
        (acc, format) => {
          if (!acc[format.category]) acc[format.category] = [];
          acc[format.category].push(format);
          return acc;
        },
        {} as Record<Category, typeof filteredFormats>
      );
    }, [filteredFormats]);

    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled) setIsOpen(!isOpen);
      },
      [disabled, isOpen]
    );

    const handleSelect = useCallback(
      (format: string) => {
        onChange(format);
        setIsOpen(false);
      },
      [onChange]
    );

    const selectedBadge = getBadgeInfo(selectedFormat!, recommendedFormats);

    return (
      <>
        <button
          ref={buttonRef}
          onClick={handleToggle}
          disabled={disabled}
          className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors flex items-center justify-between text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <span className="w-4 text-center flex-shrink-0">
              {STABILITY_ICONS[selectedFormat?.stability || 'stable']}
            </span>
            <span className="uppercase font-mono">{selectedFormat?.extension || selected}</span>
            {selectedBadge && (
              <span className={`text-[8px] px-1 py-0.5 rounded font-semibold flex items-center gap-0.5 ${selectedBadge.className}`}>
                {selectedBadge.icon}
                {selectedBadge.label}
              </span>
            )}
          </div>
          <ChevronDown
            size={14}
            className={`text-white/60 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={dropdownRef}
              className={`fixed z-[999999] ${isOpen ? 'flex' : 'hidden'} flex-col`}
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                border: '2px solid rgba(139, 92, 246, 0.5)',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(139, 92, 246, 0.4)',
                overflow: 'hidden',
                willChange: 'transform',
              }}
              onClick={e => e.stopPropagation()}
            >
              {hasRecommended && (
                <div className="flex-shrink-0 p-2.5 border-b border-white/10 bg-gradient-to-r from-slate-700 to-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={showAllFormats}
                      onChange={e => setShowAllFormats(e.target.checked)}
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
                  {!showAllFormats && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
                      {recommendedFormats?.fast && recommendedFormats.fast.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded flex items-center gap-1">
                          <Zap size={8} />
                          {recommendedFormats.fast.length} fast
                        </span>
                      )}
                      {recommendedFormats?.safe && recommendedFormats.safe.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded flex items-center gap-1">
                          <Check size={8} />
                          {recommendedFormats.safe.length} safe
                        </span>
                      )}
                      {recommendedFormats?.setup && recommendedFormats.setup.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded flex items-center gap-1">
                          <Wrench size={8} />
                          {recommendedFormats.setup.length} setup
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto overflow-x-hidden" data-dropdown-scroll>
                {Object.entries(groupedFormats).map(([category, categoryFormats]) => (
                  <div key={category}>
                    <div className="sticky top-0 z-10 px-3.5 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 border-b border-primary-purple/40 shadow-md">
                      <span className="text-white font-bold text-xs uppercase tracking-wide">
                        {CATEGORY_LABELS[category as Category]}
                      </span>
                    </div>
                    {categoryFormats.map(format => (
                      <FormatItem
                        key={format.extension}
                        format={format}
                        isSelected={format.extension === selected}
                        recommended={recommendedFormats}
                        onClick={() => handleSelect(format.extension)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }
);

FormatSelector.displayName = 'FormatSelector';

export default FormatSelector;