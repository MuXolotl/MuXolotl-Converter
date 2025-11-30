import React, { useState, useCallback, useRef, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftWidth: number; // pixel width
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
}

const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  initialLeftWidth,
  minLeftWidth = 200,
  maxLeftWidth = 600,
  className = '',
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
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      if (newWidth >= minLeftWidth && newWidth <= maxLeftWidth) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

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
    <div ref={containerRef} className={`flex h-full w-full overflow-hidden ${className}`}>
      <div style={{ width: leftWidth }} className="h-full flex-shrink-0 overflow-hidden flex flex-col relative">
        {left}
        {/* Drag Handle Overlay - makes grabbing easier */}
        <div className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 z-50 cursor-col-resize group"
             onMouseDown={handleMouseDown}>
             {/* Visual Line */}
             <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/10 group-hover:bg-primary-purple/50 transition-colors" />
        </div>
      </div>
      
      <div className="flex-1 h-full min-w-0 overflow-hidden relative">
        {right}
      </div>
    </div>
  );
};

export default SplitPane;