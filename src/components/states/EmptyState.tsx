import React from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState as UiEmptyState } from '../../ui';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'inbox', title, description, action }) => {
  return (
    <div className="u-state-shell">
      <UiEmptyState
        title={title}
        description={description}
        action={action}
        icon={icon === 'inbox' ? <Inbox size={22} aria-hidden="true" /> : <span aria-hidden="true">{icon}</span>}
      />
    </div>
  );
};
