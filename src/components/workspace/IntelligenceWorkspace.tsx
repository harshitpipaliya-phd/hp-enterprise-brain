import { useState, useEffect } from 'react';
import { api } from '../../api/intelligence';
import { useTheme, type Theme } from '../../hooks/useTheme';

interface WorkspaceData {
  tenantId: string;
  counts: { signals: number; recommendations: number; decisions: number; outcomes: number; learnings: number };
  pendingRecommendations: Array<{
    id: string; title: string; category: string; confidence: number; priority: string; status: string;
  }>;
  recentSignals: Array<{ id: string; source: string; severity: string; status: string; createdDate: string }>;
  recentDecisions: Array<{ id: string; executorType: string; rationale: string; createdDate: string }>;
  recentOutcomes: Array<{ id: string; result: string; confidence: number; createdDate: string }>;
  reusableLearnings: Array<{ id: string; pattern: string; confidence: number }>;
}

const CATEGORY_COLOR: Record<string, string> = {
  risk: '#ef4444',
  opportunity: '#3b82f6',
  watch: '#f59e0b',
  compliance: '#8b5cf6',
};

export default function IntelligenceWorkspace({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getWorkspace(tenantId);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const approve = async (recommendationId: string) => {
    setApproving(recommendationId);
    try {
      await api.approveRecommendation(tenantId, recommendationId, 'Approved from Intelligence Workspace');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApproving(null);
    }
  };

  if (loading) return <div>Loading Enterprise Intelligence Workspace...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Enterprise Intelligence Workspace</h1>
        <button onClick={load}>Refresh</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Stat label="Signals" value={data.counts.signals} theme={theme} />
        <Stat label="Recommendations" value={data.counts.recommendations} theme={theme} />
        <Stat label="Decisions" value={data.counts.decisions} theme={theme} />
        <Stat label="Outcomes" value={data.counts.outcomes} theme={theme} />
        <Stat label="Learnings" value={data.counts.learnings} theme={theme} />
      </div>

      <h2 style={{ marginBottom: 12 }}>Pending Recommendations — Approve / Reject</h2>
      {data.pendingRecommendations.length === 0 ? (
        <p style={{ color: '#666' }}>No recommendations awaiting a decision.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
          {data.pendingRecommendations.map((r) => (
            <div key={r.id} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, borderLeft: `4px solid ${CATEGORY_COLOR[r.category] ?? '#666'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', color: CATEGORY_COLOR[r.category] ?? '#666', fontWeight: 'bold' }}>{r.category}</span>
                  <h3 style={{ margin: '4px 0' }}>{r.title}</h3>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    Priority: {r.priority} · Confidence: {Math.round(r.confidence * 100)}%
                  </span>
                </div>
                <button onClick={() => approve(r.id)} disabled={approving === r.id}>
                  {approving === r.id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Recent Signals</h3>
          <ul style={{ paddingLeft: 16 }}>
            {data.recentSignals.map((s) => (
              <li key={s.id}>{s.source} · {s.severity} · {s.status}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Recent Decisions</h3>
          <ul style={{ paddingLeft: 16 }}>
            {data.recentDecisions.map((d) => (
              <li key={d.id}>{d.executorType} — {d.rationale.slice(0, 60)}...</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Recent Outcomes</h3>
          <ul style={{ paddingLeft: 16 }}>
            {data.recentOutcomes.map((o) => (
              <li key={o.id}>{o.result} · {Math.round(o.confidence * 100)}% confidence</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Reusable Learnings</h3>
          <ul style={{ paddingLeft: 16 }}>
            {data.reusableLearnings.map((l) => (
              <li key={l.id}>{l.pattern}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: number; theme: Theme }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{value}</div>
    </div>
  );
}
