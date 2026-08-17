import React from 'react';
import { Clock3 } from 'lucide-react';
import { Button, EmptyState } from '../../ui';

interface StaleDataStateProps {
  onRefresh: () => void;
  lastUpdated?: string;
}

export const StaleDataState: React.FC<StaleDataStateProps> = ({ onRefresh, lastUpdated }) => {
  return (
    <div className="u-state-shell">
      <EmptyState
        title="Data may be outdated"
        description={lastUpdated ? `Last updated: ${lastUpdated}` : 'Refresh to retrieve the latest available data.'}
        icon={<Clock3 size={22} aria-hidden="true" />}
        action={(
          <Button variant="secondary" onClick={onRefresh}>
            Refresh
          </Button>
        )}
      />
    </div>
  );
};
