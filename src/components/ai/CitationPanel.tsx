import React from 'react';

interface Citation {
  id: string;
  type: string;
}

interface CitationPanelProps {
  citations: Citation[];
}

export const CitationPanel: React.FC<CitationPanelProps> = ({ citations }) => {
  return (
    <div className="border-t p-4">
      <h3 className="mb-2 font-semibold">Citations</h3>
      {citations.map((citation, idx) => (
        <div key={idx} className="mb-1 text-sm text-blue-600">
          [{idx + 1}] {citation.type}: {citation.id}
        </div>
      ))}
    </div>
  );
};
