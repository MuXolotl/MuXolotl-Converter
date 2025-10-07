import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader } from 'lucide-react';

interface ConvertButtonProps {
  disabled: boolean;
  isConverting: boolean;
  onClick: () => void;
  fileCount: number;
}

const ConvertButton: React.FC<ConvertButtonProps> = ({ disabled, isConverting, onClick, fileCount }) => {
  const content = useMemo(() => {
    if (isConverting) {
      return { icon: Loader, title: 'Converting...', subtitle: 'Please wait', iconClass: 'animate-spin' };
    }
    if (fileCount === 0) {
      return { icon: Play, title: 'Convert All', subtitle: 'Add files to start', iconClass: '' };
    }
    return {
      icon: Play,
      title: 'Convert All',
      subtitle: `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`,
      iconClass: '',
    };
  }, [isConverting, fileCount]);

  const Icon = content.icon;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`w-full h-full py-6 rounded-xl font-bold flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
        disabled
          ? 'bg-white/10 text-white/40 cursor-not-allowed'
          : 'bg-gradient-primary text-white shadow-lg shadow-primary-purple/30 hover:shadow-primary-purple/50'
      }`}
    >
      <Icon size={24} className={content.iconClass} />
      <div className="text-center">
        <div className="font-bold text-lg">{content.title}</div>
        <div className="text-sm opacity-80">{content.subtitle}</div>
      </div>
    </motion.button>
  );
};

export default React.memo(ConvertButton);
