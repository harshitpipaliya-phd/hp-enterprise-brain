import { useState, useEffect } from 'react';
import { notificationApi } from '../api/notification';
import { useTheme } from '../hooks/useTheme';

interface Notification {
  id: string;
  title: string;
  readDate: string | null;
  createdDate: string;
}

export function NotificationBell({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = async () => {
    try {
      const [list, count] = await Promise.all([notificationApi.list(tenantId), notificationApi.unreadCount(tenantId)]);
      setNotifications(list);
      setUnreadCount(count.count);
    } catch { /* notification load failure shouldn't break the shell */ }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const markRead = async (id: string) => {
    await notificationApi.markRead(tenantId, id);
    load();
  };

  const markAllRead = async () => {
    await notificationApi.markAllRead(tenantId);
    load();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: 'relative' }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', color: 'white', borderRadius: 10, fontSize: 10, padding: '1px 5px' }}>
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', width: 320, maxHeight: 400, overflowY: 'auto', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10 }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <button onClick={markAllRead} style={{ fontSize: 11 }}>Mark all read</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 16, color: theme.textMuted, fontSize: 13 }}>No notifications yet.</div>
          ) : notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.readDate && markRead(n.id)}
              style={{ padding: 10, borderBottom: `1px solid ${theme.border}`, cursor: n.readDate ? 'default' : 'pointer', backgroundColor: n.readDate ? 'transparent' : '#3b82f610', fontSize: 12 }}
            >
              {n.title}
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{new Date(n.createdDate).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
