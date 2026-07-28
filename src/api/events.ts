import { request } from './client.js';

export const api = {
  /** GET /api/v1/events/stats/summary */
  getStats: () => request('/events/stats/summary'),

  /**
   * GET /api/v1/events — NOT REGISTERED in routes/api.php. The route table has
   * events/stats/summary, events/dlq, events/consumers, events/{id} and the
   * two POST actions, but no collection read, so this 404s. Kept so the Event
   * Store screen's failure is a visible error rather than a silent empty
   * table; it starts working the moment the route is added.
   */
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
