import { useState, useEffect } from 'react';
import { api } from '../../api/signal';

export interface Signal {
  id: string;
  tenantId: string;
  orgId: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: 'new' | 'triaged' | 'evidenced' | 'resolved' | 'dismissed';
  metadata: Record<string, unknown>;
  createdDate: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export default function SignalDashboard({ tenantId }: { tenantId: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? { status: statusFilter } : undefined;
      const data = await api.listSignals(tenantId, params);
      setSignals(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, statusFilter]);

  const advance = async (signal: Signal, status: Signal['status']) => {
    await api.changeStatus(tenantId, signal.id, status);
    load();
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Signal Intelligence</h1>
        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ marginRight: 8, padding: 6 }}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="evidenced">Evidenced</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button onClick={load}>Refresh</button>
        </div>
      </header>

      {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div>Loading signals...</div>
      ) : signals.length === 0 ? (
        <div style={{ color: '#666' }}>No signals detected yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Source</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Severity</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Confidence</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Related To</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Detected</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.source}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12,
                    backgroundColor: `${SEVERITY_COLOR[s.severity]}20`, color: SEVERITY_COLOR[s.severity],
                  }}>
                    {s.severity}
                  </span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{Math.round(s.confidence * 100)}%</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {s.relatedEntityType ? `${s.relatedEntityType}:${s.relatedEntityId}` : '—'}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.status}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(s.createdDate).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {s.status === 'new' && (
                    <button onClick={() => advance(s, 'triaged')}>Triage</button>
                  )}
                  {s.status !== 'dismissed' && s.status !== 'resolved' && (
                    <button onClick={() => advance(s, 'dismissed')} style={{ marginLeft: 4 }}>Dismiss</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
