import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    code: row.code ?? row.role_key ?? '',
    name: row.name ?? '',
    category: row.category ?? null,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    isSystem: Boolean(row.is_system ?? row.isSystem),
    description: row.description ?? null,
    level: row.level ?? '',
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
  listRoles: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/roles/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getRole: async (tenantId: string, id: string) =>
    normalize(await request(`/roles/${tenantId}/${id}`)),

  createRole: async (body: Record<string, unknown>) =>
    normalize(await request('/roles', { method: 'POST', body: JSON.stringify(body) })),

  updateRole: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/roles/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveRole: async (tenantId: string, id: string) =>
    normalize(await request(`/roles/${tenantId}/${id}/archive`, { method: 'POST' })),

  getAuditLogs: async (tenantId: string, id: string) =>
    request(`/roles/${tenantId}/${id}/audit`),
};

export interface PermissionMatrix {
  permissions: string[];
  roles: { key: string; permissions: string[] }[];
}

/** GET /roles/{tenantId}/matrix — the access roles the API enforces, from its Role enum. */
export const getPermissionMatrix = (tenantId: string): Promise<PermissionMatrix> =>
  request(`/roles/${tenantId}/matrix`);
