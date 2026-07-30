/**
 * Recommendation Block — a proposed action bound to an ESO.
 *
 * Product rule: a recommendation without an ESO binding is not actionable.
 * The block surfaces category, confidence, and the bound ESO id (when present)
 * so the reader can see at a glance whether this is a watch or an intervene.
 */
interface Recommendation {
  id: string;
  title: string;
  category: 'watch' | 'investigate' | 'intervene';
  confidence: number | null;
  esoId: string | null;
}

const CATEGORY_TOKENS: Record<string, { bg: string; fg: string }> = {
  watch:       { bg: 'var(--surface-inset)',   fg: 'var(--content-tertiary)' },
  investigate: { bg: 'var(--conf-med-surface)',fg: 'var(--conf-med)' },
  intervene:   { bg: 'var(--conf-high-surface)', fg: 'var(--conf-high)' },
};

export default function RecommendationBlock({ recommendation }: { recommendation: Recommendation }) {
  const token = CATEGORY_TOKENS[recommendation.category] ?? CATEGORY_TOKENS.watch;

  return (
    <div className="rcl-recommendation" style={{ border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--surface-card)', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <strong style={{ color: 'var(--content-primary)', fontSize: 13 }}>{recommendation.title}</strong>
        <span className="rcl-badge" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, backgroundColor: token.bg, color: token.fg, border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}>
          {recommendation.category}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--content-tertiary)', flexWrap: 'wrap' }}>
        <span>Confidence: {recommendation.confidence !== null && recommendation.confidence !== undefined ? `${(recommendation.confidence * 100).toFixed(0)}%` : '—'}</span>
        {recommendation.esoId && <span>ESO: {recommendation.esoId.slice(0, 8)}</span>}
      </div>
    </div>
  );
}
