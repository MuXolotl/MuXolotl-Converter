import type { AudioFormat, VideoFormat, RecommendedFormats } from '@/types';

export interface BadgeInfo {
  label: string;
  icon: React.ReactNode;
  className: string;
}

export const getBadgeInfo = (format: AudioFormat | VideoFormat, recommended?: RecommendedFormats): BadgeInfo | null => {
  if (!recommended) return null;

  const badges = [
    {
      condition: recommended.fast.includes(format.extension),
      label: 'FAST',
      className: 'bg-green-500/30 text-green-300 border border-green-500/50',
      iconName: 'Zap',
    },
    {
      condition: recommended.safe.includes(format.extension),
      label: 'SAFE',
      className: 'bg-blue-500/30 text-blue-300 border border-blue-500/50',
      iconName: 'Check',
    },
    {
      condition: recommended.setup.includes(format.extension),
      label: 'SETUP',
      className: 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50',
      iconName: 'Wrench',
    },
    {
      condition: recommended.experimental.includes(format.extension),
      label: 'BETA',
      className: 'bg-orange-500/30 text-orange-300 border border-orange-500/50',
      iconName: 'Flame',
    },
    {
      condition: recommended.problematic.includes(format.extension),
      label: 'RISK',
      className: 'bg-red-500/30 text-red-300 border border-red-500/50',
      iconName: 'AlertTriangle',
    },
  ];

  const badge = badges.find((b) => b.condition);
  if (!badge) return null;

  const icons = {
    Zap: '⚡',
    Check: '✓',
    Wrench: '🔧',
    Flame: '🔥',
    AlertTriangle: '⚠️',
  };

  return {
    label: badge.label,
    icon: icons[badge.iconName as keyof typeof icons],
    className: badge.className,
  };
};

export const groupFormatsByCategory = <T extends { category: string }>(formats: T[]) => {
  return formats.reduce(
    (acc, format) => {
      if (!acc[format.category]) acc[format.category] = [];
      acc[format.category].push(format);
      return acc;
    },
    {} as Record<string, T[]>
  );
};

export const calculateDropdownPosition = (buttonRect: DOMRect, dropdownWidth: number, maxHeight: number) => {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const spaceBelow = viewportHeight - buttonRect.bottom - 10;
  const spaceAbove = buttonRect.top - 10;

  let height = maxHeight;
  let top = buttonRect.bottom + 4;

  if (spaceBelow < 300 && spaceAbove > spaceBelow) {
    height = Math.min(spaceAbove, maxHeight);
    top = buttonRect.top - height - 4;
  } else {
    height = Math.min(spaceBelow, maxHeight);
  }

  let left = buttonRect.left;
  if (left + dropdownWidth > viewportWidth - 10) {
    left = viewportWidth - dropdownWidth - 10;
  }
  if (left < 10) left = 10;

  return { top, left, width: dropdownWidth, maxHeight: height };
};
