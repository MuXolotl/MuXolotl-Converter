import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => (
  <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-20">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className="h-full bg-gradient-primary shadow-lg shadow-primary-purple/50"
      transition={{ duration: 0.3 }}
    />
  </div>
);

export default React.memo(ProgressBar);
