import { useState, useEffect } from 'react';
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
  const [filter, setFilter] = useState({ type: '', tenantId: '', status: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter.type) params.type = filter.type;
      if (filter.tenantId) params.tenantId = filter.tenantId;
      const data = await api.listEvents(params);
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleReplay = async (id: string) => {
    await api.replayEvent(id);
    await load();
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Event Store</h1>
        <button onClick={load}>Refresh</button>
      </header>

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
                    backgroundColor: e.status === 'completed' ? '#22c55e' : e.status === 'failed' ? '#ef4444' : e.status === 'processing' ? '#3b82f6' : '#f59e0b',
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
