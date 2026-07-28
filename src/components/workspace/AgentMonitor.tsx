import { useState, useEffect } from 'react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { useTheme } from '../../hooks/useTheme';

interface Executor {
  id: string;
  name: string;
  executorType: 'human' | 'ai_agent' | 'software' | 'hybrid';
  capabilityTags: string[];
  trustLevel: number;
  maxConcurrent: number;
  currentWorkload: number;
  available: boolean;
  status: string;
}

const TYPE_COLOR: Record<string, string> = { human: '#22c55e', ai_agent: '#3b82f6', software: '#8b5cf6', hybrid: '#f59e0b' };

/**
 * Multi-Agent Monitor — visualization only, as explicitly scoped. This is
 * NOT the autonomous agent framework (planning/delegation/orchestration)
 * that was deliberately not built — it's a real status view over the
 * Executor registry that already exists (Sprint 3).
 */
export default function AgentMonitor({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setExecutors(await decisionIntelligenceApi.listExecutors(tenantId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  if (loading) return <div style={{ padding: 24 }}>Loading agent registry...</div>;
  if (error) return <div style={{ padding: 24, color: '#ef4444' }}>Error: {error}</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1>Multi-Agent Monitor</h1>
        <button onClick={load}>Refresh</button>
      </header>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Status view over the Executor registry — human, AI agent, software, and hybrid executors this tenant has registered. Not an autonomous agent orchestration layer.
      </p>

      {executors.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No executors registered yet. Register one via <code>POST /executors</code>.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {executors.map((e) => (
            <div key={e.id} style={{ padding: 16, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${TYPE_COLOR[e.executorType]}`, backgroundColor: theme.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{e.name}</div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: TYPE_COLOR[e.executorType] }}>{e.executorType.replace('_', ' ')}</div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 11,
                  backgroundColor: e.available ? '#22c55e20' : '#66666620', color: e.available ? '#22c55e' : theme.textMuted,
                }}>
                  {e.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: theme.textMuted }}>
                Workload: {e.currentWorkload}/{e.maxConcurrent}
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (e.currentWorkload / e.maxConcurrent) * 100)}%`, height: '100%', backgroundColor: e.currentWorkload >= e.maxConcurrent ? '#ef4444' : '#3b82f6' }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: theme.textMuted }}>Trust level: {Math.round(e.trustLevel * 100)}%</div>
              {e.capabilityTags.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {e.capabilityTags.map((tag) => (
                    <span key={tag} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: theme.border }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
