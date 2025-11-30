import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Minus, Square, X, Maximize2 } from 'lucide-react';

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(true);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await invoke<boolean>('window_is_maximized');
        setIsMaximized(maximized);
      } catch (e) {
        console.error('Failed to check window state:', e);
      }
    };

    checkMaximized();

    // Check periodically for external changes
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      await invoke('window_minimize');
    } catch (e) {
      console.error('Minimize failed:', e);
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      await invoke('window_maximize');
      setIsMaximized(!isMaximized);
    } catch (e) {
      console.error('Maximize failed:', e);
    }
  }, [isMaximized]);

  const handleClose = useCallback(async () => {
    try {
      await invoke('window_close');
    } catch (e) {
      console.error('Close failed:', e);
    }
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="h-9 bg-black/40 flex items-center justify-between px-3 select-none shrink-0"
    >
      {/* Left: Logo & Title */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span className="text-lg">🦎</span>
        <span className="text-sm font-semibold text-white/80">MuXolotl-Converter</span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center -mr-1">
        <WindowButton onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </WindowButton>
        
        <WindowButton onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}
        </WindowButton>
        
        <WindowButton onClick={handleClose} title="Close" variant="close">
          <X size={14} />
        </WindowButton>
      </div>
    </div>
  );
};

interface WindowButtonProps {
  onClick: () => void;
  title: string;
  variant?: 'default' | 'close';
  children: React.ReactNode;
}

const WindowButton: React.FC<WindowButtonProps> = ({
  onClick,
  title,
  variant = 'default',
  children,
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-10 h-9 flex items-center justify-center transition-colors ${
      variant === 'close'
        ? 'hover:bg-red-500 text-white/60 hover:text-white'
        : 'hover:bg-white/10 text-white/60 hover:text-white'
    }`}
  >
    {children}
  </button>
);

export default React.memo(TitleBar);