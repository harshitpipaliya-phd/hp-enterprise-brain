import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

function normalize(row: any, tenantId: string): any {
  return {
    displayName: null,
    profilePhoto: null,
    dateOfBirth: null,
    employmentType: null,
    employmentStatus: null,
    joiningDate: null,
    managerId: null,
    designation: null,
    location: null,
    reportingManagerId: null,
    ...row,
    tenantId,
  };
}

function scope(rows: any, tenantId: string, orgId?: string, departmentId?: string): any[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (r) =>
        (!orgId || String(r.orgId ?? '') === String(orgId)) &&
        (!departmentId || String(r.departmentId ?? '') === String(departmentId)),
    )
    .map((r) => normalize(r, tenantId));
}

function scopedTenant(fallback: string): string {
  return getAuthTenantId() || fallback;
}

export const api = {
  /** GET /api/v1/people/{tenantId} - scoped to the logged-in organization and optional department. */
  listPeople: async (tenantId: string, _orgId?: string, departmentId?: string) => {
    const tenant = scopedTenant(tenantId);
    return scope(await request(`/people/${tenant}`), tenant, tenant, departmentId);
  },

  /** GET /api/v1/people/{tenantId}/search?q= - server caps at 50 rows, then scoped. */
  searchPeople: async (tenantId: string, query: string, _orgId?: string) => {
    const tenant = scopedTenant(tenantId);
    return scope(await request(`/people/${tenant}/search?q=${encodeURIComponent(query)}`), tenant, tenant);
  },

  /** GET /api/v1/people/{tenantId}/{id} */
  getPerson: async (tenantId: string, id: string) => {
    const tenant = scopedTenant(tenantId);
    return normalize(await request(`/people/${tenant}/${id}`), tenant);
  },

  /** POST /api/v1/people */
  createPerson: async (tenantId: string, body: Record<string, unknown>) => {
    const tenant = scopedTenant(tenantId);
    return normalize(await request('/people', { method: 'POST', body: JSON.stringify(body) }), tenant);
  },

  /** PATCH /api/v1/people/{tenantId}/{id} - responds {ok:true}, so re-read the row. */
  updatePerson: async (tenantId: string, id: string, body: Record<string, unknown>) => {
    const tenant = scopedTenant(tenantId);
    await request(`/people/${tenant}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getPerson(tenant, id);
  },

  /** POST /api/v1/people/{tenantId}/{id}/archive */
  archivePerson: (tenantId: string, id: string) =>
    request(`/people/${scopedTenant(tenantId)}/${id}/archive`, { method: 'POST' }),

  /** GET /api/v1/people/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/people/${scopedTenant(tenantId)}/${id}/audit`),

  /** GET /api/v1/people/{tenantId}/{id}/twin */
  getTwin: (tenantId: string, id: string) => request(`/people/${scopedTenant(tenantId)}/${id}/twin`),
};
