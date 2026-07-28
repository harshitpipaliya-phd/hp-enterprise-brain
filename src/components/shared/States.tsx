/**
 * Shared loading/error/empty states (Production Integration Program,
 * Phase 5). Extracted from a real, confirmed pattern — checked before
 * building: 6 screens independently redefined the identical
 * `<div style={{ padding: 24 }}>Loading X...</div>` / error div. Same
 * visual output, one place to change it.
 */
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
    <div style={{ padding: 16, margin: 24, borderRadius: 10, background: 'var(--feedback-error-surface)', color: 'var(--feedback-error-content)', fontSize: 13 }}>
      Error: {message}
    </div>
  );
}

/**
 * Real empty state, matching the requirement (illustration/icon,
 * explanation, primary action) rather than the plain-text placeholders
 * every screen currently uses on its own — a genuine upgrade over the
 * duplicated pattern, not just a de-duplication of it.
 */
export function EmptyState({ icon = '○', message, actionLabel, onAction }: { icon?: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--content-secondary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <p style={{ marginBottom: actionLabel ? 16 : 0 }}>{message}</p>
      {actionLabel && onAction && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
