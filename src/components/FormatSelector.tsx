import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Info } from 'lucide-react';
import { STABILITY_ICONS, CATEGORY_LABELS } from '@/constants';
import type { AudioFormat, VideoFormat, Category } from '@/types';

interface FormatSelectorProps {
  formats: (AudioFormat | VideoFormat)[];
  selected: string;
  onChange: (format: string) => void;
  disabled?: boolean;
}

const FormatItem = React.memo<{
  format: AudioFormat | VideoFormat;
  isSelected: boolean;
  onClick: () => void;
}>(({ format, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full p-3 flex items-start gap-2.5 text-left border-b border-white/5 transition-colors ${
      isSelected ? 'bg-primary-purple/25' : 'hover:bg-primary-purple/12'
    }`}
  >
    <span className="w-5 text-center text-lg flex-shrink-0 mt-0.5">{STABILITY_ICONS[format.stability]}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white font-bold text-sm uppercase font-mono">{format.extension}</span>
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
));
FormatItem.displayName = 'FormatItem';

const FormatSelector: React.FC<FormatSelectorProps> = React.memo(
  ({ formats, selected, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
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
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }, [isOpen, updatePosition]);

    const selectedFormat = useMemo(() => formats.find(f => f.extension === selected), [formats, selected]);

    const groupedFormats = useMemo(() => {
      return formats.reduce(
        (acc, format) => {
          if (!acc[format.category]) acc[format.category] = [];
          acc[format.category].push(format);
          return acc;
        },
        {} as Record<Category, typeof formats>
      );
    }, [formats]);

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
              }}
              onClick={e => e.stopPropagation()}
            >
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