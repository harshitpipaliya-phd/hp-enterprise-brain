import { request } from './client.js';

export const api = {
  createOrganization: (body: any) => request('/organizations', { method: 'POST', body: JSON.stringify(body) }),
  listOrganizations: (tenantId: string) => request(`/organizations/${tenantId}`),
  getOrganization: (tenantId: string, id: string) => request(`/organizations/${tenantId}/${id}`),
  updateOrganization: (tenantId: string, id: string, body: any) => request(`/organizations/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archiveOrganization: (tenantId: string, id: string) => request(`/organizations/${tenantId}/${id}/archive`, { method: 'POST' }),
  getAuditLogs: (tenantId: string, id: string) => request(`/organizations/${tenantId}/${id}/audit`),
};
