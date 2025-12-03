import { memo } from 'react';
import { Settings, Film, Music, FileText } from 'lucide-react';

export type TabId = 'general' | 'video' | 'audio' | 'metadata';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasVideo: boolean;
  hasAudio: boolean;
}

const TABS: { id: TabId; label: string; shortLabel: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'Format', shortLabel: 'Fmt', icon: Settings },
  { id: 'video', label: 'Video', shortLabel: 'Vid', icon: Film },
  { id: 'audio', label: 'Audio', shortLabel: 'Aud', icon: Music },
  { id: 'metadata', label: 'Meta', shortLabel: 'Meta', icon: FileText },
];

function Tabs({ activeTab, onTabChange, hasVideo, hasAudio }: TabsProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-black/20 rounded-lg mb-3">
      {TABS.map(tab => {
        const isDisabled = (tab.id === 'video' && !hasVideo) || (tab.id === 'audio' && !hasAudio);
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded text-[10px] font-medium transition-all min-w-0 ${
              isDisabled
                ? 'opacity-30 cursor-not-allowed'
                : activeTab === tab.id
                  ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer'
            }`}
            title={tab.label}
          >
            <Icon size={12} className="shrink-0" />
            <span className="truncate">{tab.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(Tabs);