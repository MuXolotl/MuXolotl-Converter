import React, { useState, useCallback, useRef, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftWidth: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  initialLeftWidth,
  minLeftWidth = 300,
  maxLeftWidth = 800,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, e.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Left Panel */}
      <div style={{ width: leftWidth }} className="h-full shrink-0 overflow-hidden">
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 h-full cursor-col-resize flex-shrink-0 transition-colors ${
          isDragging ? 'bg-purple-500' : 'bg-white/10 hover:bg-purple-500/50'
        }`}
      />

      {/* Right Panel */}
      <div className="flex-1 h-full min-w-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
};

export default SplitPane;