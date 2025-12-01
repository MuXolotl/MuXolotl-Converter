import React, { useMemo } from 'react';

const AudioWaveform: React.FC = () => {
  // Random bars but consistent for component lifecycle
  const bars = useMemo(() => {
    const count = 16;
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      // Create a nice sine-like wave
      const val = Math.sin(i * 0.5) * 0.5 + 0.5; // Base shape
      const noise = Math.random() * 0.3; // Add randomness
      result.push(Math.max(0.2, Math.min(1, val + noise)));
    }
    return result;
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center gap-[3px] px-2 overflow-hidden">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full opacity-80"
          style={{
            height: `${height * 70}%`, 
            animation: `wave 1.2s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0% { transform: scaleY(0.6); opacity: 0.6; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default React.memo(AudioWaveform);