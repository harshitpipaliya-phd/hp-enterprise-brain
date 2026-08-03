import React from 'react';

interface StaleDataStateProps {
  onRefresh: () => void;
  lastUpdated?: string;
}

export const StaleDataState: React.FC<StaleDataStateProps> = ({ onRefresh, lastUpdated }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 text-6xl">🕐</span>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">Data may be outdated</h3>
      {lastUpdated && <p className="mb-4 max-w-md text-sm text-gray-500">Last updated: {lastUpdated}</p>}
      <button onClick={onRefresh} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Refresh
      </button>
    </div>
  );
};
