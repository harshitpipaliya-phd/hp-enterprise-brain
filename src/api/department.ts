import { request } from './client.js';

export const api = {
  createDepartment: (body: any) => request('/departments', { method: 'POST', body: JSON.stringify(body) }),
  listDepartments: (tenantId: string, orgId?: string) => request(`/departments/${tenantId}${orgId ? `?orgId=${orgId}` : ''}`),
  getDepartment: (tenantId: string, id: string) => request(`/departments/${tenantId}/${id}`),
  updateDepartment: (tenantId: string, id: string, body: any) => request(`/departments/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archiveDepartment: (tenantId: string, id: string) => request(`/departments/${tenantId}/${id}/archive`, { method: 'POST' }),
  getAuditLogs: (tenantId: string, id: string) => request(`/departments/${tenantId}/${id}/audit`),
  getTwin: (tenantId: string, id: string) => request(`/departments/${tenantId}/${id}/twin`),
};
