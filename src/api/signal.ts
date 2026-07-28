import { request } from './client.js';

export const api = {
  /** GET /api/v1/signals/{tenantId} */
  listSignals: (tenantId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/signals/${tenantId}${qs}`);
  },

  /** GET /api/v1/signals/{tenantId}/{id} */
  getSignal: (tenantId: string, id: string) => request(`/signals/${tenantId}/${id}`),

  /** POST /api/v1/signals */
  createSignal: (body: Record<string, unknown>) =>
    request('/signals', { method: 'POST', body: JSON.stringify(body) }),

  /** PATCH /api/v1/signals/{tenantId}/{id}/status */
  changeStatus: (tenantId: string, id: string, status: string) =>
    request(`/signals/${tenantId}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
