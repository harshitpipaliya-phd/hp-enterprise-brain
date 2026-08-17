import { request } from './client.js';

export const esoApi = {
  /** GET /api/v1/eso-definitions/{tenantId} */
  definitions: (tenantId: string) => request(`/eso-definitions/${tenantId}`),

  /** POST /api/v1/measurement-plans */
  createMeasurementPlan: (body: Record<string, unknown>) =>
    request('/measurement-plans', { method: 'POST', body: JSON.stringify(body) }),

  /** GET /api/v1/eso-executions/{tenantId} */
  listAll: (tenantId: string, status?: string) =>
    request(`/eso-executions/${tenantId}${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  /** POST /api/v1/eso-executions */
  create: (body: Record<string, unknown>) =>
    request('/eso-executions', { method: 'POST', body: JSON.stringify(body) }),

  /** GET /api/v1/eso-executions/{tenantId}/eso/{esoId} */
  history: (tenantId: string, esoId: string) => request(`/eso-executions/${tenantId}/eso/${esoId}`),

  /** PATCH /api/v1/eso-executions/{tenantId}/{id}/transition */
  transition: (tenantId: string, id: string, status: string, output?: Record<string, unknown>, error?: string) =>
    request(`/eso-executions/${tenantId}/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ status, output, error }) }),

  /** POST /api/v1/eso-executions/{tenantId}/{id}/rollback */
  rollback: (tenantId: string, id: string, reason: string) =>
    request(`/eso-executions/${tenantId}/${id}/rollback`, { method: 'POST', body: JSON.stringify({ reason }) }),
};
