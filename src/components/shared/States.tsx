export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eb-skeleton" style={{ height: 14, width: '40%' }} />
      <div className="eb-skeleton" style={{ height: 60, width: '100%' }} />
      <div style={{ fontSize: 12, color: 'var(--content-secondary)' }}>{label}</div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 16,
        margin: 24,
        borderRadius: 10,
        background: 'var(--feedback-error-surface)',
        color: 'var(--feedback-error-content)',
        fontSize: 13,
      }}
    >
      Error: {message}
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
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--content-secondary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <p style={{ marginBottom: actionLabel ? 16 : 0 }}>{message}</p>
      {actionLabel && onAction && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
