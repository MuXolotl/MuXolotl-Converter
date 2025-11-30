import React from 'react';
import { Layers, Settings, ExternalLink, Github } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'queue', icon: Layers, label: 'Queue' },
    // В будущем здесь появятся:
    // { id: 'merge', icon: Combine, label: 'Merge' },
    // { id: 'youtube', icon: Youtube, label: 'Download' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const openGithub = () => {
    invoke('open_folder', { path: 'https://github.com/MuXolotl/MuXolotl-Converter' });
  };

  return (
    <div className="w-16 h-full glass flex flex-col items-center py-4 gap-6 bg-black/20 border-r border-white/10 rounded-none">
      {/* Logo Area */}
      <div className="text-2xl select-none cursor-default mb-2">🦎</div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-4 w-full px-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200
              ${activeTab === tab.id 
                ? 'bg-gradient-primary text-white shadow-lg shadow-primary-purple/20' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
              }
            `}
            title={tab.label}
          >
            <tab.icon size={20} />
          </button>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-4 w-full px-2">
        <button 
          onClick={openGithub}
          className="w-full aspect-square rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
          title="GitHub Repository"
        >
          <Github size={20} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(Sidebar);