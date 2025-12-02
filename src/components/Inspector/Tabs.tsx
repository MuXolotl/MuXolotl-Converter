import { memo } from 'react';
import { Settings, Film, Music, FileText } from 'lucide-react';

export type TabId = 'general' | 'video' | 'audio' | 'metadata';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasVideo: boolean;
  hasAudio: boolean;
}

const TABS: { id: TabId; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'Format', icon: Settings },
  { id: 'video', label: 'Video', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'metadata', label: 'Meta', icon: FileText },
];

function Tabs({ activeTab, onTabChange, hasVideo, hasAudio }: TabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-black/20 rounded-lg mb-4">
      {TABS.map(tab => {
        const isDisabled = (tab.id === 'video' && !hasVideo) || (tab.id === 'audio' && !hasAudio);
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all ${
              isDisabled
                ? 'opacity-30 cursor-not-allowed'
                : activeTab === tab.id
                  ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer'
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default memo(Tabs);