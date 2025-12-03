import { memo, useState, useCallback, useRef, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  minLeftWidth?: number;
  minRightWidth?: number;
  defaultLeftRatio?: number;
}

function SplitPane({
  left,
  right,
  minLeftWidth = 400,
  minRightWidth = 300,
  defaultLeftRatio = 0.65,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; width: number } | null>(null);

  // Calculate initial and constrained width
  const getConstrainedWidth = useCallback((desiredWidth: number, containerWidth: number) => {
    const maxLeftWidth = containerWidth - minRightWidth;
    return Math.max(minLeftWidth, Math.min(maxLeftWidth, desiredWidth));
  }, [minLeftWidth, minRightWidth]);

  // Initialize and handle resize
  useEffect(() => {
    const updateWidth = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      
      setLeftWidth(prev => {
        if (prev === null) {
          // Initial calculation
          return getConstrainedWidth(containerWidth * defaultLeftRatio, containerWidth);
        }
        // Constrain existing width to new bounds
        return getConstrainedWidth(prev, containerWidth);
      });
    };

    updateWidth();
    
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [defaultLeftRatio, getConstrainedWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (leftWidth !== null) {
      dragStartRef.current = { x: e.clientX, width: leftWidth };
      setIsDragging(true);
    }
  }, [leftWidth]);

  useEffect(() => {
    if (!isDragging || !dragStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !dragStartRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const delta = e.clientX - dragStartRef.current.x;
      const newWidth = getConstrainedWidth(dragStartRef.current.width + delta, containerWidth);
      
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
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
  }, [isDragging, getConstrainedWidth]);

  // Don't render until we have a calculated width
  if (leftWidth === null) {
    return <div ref={containerRef} className="flex h-full w-full" />;
  }

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div 
        style={{ width: leftWidth, flexShrink: 0 }} 
        className="h-full overflow-hidden"
      >
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={`w-1 h-full cursor-col-resize flex-shrink-0 transition-colors hover:bg-purple-500/50 active:bg-purple-500 ${
          isDragging ? 'bg-purple-500' : 'bg-white/10'
        }`}
      />

      <div className="flex-1 h-full min-w-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
}

export default memo(SplitPane);