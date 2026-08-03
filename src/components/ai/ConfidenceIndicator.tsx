import React from 'react';

interface ConfidenceIndicatorProps {
  confidence: number;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({ confidence }) => {
  // Whole class names, not `bg-${color}-500`. The previous version wrote
  // "bg-{color}-500" as a literal, so the bar rendered with no colour at all;
  // and even the template-literal form would not survive Tailwind, which scans
  // source text and cannot see a class assembled at runtime.
  const barColor =
    confidence > 0.8 ? 'bg-green-500' : confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500';

  const pct = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 rounded-full bg-gray-200"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Response confidence"
      >
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-600">{pct}%</span>
    </div>
  );
};
