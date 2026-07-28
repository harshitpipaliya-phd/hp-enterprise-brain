import { useState, useEffect } from 'react';
import { mentalModelApi } from '../../api/policy';
import { useTheme } from '../../hooks/useTheme';

interface MentalModel {
  id: string;
  domain: string;
  confidence: number;
  reinforcementCount: number;
  version: number;
  status: string;
  rules: { patterns?: string[] };
  updatedDate: string;
}

/**
 * Mental Model browser. The Executive Dashboard already shows a summary
 * table; this is the detail view — full pattern lists per domain.
 */
export default function MentalModelBrowser({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [models, setModels] = useState<MentalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    mentalModelApi.list(tenantId)
      .then(setModels)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div style={{ padding: 24 }}>Loading organizational knowledge...</div>;
  if (error) return <div style={{ padding: 24, color: '#ef4444' }}>Error: {error}</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 8 }}>Organizational Knowledge (Mental Models)</h1>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        What the organization has learned, per domain — reinforced every time a reusable Learning succeeds in that area. Confidence blends existing × 0.7 + new × 0.3 on each reinforcement.
      </p>

      {models.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No Mental Models yet — these appear automatically once a Learning with <code>reusable: true</code> is captured for a domain.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {models.map((m) => (
            <div key={m.id} style={{ padding: 16, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 15 }}>{m.domain}</strong>
                <span style={{ fontSize: 11, color: theme.textMuted }}>v{m.version} · {m.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>
                <span>Confidence: <strong style={{ color: theme.text }}>{Math.round(m.confidence * 100)}%</strong></span>
                <span>Reinforced: <strong style={{ color: theme.text }}>{m.reinforcementCount}×</strong></span>
              </div>
              {(m.rules?.patterns?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>Patterns:</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                    {m.rules.patterns!.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
