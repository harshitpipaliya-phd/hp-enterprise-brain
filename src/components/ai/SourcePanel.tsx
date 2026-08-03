import React from 'react';

interface Source {
  id: string;
  type: string;
  content: string;
}

interface SourcePanelProps {
  sources: Source[];
}

export const SourcePanel: React.FC<SourcePanelProps> = ({ sources }) => {
  return (
    <div className="border-l p-4">
      <h3 className="mb-2 font-semibold">Grounding Sources</h3>
      {sources.map((source, idx) => (
        <div key={idx} className="mb-2 rounded bg-gray-50 p-2 text-sm">
          <div className="font-medium">{source.type}</div>
          <div className="text-gray-600">{source.content.slice(0, 100)}...</div>
        </div>
      ))}
    </div>
  );
};
