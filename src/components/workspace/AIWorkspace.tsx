import { useState, useEffect } from 'react';
import { aiApi } from '../../api/ai';
import { useTheme } from '../../hooks/useTheme';

interface AIExecution {
  id: string;
  serviceName: string;
  provider: string;
  model: string | null;
  status: 'success' | 'failed' | 'not_configured';
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  error: string | null;
  createdDate: string;
}
interface ProviderStatus { name: string; available: boolean }

const STATUS_COLOR: Record<string, string> = { success: '#22c55e', failed: '#ef4444', not_configured: '#f59e0b' };

/**
 * AI Workspace. Real, previously zero UI despite both endpoints existing.
 * Not built: prompt editor, model/temperature selectors, cost estimation —
 * those need either a live provider or pricing data not in this schema.
 */
export default function AIWorkspace({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [executions, setExecutions] = useState<AIExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerData, executionData] = await Promise.all([aiApi.providers(), aiApi.executions(tenantId)]);
      setProviders(providerData.providers);
      setActiveProvider(providerData.active);
      setExecutions(executionData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const successCount = executions.filter((e) => e.status === 'success').length;
  const totalLatency = executions.filter((e) => e.latencyMs != null).reduce((s, e) => s + (e.latencyMs ?? 0), 0);
  const avgLatency = executions.length ? Math.round(totalLatency / executions.length) : 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1>AI Workspace</h1>
        <button onClick={load}>Refresh</button>
      </header>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Active provider: <strong style={{ color: theme.text }}>{activeProvider}</strong>. Switch via the AI_PROVIDER environment variable.
      </p>

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

      <h3>Provider Status</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 24 }}>
        {providers.map((p) => (
          <div key={p.name} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${p.available ? '#22c55e' : theme.border}` }}>
            <div style={{ fontWeight: 'bold', fontSize: 13 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: p.available ? '#22c55e' : theme.textMuted }}>{p.available ? 'Configured' : 'Not configured'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Stat theme={theme} label="Total Executions" value={String(executions.length)} />
        <Stat theme={theme} label="Successful" value={String(successCount)} />
        <Stat theme={theme} label="Avg Latency" value={`${avgLatency}ms`} />
      </div>

      <h3>Execution History</h3>
      {loading ? (
        <div>Loading...</div>
      ) : executions.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No AI executions yet — try "Summarize" on the Evidence Workspace.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {executions.map((e) => (
            <div key={e.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${STATUS_COLOR[e.status]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span><strong>{e.serviceName}</strong> <span style={{ color: theme.textMuted }}>via {e.provider}{e.model ? ` (${e.model})` : ''}</span></span>
                <span style={{ fontSize: 11, color: STATUS_COLOR[e.status] }}>{e.status}</span>
              </div>
              {e.error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{e.error}</div>}
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>
                {e.inputTokens != null && `${e.inputTokens + (e.outputTokens ?? 0)} tokens · `}{e.latencyMs != null && `${e.latencyMs}ms · `}{new Date(e.createdDate).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{value}</div>
    </div>
  );
}
