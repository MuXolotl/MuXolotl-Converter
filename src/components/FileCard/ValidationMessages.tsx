import React from 'react';
import type { ValidationResult } from '@/types';

interface ValidationMessagesProps {
  validation: ValidationResult | null;
}

const ValidationMessages: React.FC<ValidationMessagesProps> = ({ validation }) => {
  if (!validation) return null;

  return (
    <>
      {validation.errors.length > 0 && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded">
          <div className="text-red-400 text-xs font-semibold mb-1">⚠️ Validation Errors:</div>
          {validation.errors.map((err, idx) => (
            <div key={idx} className="text-red-300 text-xs">
              • {err}
            </div>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded">
          <div className="text-yellow-400 text-xs font-semibold mb-1">ℹ️ Warnings:</div>
          {validation.warnings.map((warn, idx) => (
            <div key={idx} className="text-yellow-300 text-xs">
              • {warn}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default React.memo(ValidationMessages);
