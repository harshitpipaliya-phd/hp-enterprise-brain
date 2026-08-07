import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

function withTenant(row: any, tenantId: string): any {
  return { ...row, tenantId };
}

function filterByOrg(rows: any, tenantId: string, orgId?: string): any[] {
  if (!Array.isArray(rows)) return [];
  const scoped = orgId ? rows.filter((r) => String(r.orgId ?? '') === String(orgId)) : rows;
  return scoped.map((r) => withTenant(r, tenantId));
}

function scopedTenant(fallback: string): string {
  return getAuthTenantId() || fallback;
}

export const api = {
  /** GET /api/v1/departments/{tenantId} - scoped to the logged-in organization. */
  listDepartments: async (tenantId: string, _orgId?: string) => {
    const tenant = scopedTenant(tenantId);
    return filterByOrg(await request(`/departments/${tenant}`), tenant, tenant);
  },

  /** GET /api/v1/departments/{tenantId}/{id} */
  getDepartment: async (tenantId: string, id: string) => {
    const tenant = scopedTenant(tenantId);
    return withTenant(await request(`/departments/${tenant}/${id}`), tenant);
  },

  /** POST /api/v1/departments */
  createDepartment: async (tenantId: string, body: Record<string, unknown>) => {
    const tenant = scopedTenant(tenantId);
    return withTenant(await request('/departments', { method: 'POST', body: JSON.stringify(body) }), tenant);
  },

  /** PATCH /api/v1/departments/{tenantId}/{id} - responds {ok:true}, so re-read the row. */
  updateDepartment: async (tenantId: string, id: string, body: Record<string, unknown>) => {
    const tenant = scopedTenant(tenantId);
    await request(`/departments/${tenant}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getDepartment(tenant, id);
  },

  /** POST /api/v1/departments/{tenantId}/{id}/archive */
  archiveDepartment: (tenantId: string, id: string) =>
    request(`/departments/${scopedTenant(tenantId)}/${id}/archive`, { method: 'POST' }),

  /** GET /api/v1/departments/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/departments/${scopedTenant(tenantId)}/${id}/audit`),

  /** GET /api/v1/departments/{tenantId}/{id}/twin */
  getTwin: (tenantId: string, id: string) => request(`/departments/${scopedTenant(tenantId)}/${id}/twin`),
};
