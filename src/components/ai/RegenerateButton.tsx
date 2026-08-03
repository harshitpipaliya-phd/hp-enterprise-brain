import React from 'react';

interface RegenerateButtonProps {
  messageId: string;
  onRegenerate: () => void;
}

export const RegenerateButton: React.FC<RegenerateButtonProps> = ({ onRegenerate }) => {
  return (
    <button onClick={onRegenerate} className="text-sm text-blue-600 hover:text-blue-800">
      Regenerate
    </button>
  );
};
