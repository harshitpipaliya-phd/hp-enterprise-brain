import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    parentUnitId: row.parent_unit_id ?? row.parentUnitId ?? null,
    unitType: row.unit_type ?? row.unitType ?? '',
    name: row.name ?? '',
    code: row.code ?? '',
    description: row.description ?? null,
    headPersonId: row.head_person_id ?? row.headPersonId ?? null,
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
  listOrganizationUnits: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/organization-units/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getOrganizationUnit: async (tenantId: string, id: string) =>
    normalize(await request(`/organization-units/${tenantId}/${id}`)),

  createOrganizationUnit: async (body: Record<string, unknown>) =>
    normalize(await request('/organization-units', { method: 'POST', body: JSON.stringify(body) })),

  updateOrganizationUnit: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/organization-units/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveOrganizationUnit: async (tenantId: string, id: string) =>
    normalize(await request(`/organization-units/${tenantId}/${id}/archive`, { method: 'POST' })),

  getChildren: async (tenantId: string, parentId: string) =>
    normalizeAll(await request(`/organization-units/${tenantId}/${parentId}/children`)),

  getAuditLogs: async (tenantId: string, id: string) =>
    request(`/organization-units/${tenantId}/${id}/audit`),
};
