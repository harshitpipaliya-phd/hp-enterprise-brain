import { request } from './client.js';

export const api = {
  listSignals: (tenantId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/signals/${tenantId}${qs}`);
  },
  getSignal: (tenantId: string, id: string) => request(`/signals/${tenantId}/${id}`),
  changeStatus: (tenantId: string, id: string, status: string) =>
    request(`/signals/${tenantId}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
