import { useState, useEffect } from 'react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { useTheme, type Theme } from '../../hooks/useTheme';

interface Analytics {
  decisions: { total: number; approved: number; rejected: number; acceptanceRate: number };
  recommendations: { total: number; byCategory: Record<string, number> };
  outcomes: { total: number; successful: number; recommendationAccuracy: number };
  risks: { total: number; open: number; byCategory: Record<string, number>; averageScore: number };
  evidenceQuality: number;
}

interface Risk {
  id: string;
  category: string;
  probability: number;
  impact: string;
  score: number;
  status: string;
  mitigation: string | null;
}

const IMPACT_COLOR: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };

export default function DecisionAnalyticsPanel({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, r] = await Promise.all([
        decisionIntelligenceApi.getAnalytics(tenantId),
        decisionIntelligenceApi.listRisks(tenantId),
      ]);
      setAnalytics(a);
      setRisks(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  if (loading) return <div>Loading decision analytics...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!analytics) return <div>No data</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Decision Analytics</h1>
        <button onClick={load}>Refresh</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Stat label="Acceptance Rate" value={`${Math.round(analytics.decisions.acceptanceRate * 100)}%`} theme={theme} />
        <Stat label="Recommendation Accuracy" value={`${Math.round(analytics.outcomes.recommendationAccuracy * 100)}%`} theme={theme} />
        <Stat label="Evidence Quality" value={`${Math.round(analytics.evidenceQuality * 100)}%`} theme={theme} />
        <Stat label="Open Risks" value={String(analytics.risks.open)} theme={theme} />
        <Stat label="Avg Risk Score" value={String(analytics.risks.averageScore)} theme={theme} />
      </div>

      <h2 style={{ marginBottom: 12 }}>Risk Cards</h2>
      {risks.length === 0 ? (
        <p style={{ color: '#666' }}>No risks assessed yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {risks.map((r) => (
            <div key={r.id} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, borderLeft: `4px solid ${IMPACT_COLOR[r.impact] ?? '#666'}` }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: IMPACT_COLOR[r.impact] ?? '#666', fontWeight: 'bold' }}>{r.category}</div>
              <div style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0' }}>Score: {r.score}</div>
              <div style={{ fontSize: 12, color: '#666' }}>Impact: {r.impact} · Probability: {Math.round(r.probability * 100)}%</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>{r.status === 'mitigated' ? `Mitigated: ${r.mitigation}` : 'Status: open'}</div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 32, marginBottom: 12 }}>Recommendations by Category</h2>
      <ul style={{ paddingLeft: 16 }}>
        {Object.entries(analytics.recommendations.byCategory).map(([cat, count]) => (
          <li key={cat}>{cat}: {count}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{value}</div>
    </div>
  );
}
