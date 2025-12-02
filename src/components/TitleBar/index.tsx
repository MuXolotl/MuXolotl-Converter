import { memo, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { APP_CONFIG } from '@/config';

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(true);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await invoke<boolean>('window_is_maximized');
        setIsMaximized(maximized);
      } catch {
        // Ignore errors
      }
    };
    checkMaximized();
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = useCallback(() => invoke('window_minimize').catch(() => {}), []);

  const handleMaximize = useCallback(async () => {
    try {
      await invoke('window_maximize');
      setIsMaximized(prev => !prev);
    } catch {
      // Ignore errors
    }
  }, []);

  const handleClose = useCallback(() => invoke('window_close').catch(() => {}), []);

  return (
    <div
      data-tauri-drag-region
      className="relative h-9 bg-[#0f172a] flex items-center justify-between px-2 select-none shrink-0 border-b border-white/5"
    >
      <div className="flex items-center w-20 pl-2">
        <span className="text-lg">🦎</span>
      </div>

      <div
        data-tauri-drag-region
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium tracking-widest text-slate-400 uppercase opacity-80"
      >
        {APP_CONFIG.name}
      </div>

      <div className="flex items-center h-full">
        <WindowButton onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </WindowButton>
        <WindowButton onClick={handleMaximize} title="Maximize">
          {isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}
        </WindowButton>
        <WindowButton onClick={handleClose} title="Close" variant="close">
          <X size={14} />
        </WindowButton>
      </div>
    </div>
  );
}

interface WindowButtonProps {
  onClick: () => void;
  title: string;
  variant?: 'default' | 'close';
  children: React.ReactNode;
}

function WindowButton({ onClick, title, variant = 'default', children }: WindowButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-full aspect-square flex items-center justify-center transition-colors ${
        variant === 'close'
          ? 'hover:bg-red-600 text-slate-400 hover:text-white'
          : 'hover:bg-white/5 text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export default memo(TitleBar);