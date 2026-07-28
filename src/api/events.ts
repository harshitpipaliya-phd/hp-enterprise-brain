import { request } from './client.js';

export const api = {
  getStats: () => request('/events/stats/summary'),
  listEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/events${qs}`);
  },
  getEvent: (id: string) => request(`/events/${id}`),
  replayEvent: (id: string) => request(`/events/${id}/replay`, { method: 'POST' }),
  retryFailed: () => request('/events/retry/failed', { method: 'POST' }),
  getDLQ: () => request('/events/dlq'),
  retryDLQ: (id: string) => request(`/events/dlq/${id}/retry`, { method: 'POST' }),
  deleteDLQ: (id: string) => request(`/events/dlq/${id}`, { method: 'DELETE' }),
  getConsumers: () => request('/events/consumers'),
};
