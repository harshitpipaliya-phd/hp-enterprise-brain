import { useState, useEffect } from 'react';
import { api } from '../../api/events';

interface DeadLetterEntry {
  id: string;
  eventId: string;
  consumerName: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

export default function DeadLetterQueue() {
  const [entries, setEntries] = useState<DeadLetterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getDLQ();
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRetry = async (id: string) => {
    await api.retryDLQ(id);
    await load();
  };

  const handleDelete = async (id: string) => {
    await api.deleteDLQ(id);
    await load();
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Dead Letter Queue</h1>
        <button onClick={load}>Refresh</button>
      </header>

      {loading ? <div>Loading...</div> : entries.length === 0 ? (
        <p>No dead letter entries.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Event ID</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Consumer</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Error</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Retries</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Created</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.eventId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.consumerName}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', color: '#ef4444', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.errorMessage}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.retryCount}/{e.maxRetries}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <button onClick={() => handleRetry(e.id)}>Retry</button>
                  <button onClick={() => handleDelete(e.id)} style={{ marginLeft: 8, color: '#ef4444' }}>Discard</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
