import { request } from './client.js';

export const api = {
  createCapability: (body: any) => request('/capabilities', { method: 'POST', body: JSON.stringify(body) }),
  listCapabilities: (tenantId: string, orgId?: string) => request(`/capabilities/${tenantId}${orgId ? `?orgId=${orgId}` : ''}`),
  searchCapabilities: (tenantId: string, query: string, orgId?: string) => request(`/capabilities/${tenantId}/search?q=${encodeURIComponent(query)}${orgId ? `&orgId=${orgId}` : ''}`),
  getCapability: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}`),
  updateCapability: (tenantId: string, id: string, body: any) => request(`/capabilities/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createVersion: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/version`, { method: 'POST' }),
  archiveCapability: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/archive`, { method: 'POST' }),
  getVersions: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/versions`),
  assignCapability: (tenantId: string, id: string, targetType: string, targetId: string) => request(`/capabilities/${tenantId}/${id}/assign`, { method: 'POST', body: JSON.stringify({ targetType, targetId }) }),
  getAssignments: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/assignments`),
  getAuditLogs: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/audit`),
};
