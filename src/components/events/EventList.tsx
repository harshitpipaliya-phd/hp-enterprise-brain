import { useState, useEffect } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { HeaderActions, PageHeader } from '../../ui';
import { api } from '../../api/events';

interface Event {
  id: string;
  type: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ type: '', tenantId: '', status: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filter.type) params.type = filter.type;
      if (filter.tenantId) params.tenantId = filter.tenantId;
      if (filter.status) params.status = filter.status;
      const data = await api.listEvents(params);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      // Was `catch { setEvents([]) }`, which rendered "no events" for a 404 on
      // an unregistered route — indistinguishable from an empty event store.
      setError(e.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter.type, filter.tenantId, filter.status]);

  const handleReplay = async (id: string) => {
    setError(null);
    try {
      await api.replayEvent(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <PageHeader
        variant="list"
        icon={<Database />}
        title="Event Store"
        description="Every event this installation has published, with its type, entity and delivery status."
        actions={(
          <HeaderActions>
            <button type="button" className="u-btn u-btn-secondary" onClick={load}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
          </HeaderActions>
        )}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Event type..." value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} style={{ padding: 8, flex: 1 }} />
        <input placeholder="Tenant ID..." value={filter.tenantId} onChange={(e) => setFilter({ ...filter, tenantId: e.target.value })} style={{ padding: 8, flex: 1 }} />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} style={{ padding: 8 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error && <div style={{ color: 'var(--status-crit)', marginBottom: 16 }}>Error: {error}</div>}

      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Type</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Entity</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Tenant</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Created</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.type}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.entityType}:{e.entityId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.tenantId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: e.status === 'completed' ? 'var(--status-good)' : e.status === 'failed' ? 'var(--status-crit)' : e.status === 'processing' ? 'var(--chart-1)' : 'var(--status-warn)',
                    marginRight: 8
                  }} />
                  {e.status}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <button onClick={() => handleReplay(e.id)}>Replay</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
