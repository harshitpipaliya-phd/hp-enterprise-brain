import React from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title = 'Something went wrong', message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 text-6xl">⚠️</span>
      <h3 className="mb-2 text-lg font-semibold text-red-600">{title}</h3>
      {message && <p className="mb-4 max-w-md text-sm text-gray-500">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Try Again
        </button>
      )}
    </div>
  );
};
