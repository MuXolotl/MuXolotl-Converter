import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader } from 'lucide-react';

interface ConvertButtonProps {
  disabled: boolean;
  isConverting: boolean;
  onClick: () => void;
  fileCount: number;
}

const ConvertButton: React.FC<ConvertButtonProps> = React.memo(({ disabled, isConverting, onClick, fileCount }) => {
  const buttonContent = useMemo(() => {
    if (isConverting) {
      return (
        <>
          <Loader size={24} className="animate-spin" />
          <div className="text-center">
            <div className="font-bold text-lg">Converting...</div>
            <div className="text-sm opacity-80">Please wait</div>
          </div>
        </>
      );
    }
    if (fileCount === 0) {
      return (
        <>
          <Play size={24} />
          <div className="text-center">
            <div className="font-bold text-lg">Convert All</div>
            <div className="text-sm opacity-80">Add files to start</div>
          </div>
        </>
      );
    }
    return (
      <>
        <Play size={24} />
        <div className="text-center">
          <div className="font-bold text-lg">Convert All</div>
          <div className="text-sm opacity-80">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </div>
        </div>
      </>
    );
  }, [isConverting, fileCount]);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`w-full h-full py-6 rounded-xl font-bold flex flex-col items-center justify-center gap-3 transition-all duration-200
        ${disabled ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-gradient-primary text-white shadow-lg shadow-primary-purple/30 hover:shadow-primary-purple/50'}`}
    >
      {buttonContent}
    </motion.button>
  );
});

ConvertButton.displayName = 'ConvertButton';

export default ConvertButton;
