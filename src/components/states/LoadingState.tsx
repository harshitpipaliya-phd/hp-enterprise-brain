import React from 'react';
import { Spinner, Skeleton } from '../../ui';

interface LoadingStateProps {
  variant?: 'skeleton' | 'spinner';
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ variant = 'skeleton', count = 3, className = '' }) => {
  if (variant === 'spinner') {
    return (
      <div className={`u-state-shell ${className}`}>
        <div className="u-state">
          <div className="u-state-icon"><Spinner size={22} /></div>
          <h3 className="u-state-title">Loading</h3>
          <p className="u-state-desc">Fetching the latest available data for this view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`u-state-shell ${className}`}>
      <div className="u-card u-card-pad u-state-card">
        <div className="u-state-card__stack" aria-hidden="true">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="u-state-card__stack">
              <Skeleton width="28%" height={12} radius={999} />
              <Skeleton width="100%" height={64} radius={16} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
