import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { PermissionState } from './PermissionState';
import { StaleDataState } from './StaleDataState';
import { UnavailableState } from './UnavailableState';

type StateType = 'loading' | 'empty' | 'error' | 'permission' | 'stale' | 'unavailable' | 'ready';

interface StateRendererProps {
  state: StateType;
  loadingProps?: React.ComponentProps<typeof LoadingState>;
  emptyProps?: React.ComponentProps<typeof EmptyState>;
  errorProps?: React.ComponentProps<typeof ErrorState> & { onRetry?: () => void };
  permissionProps?: React.ComponentProps<typeof PermissionState>;
  staleProps?: React.ComponentProps<typeof StaleDataState>;
  unavailableProps?: React.ComponentProps<typeof UnavailableState>;
  children?: React.ReactNode;
}

export const StateRenderer: React.FC<StateRendererProps> = ({
  state,
  loadingProps,
  emptyProps,
  errorProps,
  permissionProps,
  staleProps,
  unavailableProps,
  children,
}) => {
  switch (state) {
    case 'loading':
      return <LoadingState {...loadingProps} />;
    case 'empty':
      // EmptyState requires a title and StaleDataState requires onRefresh, but
      // both prop bags are optional here — a caller can select the state
      // without supplying them. Defaults are applied at the spread rather than
      // made optional on the state components themselves: an empty state with
      // no message, or a stale banner whose Refresh button does nothing, is a
      // dead end for the user, so the fallback has to say something true.
      return <EmptyState title="Nothing to show" {...emptyProps} />;
    case 'error':
      return <ErrorState {...errorProps} />;
    case 'permission':
      return <PermissionState {...permissionProps} />;
    case 'stale':
      return <StaleDataState onRefresh={() => window.location.reload()} {...staleProps} />;
    case 'unavailable':
      return <UnavailableState {...unavailableProps} />;
    default:
      return <>{children}</>;
  }
};
