import { useState, useEffect } from 'react';
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
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Event Backbone Dashboard</h1>
        <button onClick={load}>Refresh</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Events" value={stats.total} color="#333" />
        <StatCard label="Pending" value={stats.pending} color="#f59e0b" />
        <StatCard label="Processing" value={stats.processing} color="#3b82f6" />
        <StatCard label="Completed" value={stats.completed} color="#22c55e" />
        <StatCard label="Failed" value={stats.failed} color="#ef4444" />
        <StatCard label="Dead Letter" value={stats.deadLetterCount} color="#ef4444" />
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
                  backgroundColor: cs.status === 'active' ? '#22c55e' : '#ef4444', marginRight: 8
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
      padding: 16, borderRadius: 8, backgroundColor: '#f9fafb',
      border: `1px solid ${color}20`, borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
