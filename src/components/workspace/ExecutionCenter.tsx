import { useState, useEffect } from 'react';
import { esoApi } from '../../api/eso';
import { useTheme } from '../../hooks/useTheme';

interface EsoExecution {
  id: string;
  esoId: string;
  decisionId: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'rolled_back';
  executedBy: string;
  executorType: string;
  output: Record<string, unknown> | null;
  error: string | null;
  createdDate: string;
}

const STATUS_COLOR: Record<string, string> = { queued: '#f59e0b', running: '#3b82f6', completed: '#22c55e', failed: '#ef4444', rolled_back: '#8b5cf6' };

/**
 * Execution Center (EPIC-008). The last named workflow gap — real backend
 * (Sprint 2) had no tenant-wide list endpoint and no UI at all until this
 * pass. Status filter is real (server-side query param).
 */
export default function ExecutionCenter({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [executions, setExecutions] = useState<EsoExecution[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setExecutions(await esoApi.listAll(tenantId, statusFilter || undefined));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, statusFilter]);

  const rollback = async (id: string) => {
    setRollingBack(id);
    try {
      await esoApi.rollback(tenantId, id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Execution Center</h1>
        <button onClick={load}>Refresh</button>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['', 'queued', 'running', 'completed', 'failed', 'rolled_back'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.border}`,
              backgroundColor: statusFilter === s ? '#3b82f620' : 'transparent',
              color: statusFilter === s ? '#3b82f6' : theme.text, fontSize: 12,
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div>Loading executions...</div>
      ) : executions.length === 0 ? (
        <p style={{ color: theme.textMuted }}>
          {statusFilter ? `No executions with status "${statusFilter}".` : 'No executions yet — these appear once a Decision is approved and an ESO runs.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {executions.map((e) => (
            <div key={e.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${STATUS_COLOR[e.status]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>{e.esoId}</strong> <span style={{ fontSize: 11, color: theme.textMuted }}>via {e.executorType}</span></span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, backgroundColor: `${STATUS_COLOR[e.status]}20`, color: STATUS_COLOR[e.status] }}>{e.status}</span>
              </div>
              {e.error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{e.error}</div>}
              {e.output && <pre style={{ fontSize: 11, marginTop: 4, color: theme.textMuted, whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.output, null, 2)}</pre>}
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>{new Date(e.createdDate).toLocaleString()}</div>
              {e.status === 'completed' && (
                <button onClick={() => rollback(e.id)} disabled={rollingBack === e.id} style={{ marginTop: 8, fontSize: 11 }}>
                  {rollingBack === e.id ? 'Rolling back...' : 'Roll Back'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
