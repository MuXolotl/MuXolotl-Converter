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
    <div className="w-12 h-full flex flex-col items-center py-3 bg-[#0f172a] border-r border-white/5 select-none z-20">
      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-3 w-full">
        <NavButton icon={Layers} active title="Queue" />
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-3 w-full pb-2">
        <NavButton 
          icon={MessageSquarePlus} 
          onClick={onFeedbackClick} 
          title="Send Feedback" 
        />
        <NavButton icon={Github} onClick={openGithub} title="GitHub" />
      </div>
    </div>
  );
};

interface NavButtonProps {
  icon: React.FC<{ size?: number }>;
  active?: boolean;
  onClick?: () => void;
  title: string;
}

const NavButton: React.FC<NavButtonProps> = ({ icon: Icon, active, onClick, title }) => (
  <button
    onClick={onClick}
    className={`relative w-full h-10 flex items-center justify-center transition-all group
      ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}
    `}
    title={title}
  >
    {/* Active Indicator Line */}
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
    )}
    
    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
  </button>
);

export default React.memo(Sidebar);