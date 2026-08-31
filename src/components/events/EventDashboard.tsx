import { useState, useEffect } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { HeaderActions, PageHeader } from '../../ui';
import { api } from '../../api/events';

export interface EventStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetterCount: number;
  consumers: string[];
  consumerStates: Array<{ consumerName: string; status: string; lastProcessedAt: string | null }>;
}

export default function EventDashboard() {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div>Loading event dashboard...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!stats) return <div>No data</div>;

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <PageHeader
        variant="list"
        icon={<Radio />}
        title="Event Backbone"
        description="Throughput across the event backbone: what is queued, in flight, and settled."
        actions={(
          <HeaderActions>
            <button type="button" className="u-btn u-btn-secondary" onClick={load}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
          </HeaderActions>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Events" value={stats.total} color="#333" />
        <StatCard label="Pending" value={stats.pending} color="var(--status-warn)" />
        <StatCard label="Processing" value={stats.processing} color="var(--chart-1)" />
        <StatCard label="Completed" value={stats.completed} color="var(--status-good)" />
        <StatCard label="Failed" value={stats.failed} color="var(--status-crit)" />
        <StatCard label="Dead Letter" value={stats.deadLetterCount} color="var(--status-crit)" />
      </div>

      <h2 style={{ marginBottom: 16 }}>Consumers</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Consumer</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Last Processed</th>
          </tr>
        </thead>
        <tbody>
          {stats.consumerStates.map((cs) => (
            <tr key={cs.consumerName}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{cs.consumerName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: cs.status === 'active' ? 'var(--status-good)' : 'var(--status-crit)', marginRight: 8
                }} />
                {cs.status}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                {cs.lastProcessedAt ? new Date(cs.lastProcessedAt).toLocaleString() : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 8, backgroundColor: 'var(--surface-inset)',
      border: `1px solid ${color}20`, borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
