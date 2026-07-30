/**
 * Hypothesis Row — a single hypothesis under a case.
 *
 * Product rule: confidence without a root-cause family is a guess. The row
 * always shows both, and the confidence badge colour follows the protected
 * scale (none/low/med/high/verified), not a raw number.
 */
interface Hypothesis {
  id: string;
  statement: string;
  rootCauseFamily: string;
  confidence: number | null;
}

const CONFIDENCE_TOKENS: Record<string, { bg: string; fg: string; label: string }> = {
  low:      { bg: 'var(--conf-low-surface)',      fg: 'var(--conf-low)',      label: 'Low' },
  medium:   { bg: 'var(--conf-med-surface)',      fg: 'var(--conf-med)',      label: 'Medium' },
  high:     { bg: 'var(--conf-high-surface)',     fg: 'var(--conf-high)',     label: 'High' },
  verified: { bg: 'var(--conf-verified-surface)', fg: 'var(--conf-verified)', label: 'Verified' },
};

function confidenceToken(c: number | null): { bg: string; fg: string; label: string } {
  if (c === null || c === undefined) return CONFIDENCE_TOKENS.low;
  if (c < 0.3) return CONFIDENCE_TOKENS.low;
  if (c < 0.6) return CONFIDENCE_TOKENS.medium;
  if (c < 0.85) return CONFIDENCE_TOKENS.high;
  return CONFIDENCE_TOKENS.verified;
}

export default function HypothesisRow({ hypothesis }: { hypothesis: Hypothesis }) {
  const token = confidenceToken(hypothesis.confidence);

  return (
    <div className="rcl-hypothesis" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--content-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hypothesis.statement}</div>
        <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 2 }}>{hypothesis.rootCauseFamily}</div>
      </div>
      <span className="rcl-badge" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, backgroundColor: token.bg, color: token.fg, border: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
        {token.label}
      </span>
    </div>
  );
}
