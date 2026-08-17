import React from 'react';
import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui';

interface UnavailableStateProps {
  featureName?: string;
  message?: string;
}

export const UnavailableState: React.FC<UnavailableStateProps> = ({ featureName, message }) => {
  return (
    <div className="u-state-shell">
      <EmptyState
        title={featureName ? `${featureName} is unavailable` : 'Feature unavailable'}
        description={message || 'This area is not available right now.'}
        icon={<Construction size={22} aria-hidden="true" />}
      />
    </div>
  );
};
