import { useState, useEffect } from 'react';
import { api } from '../../api/observability';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  source: string;
  status: string;
  createdAt: string;
}

export default function AuditDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', entityType: '', q: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filter.action) params.action = filter.action;
      if (filter.entityType) params.entityType = filter.entityType;
      if (filter.q) params.q = filter.q;
      const data = await api.getAuditLogs(params);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Audit Dashboard</h1>
        <button onClick={load}>Refresh</button>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Search..." value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} style={{ padding: 8, flex: 1 }} />
        <select value={filter.action} onChange={(e) => setFilter({ ...filter, action: e.target.value })} style={{ padding: 8 }}>
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="archive">Archive</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
        </select>
        <select value={filter.entityType} onChange={(e) => setFilter({ ...filter, entityType: e.target.value })} style={{ padding: 8 }}>
          <option value="">All Types</option>
          <option value="Organization">Organization</option>
          <option value="Department">Department</option>
          <option value="Person">Person</option>
          <option value="Capability">Capability</option>
        </select>
      </div>

      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Time</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Action</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Entity</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actor</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Source</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(log.createdAt).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{log.action}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{log.entityType}:{log.entityId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{log.actorName}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{log.source}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <span style={{ color: log.status === 'success' ? '#22c55e' : '#ef4444' }}>{log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
