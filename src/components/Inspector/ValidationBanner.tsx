import React from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import type { ValidationResult } from '@/types';

interface ValidationBannerProps {
  validation: ValidationResult;
}

const ValidationBanner: React.FC<ValidationBannerProps> = ({ validation }) => {
  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  if (!hasErrors && !hasWarnings) return null;

  return (
    <div className={`p-3 rounded-lg space-y-1.5 ${
      hasErrors ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
    }`}>
      {validation.errors.map((error, i) => (
        <div key={`e-${i}`} className="flex items-start gap-2 text-xs text-red-400">
          <XCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ))}
      
      {validation.warnings.map((warning, i) => (
        <div key={`w-${i}`} className="flex items-start gap-2 text-xs text-yellow-400">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      ))}

      {validation.alternative_codec && (
        <div className="flex items-start gap-2 text-xs text-blue-400 mt-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>Suggested codec: {validation.alternative_codec}</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(ValidationBanner);