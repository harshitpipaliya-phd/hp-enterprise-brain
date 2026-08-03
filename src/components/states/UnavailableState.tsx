import React from 'react';

interface UnavailableStateProps {
  featureName?: string;
  message?: string;
}

export const UnavailableState: React.FC<UnavailableStateProps> = ({ featureName, message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 text-6xl">🚧</span>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">
        {featureName ? `${featureName} is unavailable` : 'Feature Unavailable'}
      </h3>
      {message && <p className="max-w-md text-sm text-gray-500">{message}</p>}
    </div>
  );
};
