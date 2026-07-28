import { request } from './client.js';

export const api = {
  createPerson: (body: any) => request('/people', { method: 'POST', body: JSON.stringify(body) }),
  listPeople: (tenantId: string, orgId?: string, departmentId?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.set('orgId', orgId);
    if (departmentId) params.set('departmentId', departmentId);
    const qs = params.toString();
    return request(`/people/${tenantId}${qs ? `?${qs}` : ''}`);
  },
  searchPeople: (tenantId: string, query: string, orgId?: string) => request(`/people/${tenantId}/search?q=${encodeURIComponent(query)}${orgId ? `&orgId=${orgId}` : ''}`),
  getPerson: (tenantId: string, id: string) => request(`/people/${tenantId}/${id}`),
  updatePerson: (tenantId: string, id: string, body: any) => request(`/people/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archivePerson: (tenantId: string, id: string) => request(`/people/${tenantId}/${id}/archive`, { method: 'POST' }),
  getAuditLogs: (tenantId: string, id: string) => request(`/people/${tenantId}/${id}/audit`),
  getTwin: (tenantId: string, id: string) => request(`/people/${tenantId}/${id}/twin`),
};
