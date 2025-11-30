import React from 'react';
import { Layers, MessageSquarePlus, Github } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';

interface SidebarProps {
  onFeedbackClick: () => void;
}

const GITHUB_URL = 'https://github.com/MuXolotl/MuXolotl-Converter';

const Sidebar: React.FC<SidebarProps> = ({ onFeedbackClick }) => {
  const openGithub = () => {
    invoke('open_folder', { path: GITHUB_URL }).catch(console.error);
  };

  return (
    <div className="w-14 h-full flex flex-col items-center py-4 bg-black/30 border-r border-white/10">
      {/* Logo */}
      <div className="text-2xl select-none mb-6">🦎</div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-2 w-full px-2">
        <NavButton icon={Layers} active title="Queue" />
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-2 w-full px-2">
        <NavButton 
          icon={MessageSquarePlus} 
          onClick={onFeedbackClick} 
          title="Send Feedback" 
          highlight
        />
        <NavButton icon={Github} onClick={openGithub} title="GitHub" />
      </div>
    </div>
  );
};

interface NavButtonProps {
  icon: React.FC<{ size?: number }>;
  active?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  title: string;
}

const NavButton: React.FC<NavButtonProps> = ({ icon: Icon, active, highlight, onClick, title }) => (
  <button
    onClick={onClick}
    className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
      active
        ? 'bg-gradient-primary text-white shadow-lg shadow-purple-500/20'
        : highlight
          ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
          : 'text-white/40 hover:text-white hover:bg-white/5'
    }`}
    title={title}
  >
    <Icon size={20} />
  </button>
);

export default React.memo(Sidebar);