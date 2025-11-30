import React, { useMemo } from 'react';

const AudioWaveform: React.FC = () => {
  // Generate random but consistent waveform bars
  const bars = useMemo(() => {
    const count = 40;
    const result: number[] = [];
    
    // Create a smooth wave pattern
    for (let i = 0; i < count; i++) {
      const position = i / count;
      // Create multiple overlapping sine waves for natural look
      const wave1 = Math.sin(position * Math.PI * 4) * 0.3;
      const wave2 = Math.sin(position * Math.PI * 7 + 1) * 0.25;
      const wave3 = Math.sin(position * Math.PI * 11 + 2) * 0.2;
      const noise = (Math.random() - 0.5) * 0.15;
      
      const height = 0.3 + Math.abs(wave1 + wave2 + wave3 + noise);
      result.push(Math.min(1, Math.max(0.1, height)));
    }
    
    return result;
  }, []);

  return (
    <div className="flex items-center justify-center gap-[2px] h-16 px-8">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full opacity-60"
          style={{
            height: `${height * 100}%`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default React.memo(AudioWaveform);