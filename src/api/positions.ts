import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    roleId: String(row.role_id ?? row.roleId ?? ''),
    departmentId: row.department_id ?? row.departmentId ?? null,
    locationId: row.location_id ?? row.locationId ?? null,
    code: row.code ?? '',
    title: row.title ?? '',
    description: row.description ?? null,
    employmentType: row.employment_type ?? row.employmentType ?? '',
    status: row.status ?? '',
    version: Number(row.version ?? 1),
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  listPositions: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/positions/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getPosition: async (tenantId: string, id: string) =>
    normalize(await request(`/positions/${tenantId}/${id}`)),

  createPosition: async (body: Record<string, unknown>) =>
    normalize(await request('/positions', { method: 'POST', body: JSON.stringify(body) })),

  updatePosition: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/positions/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archivePosition: async (tenantId: string, id: string) =>
    normalize(await request(`/positions/${tenantId}/${id}/archive`, { method: 'POST' })),

  getAuditLogs: async (tenantId: string, id: string) =>
    request(`/positions/${tenantId}/${id}/audit`),
};
