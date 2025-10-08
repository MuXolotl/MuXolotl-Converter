import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { ValidationResult } from '@/types';

interface ValidationMessagesProps {
  validation: ValidationResult | null;
}

const ValidationMessages: React.FC<ValidationMessagesProps> = ({ validation }) => {
  if (!validation) return null;

  const hasMessages = validation.errors.length > 0 || validation.warnings.length > 0;
  if (!hasMessages) return null;

  return (
    <div className="mb-2 pr-24 space-y-1">
      {validation.errors.map((err, idx) => (
        <div
          key={`err-${idx}`}
          className="flex items-start gap-1.5 px-2 py-1 bg-red-500/10 border-l-2 border-red-500 rounded text-[10px] text-red-300 leading-tight"
        >
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5 text-red-400" />
          <span>{err}</span>
        </div>
      ))}

      {validation.warnings.map((warn, idx) => (
        <div
          key={`warn-${idx}`}
          className="flex items-start gap-1.5 px-2 py-1 bg-yellow-500/10 border-l-2 border-yellow-500 rounded text-[10px] text-yellow-300 leading-tight"
        >
          <Info size={12} className="flex-shrink-0 mt-0.5 text-yellow-400" />
          <span>{warn}</span>
        </div>
      ))}
    </div>
  );
};

export default React.memo(ValidationMessages);
