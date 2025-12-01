import React from 'react';
import { Settings, Film, Music, FileText } from 'lucide-react';

export type TabId = 'general' | 'video' | 'audio' | 'metadata';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasVideo: boolean;
  hasAudio: boolean;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange, hasVideo, hasAudio }) => {
  const tabs = [
    { id: 'general', label: 'Format', icon: Settings, disabled: false },
    { id: 'video', label: 'Video', icon: Film, disabled: !hasVideo },
    { id: 'audio', label: 'Audio', icon: Music, disabled: !hasAudio },
    { id: 'metadata', label: 'Meta', icon: FileText, disabled: false },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-1 bg-black/20 rounded-lg mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          disabled={tab.disabled}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all
            ${tab.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
            ${activeTab === tab.id 
              ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-900/20' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          <tab.icon size={14} />
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default React.memo(Tabs);