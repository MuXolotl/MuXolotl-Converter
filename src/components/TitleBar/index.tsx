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
        console.error(e);
      }
    };
    checkMaximized();
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = useCallback(() => invoke('window_minimize').catch(console.error), []);
  const handleMaximize = useCallback(async () => {
    try {
      await invoke('window_maximize');
      setIsMaximized(!isMaximized);
    } catch (e) { console.error(e); }
  }, [isMaximized]);
  const handleClose = useCallback(() => invoke('window_close').catch(console.error), []);

  return (
    <div data-tauri-drag-region className="relative h-9 bg-[#0f172a] flex items-center justify-between px-2 select-none shrink-0 border-b border-white/5">
      
      {/* Icon (Left) */}
      <div className="flex items-center w-20 pl-2">
        <span className="text-lg">🦎</span>
      </div>

      {/* Title (Center Absolute) */}
      <div 
        data-tauri-drag-region 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium tracking-widest text-slate-400 uppercase opacity-80"
      >
        MuXolotl Converter
      </div>

      {/* Controls (Right) */}
      <div className="flex items-center h-full">
        <WindowButton onClick={handleMinimize} title="Minimize"><Minus size={14} /></WindowButton>
        <WindowButton onClick={handleMaximize} title="Maximize">{isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}</WindowButton>
        <WindowButton onClick={handleClose} title="Close" variant="close"><X size={14} /></WindowButton>
      </div>
    </div>
  );
};

const WindowButton: React.FC<{ onClick: () => void; title: string; variant?: 'default' | 'close'; children: React.ReactNode }> = ({ onClick, title, variant = 'default', children }) => (
  <button onClick={onClick} title={title} className={`h-full aspect-square flex items-center justify-center transition-colors ${variant === 'close' ? 'hover:bg-red-600 text-slate-400 hover:text-white' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}>{children}</button>
);

export default React.memo(TitleBar);