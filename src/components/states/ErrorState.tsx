import React from 'react';
import { Button, ErrorState as UiErrorState } from '../../ui';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title = 'Something went wrong', message, onRetry }) => {
  return (
    <div className="u-state-shell">
      <UiErrorState title={title} message={message} onRetry={onRetry} />
      {!onRetry && message && (
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Refresh page
        </Button>
      )}
    </div>
  );
};
