import { request } from './client.js';

export const esoApi = {
  listAll: (tenantId: string, status?: string) => request(`/eso-executions/${tenantId}${status ? `?status=${status}` : ''}`),
  history: (tenantId: string, esoId: string) => request(`/eso-executions/${tenantId}/eso/${esoId}`),
  transition: (tenantId: string, id: string, status: string, output?: Record<string, unknown>, error?: string) =>
    request(`/eso-executions/${tenantId}/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ status, output, error }) }),
  rollback: (tenantId: string, id: string) => request(`/eso-executions/${tenantId}/${id}/rollback`, { method: 'POST' }),
};
