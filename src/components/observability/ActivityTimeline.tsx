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

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getActivityTimeline();
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div>Loading activity timeline...</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Activity Timeline</h1>
        <button onClick={load}>Refresh</button>
      </header>

      {activities.length === 0 ? <p>No activity recorded.</p> : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, backgroundColor: '#e5e7eb' }} />
          {activities.map((activity) => (
            <div key={activity.id} style={{ position: 'relative', marginBottom: 24, paddingLeft: 16 }}>
              <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
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
