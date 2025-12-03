import { memo } from 'react';
import { Layers, MessageSquarePlus, Github } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { APP_CONFIG } from '@/config';

interface SidebarProps {
  onFeedbackClick: () => void;
}

function Sidebar({ onFeedbackClick }: SidebarProps) {
  const openGithub = () => {
    invoke('open_folder', { path: APP_CONFIG.github.repo }).catch(() => {});
  };

  return (
    <div className="w-12 h-full flex flex-col items-center py-3 bg-[#0f172a] border-r border-white/5 select-none z-20">
      <div className="flex-1 flex flex-col gap-3 w-full">
        <NavButton icon={Layers} active title="Queue" />
      </div>
      <div className="flex flex-col gap-3 w-full pb-2">
        <NavButton icon={MessageSquarePlus} onClick={onFeedbackClick} title="Send Feedback" />
        <NavButton icon={Github} onClick={openGithub} title="GitHub" />
      </div>
    </div>
  );
}

interface NavButtonProps {
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
  title: string;
}

function NavButton({ icon: Icon, active, onClick, title }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full h-10 flex items-center justify-center transition-all group ${
        active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
      }`}
      title={title}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
      )}
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    </button>
  );
}

export default memo(Sidebar);