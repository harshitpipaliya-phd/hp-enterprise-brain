import { useState, useEffect } from 'react';
import { api } from '../../api/observability';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: string; responseTime?: number; details?: Record<string, unknown> }>;
  timestamp: string;
}

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const interval = setInterval(load, 30000); return () => clearInterval(interval); }, []);

  if (loading) return <div>Loading health status...</div>;
  if (!health) return <div style={{ color: 'red' }}>Unable to fetch health status</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>System Health</h1>
        <button onClick={load}>Refresh</button>
      </header>

      <div style={{ padding: 16, borderRadius: 8, backgroundColor: health.status === 'healthy' ? '#dcfce7' : health.status === 'degraded' ? '#fef3c7' : '#fee2e2', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{health.status.toUpperCase()}</h2>
        <p style={{ margin: 4, fontSize: 12, color: '#666' }}>Last checked: {new Date(health.timestamp).toLocaleString()}</p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {Object.entries(health.checks).map(([name, check]) => (
          <div key={name} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{name}</h3>
              <p style={{ margin: 4, fontSize: 12, color: '#666' }}>
                {String(check.details?.message ?? check.details?.error ?? 'No details')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 'bold',
                backgroundColor: check.status === 'healthy' ? '#dcfce7' : check.status === 'degraded' ? '#fef3c7' : '#fee2e2',
                color: check.status === 'healthy' ? '#166534' : check.status === 'degraded' ? '#92400e' : '#991b1b',
              }}>
                {check.status}
              </span>
              {check.responseTime && <p style={{ margin: 4, fontSize: 12, color: '#666' }}>{check.responseTime}ms</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
