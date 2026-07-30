/**
 * KASBA Badge — a seven-state capability indicator.
 *
 * Product rule: Unknown is a real state, not a missing value. The badge must
 * render all seven states distinctly and must never silently default to a
 * midpoint. State comes from the API; the badge only translates it to colour.
 */
const STATE_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  Unknown:      { bg: 'var(--surface-inset)',      fg: 'var(--content-tertiary)',      border: 'var(--border-default)', label: 'Unknown' },
  Asserted:     { bg: 'var(--conf-none-surface)',  fg: 'var(--conf-none)',             border: 'var(--border-subtle)',   label: 'Asserted' },
  Inferred:     { bg: 'var(--priority-p3-surface)',fg: 'var(--priority-p3)',           border: 'var(--border-subtle)',   label: 'Inferred' },
  Assessed:     { bg: 'var(--conf-med-surface)',   fg: 'var(--conf-med)',              border: 'var(--border-subtle)',   label: 'Assessed' },
  Demonstrated: { bg: 'var(--conf-high-surface)',  fg: 'var(--conf-high)',             border: 'var(--border-subtle)',   label: 'Demonstrated' },
  Observed:     { bg: 'var(--action-subtle)',      fg: 'var(--action-primary)',        border: 'var(--border-subtle)',   label: 'Observed' },
  Mastered:     { bg: 'var(--feedback-success-surface)', fg: 'var(--feedback-success-solid)', border: 'var(--feedback-success-border)', label: 'Mastered' },
};

export default function KasbaBadge({ state }: { state: string }) {
  const token = STATE_STYLE[state] ?? STATE_STYLE.Unknown;

  return (
    <span
      className="rcl-kasba-badge"
      style={{
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 4,
        backgroundColor: token.bg,
        color: token.fg,
        border: `1px solid ${token.border}`,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
    >
      {token.label}
    </span>
  );
}
