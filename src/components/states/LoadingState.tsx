import React from 'react';

interface LoadingStateProps {
  variant?: 'skeleton' | 'spinner';
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ variant = 'skeleton', count = 3, className = '' }) => {
  if (variant === 'spinner') {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-gray-200 p-4">
          <div className="mb-2 h-4 w-3/4 rounded bg-gray-300" />
          <div className="h-3 w-1/2 rounded bg-gray-300" />
        </div>
      ))}
    </div>
  );
};
