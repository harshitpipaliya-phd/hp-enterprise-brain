/**
 * Outcome Record — the measured result of an ESO execution.
 *
 * Product rule: an outcome without evidence is a claim, not a measurement.
 * The record lists the evidence ids that were checked and the metrics that
 * were observed, so the decision to reuse or discard it is auditable.
 */
interface Outcome {
  id: string;
  result: string;
  confidence: number | null;
  metrics: Record<string, unknown>;
  evidenceIds: string[];
  feedback: string | null;
  createdDate: string;
}

const RESULT_TOKENS: Record<string, { bg: string; fg: string }> = {
  success:  { bg: 'var(--feedback-success-surface)', fg: 'var(--feedback-success-solid)' },
  partial:  { bg: 'var(--feedback-warning-surface)', fg: 'var(--feedback-warning-solid)' },
  failure:  { bg: 'var(--feedback-error-surface)',   fg: 'var(--feedback-error-solid)' },
  pending:  { bg: 'var(--surface-inset)',            fg: 'var(--content-tertiary)' },
};

export default function OutcomeRecord({ outcome }: { outcome: Outcome }) {
  const token = RESULT_TOKENS[outcome.result] ?? RESULT_TOKENS.pending;

  return (
    <div className="rcl-outcome" style={{ border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--surface-card)', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="rcl-badge" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, backgroundColor: token.bg, color: token.fg, border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}>
          {outcome.result}
        </span>
        <span style={{ fontSize: 11, color: 'var(--content-tertiary)' }}>
          Confidence: {outcome.confidence !== null && outcome.confidence !== undefined ? `${(outcome.confidence * 100).toFixed(0)}%` : '—'}
        </span>
      </div>
      {Object.keys(outcome.metrics).length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--content-secondary)', marginBottom: 4 }}>
          {Object.entries(outcome.metrics).map(([k, v]) => (
            <span key={k} style={{ marginRight: 12 }}>{k}: {String(v)}</span>
          ))}
        </div>
      )}
      {outcome.feedback && (
        <div style={{ fontSize: 12, color: 'var(--content-tertiary)', fontStyle: 'italic' }}>{outcome.feedback}</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 6 }}>
        Evidence: {outcome.evidenceIds.length} item(s) · {outcome.createdDate?.slice(0, 10)}
      </div>
    </div>
  );
}
