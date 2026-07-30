/**
 * Confidence Indicator — honest display of how firmly a claim is held.
 *
 * Product rule: an unknown confidence renders as unknown, never as a default
 * midpoint. A null or undefined value is not the same as 0% — it means the
 * system has no measurement at all, and the indicator must say so.
 */
interface ConfidenceIndicatorProps {
  confidence: number | null | undefined;
  label?: string;
}

const CONFIDENCE_TOKENS: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  unknown:   { bg: 'var(--surface-inset)',      fg: 'var(--content-tertiary)',      border: 'var(--border-default)', label: 'Unknown' },
  low:       { bg: 'var(--conf-low-surface)',   fg: 'var(--conf-low)',              border: 'var(--border-subtle)',   label: 'Low' },
  medium:    { bg: 'var(--conf-med-surface)',   fg: 'var(--conf-med)',              border: 'var(--border-subtle)',   label: 'Medium' },
  high:      { bg: 'var(--conf-high-surface)',  fg: 'var(--conf-high)',             border: 'var(--border-subtle)',   label: 'High' },
  verified:  { bg: 'var(--conf-verified-surface)', fg: 'var(--conf-verified)',     border: 'var(--border-subtle)',   label: 'Verified' },
};

export default function ConfidenceIndicator({ confidence, label }: ConfidenceIndicatorProps) {
  if (confidence === null || confidence === undefined) {
    const token = CONFIDENCE_TOKENS.unknown;
    return (
      <span className="rcl-confidence" title="No confidence measurement available" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: token.bg, color: token.fg, border: `1px solid ${token.border}` }}>
        {label && <span style={{ color: 'var(--content-tertiary)' }}>{label}</span>}
        {token.label}
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(1, confidence));
  let band: string;
  if (clamped < 0.3) band = 'low';
  else if (clamped < 0.6) band = 'medium';
  else if (clamped < 0.85) band = 'high';
  else band = 'verified';

  const token = CONFIDENCE_TOKENS[band];

  return (
    <span className="rcl-confidence" title={`Confidence: ${(clamped * 100).toFixed(0)}%`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: token.bg, color: token.fg, border: `1px solid ${token.border}` }}>
      {label && <span style={{ color: 'var(--content-tertiary)' }}>{label}</span>}
      {(clamped * 100).toFixed(0)}%
    </span>
  );
}
