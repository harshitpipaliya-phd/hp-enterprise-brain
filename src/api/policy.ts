import { request } from './client.js';

export const policyApi = {
  list: (tenantId: string) => request(`/policies/${tenantId}`),
  get: (tenantId: string, id: string) => request(`/policies/${tenantId}/${id}`),
  history: (tenantId: string, id: string) => request(`/policies/${tenantId}/${id}/history`),
  create: (body: Record<string, unknown>) => request('/policies', { method: 'POST', body: JSON.stringify(body) }),
  createVersion: (tenantId: string, id: string, rules: unknown[]) =>
    request(`/policies/${tenantId}/${id}/version`, { method: 'POST', body: JSON.stringify({ rules }) }),
  evaluate: (tenantId: string, id: string, context: Record<string, unknown>) =>
    request(`/policies/${tenantId}/${id}/evaluate`, { method: 'POST', body: JSON.stringify({ context }) }),
};

export const mentalModelApi = {
  list: (tenantId: string) => request(`/mental-models/${tenantId}`),
  getByDomain: (tenantId: string, domain: string) => request(`/mental-models/${tenantId}/domain/${domain}`),
};
