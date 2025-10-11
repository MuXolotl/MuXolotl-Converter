import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { STABILITY_ICONS, CATEGORY_LABELS } from '@/constants';
import FormatItem from './FormatItem';
import FilterPanel from './FilterPanel';
import { getBadgeInfo, groupFormatsByCategory, calculateDropdownPosition } from './utils';
import type { AudioFormat, VideoFormat, Category, RecommendedFormats } from '@/types';

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
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current || !isMountedRef.current) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    updateTimeoutRef.current = setTimeout(() => {
      if (!buttonRef.current || !isMountedRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = Math.max(rect.width, 320);
      const pos = calculateDropdownPosition(rect, dropdownWidth, 450);
      setPosition(pos);
    }, 16);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          updatePosition();
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && isMountedRef.current) {
      updatePosition();
    }
  }, [formats, recommendedFormats, isOpen, updatePosition]);

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
    };
  }, [isOpen, updatePosition]);

  const selectedFormat = useMemo(() => formats.find(f => f.extension === selected), [formats, selected]);

  const hasRecommended = useMemo(
    () =>
      recommendedFormats &&
      (recommendedFormats.fast.length > 0 || recommendedFormats.safe.length > 0 || recommendedFormats.setup.length > 0),
    [recommendedFormats]
  );

  const filteredFormats = useMemo(() => {
    if (!hasRecommended || showAllFormats) return formats;

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
  const groupedFormats = useMemo(() => groupFormatsByCategory(filteredFormats), [filteredFormats]);

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

  const selectedBadge = selectedFormat ? getBadgeInfo(selectedFormat, recommendedFormats) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={disabled}
        className="w-full h-8 px-2 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors flex items-center justify-between text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-3 text-center flex-shrink-0 text-sm">
            {STABILITY_ICONS[selectedFormat?.stability || 'stable']}
          </span>
          <span className="uppercase font-mono truncate text-[11px]">{selectedFormat?.extension || selected}</span>
          {selectedBadge && (
            <span
              className={`text-[7px] px-1 py-0.5 rounded font-semibold flex items-center gap-0.5 flex-shrink-0 ${selectedBadge.className}`}
            >
              {selectedBadge.icon} {selectedBadge.label}
            </span>
          )}
        </div>
        <ChevronDown
          size={12}
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
              <FilterPanel
                showAllFormats={showAllFormats}
                hiddenCount={hiddenCount}
                recommendedFormats={recommendedFormats}
                onToggle={setShowAllFormats}
              />
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
};

export default React.memo(FormatSelector);