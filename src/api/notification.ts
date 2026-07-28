import { request } from './client.js';

export const authApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
};

export const notificationApi = {
  list: (tenantId: string, unreadOnly = false) => request(`/notifications/${tenantId}${unreadOnly ? '?unread=true' : ''}`),
  unreadCount: (tenantId: string) => request(`/notifications/${tenantId}/unread-count`),
  markRead: (tenantId: string, id: string) => request(`/notifications/${tenantId}/${id}/read`, { method: 'PATCH' }),
  markAllRead: (tenantId: string) => request(`/notifications/${tenantId}/read-all`, { method: 'POST' }),
};

export const settingsApi = {
  list: (tenantId: string, scope: 'org' | 'personal' = 'personal') => request(`/settings/${tenantId}?scope=${scope}`),
  set: (tenantId: string, key: string, value: unknown, scope: 'org' | 'personal' = 'personal') =>
    request(`/settings/${tenantId}`, { method: 'PUT', body: JSON.stringify({ key, value, scope }) }),
};
