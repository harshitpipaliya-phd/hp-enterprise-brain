import { useState, useEffect } from 'react';
import { api } from '../../api/observability';

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  createdAt: string;
}

export default function ActivityTimeline() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getActivityTimeline();
      setActivities(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div>Loading activity timeline...</div>;

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span className="eb-page-kicker">Automation</span><h1>Activity Timeline</h1>
        <button onClick={load}>Refresh</button>
      </header>

      {error ? <p style={{ color: 'var(--status-crit)' }}>Error: {error}</p>
        : activities.length === 0 ? <p>No activity recorded.</p> : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, backgroundColor: 'var(--border-default)' }} />
          {activities.map((activity) => (
            <div key={activity.id} style={{ position: 'relative', marginBottom: 24, paddingLeft: 16 }}>
              <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--chart-1)' }} />
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{new Date(activity.createdAt).toLocaleString()}</div>
              <div style={{ fontWeight: 'bold' }}>{activity.action}</div>
              <div style={{ fontSize: 14, color: '#666' }}>
                {activity.entityType}:{activity.entityId} by {activity.actorName}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
