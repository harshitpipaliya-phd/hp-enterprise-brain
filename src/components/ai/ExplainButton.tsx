import React from 'react';

interface ExplainButtonProps {
  messageId: string;
  onExplain: () => void;
}

export const ExplainButton: React.FC<ExplainButtonProps> = ({ onExplain }) => {
  return (
    <button onClick={onExplain} className="text-sm text-gray-600 hover:text-gray-800">
      Explain reasoning
    </button>
  );
};
