import { Inbox, LoaderCircle } from 'lucide-react';
import { Button, Card, ErrorState as UiErrorState, EmptyState as UiEmptyState, Skeleton } from '../../ui';
import './states.css';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="u-state-shell" role="status" aria-live="polite">
      <Card className="u-state-card">
        <div className="u-state-card__eyebrow">
          <LoaderCircle size={14} aria-hidden="true" className="u-state-card__spin" />
          Loading workspace
        </div>
        <div className="u-state-card__stack" aria-hidden="true">
          <Skeleton width="34%" height={12} radius={999} />
          <Skeleton width="100%" height={78} radius={18} />
          <div className="u-state-card__grid">
            <Skeleton width="100%" height={88} radius={16} />
            <Skeleton width="100%" height={88} radius={16} />
            <Skeleton width="100%" height={88} radius={16} />
          </div>
        </div>
        <p className="u-state-card__label">{label}</p>
      </Card>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = 'We couldn’t load this view',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="u-state-shell">
      <UiErrorState message={message} onRetry={onRetry} />
      {!onRetry && (
        <p className="u-state-shell__hint">
          Try refreshing the page or returning to the previous screen.
        </p>
      )}
      {title !== 'We couldn’t load this view' && (
        <p className="u-state-shell__hint">{title}</p>
      )}
    </div>
  );
}

export function EmptyState({
  icon = 'O',
  message,
  actionLabel,
  onAction,
}: {
  icon?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="u-state-shell">
      <UiEmptyState
        title="Nothing to show yet"
        description={message}
        icon={
          <span className="u-state-shell__glyph" aria-hidden="true">
            {icon === '○' || icon === 'O' ? <Inbox size={22} /> : icon}
          </span>
        }
        action={actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined}
      />
    </div>
  );
}
