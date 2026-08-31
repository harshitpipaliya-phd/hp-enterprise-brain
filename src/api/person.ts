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

  /**
   * GET /api/v1/people/{tenantId}?unitId=&q=&page=&perPage=
   *
   * ONE PAGE, NARROWED IN SQL. `listPeople` above downloads the tenant's whole
   * workforce and filters it in the browser — on Fiber Valley that is 768 rows
   * serialised and discarded so a department page can render ten. This asks the
   * server for the ten.
   *
   * `total` comes from a COUNT on the same builder as the rows, so the pager
   * and the page it labels can never describe different filters.
   */
  listPeoplePage: async (
    tenantId: string,
    options: { unitId?: string; q?: string; page?: number; perPage?: number } = {},
  ): Promise<{ people: any[]; total: number; page: number; perPage: number; pages: number }> => {
    const tenant = scopedTenant(tenantId);
    const params = new URLSearchParams();

    if (options.unitId) params.set('unitId', String(options.unitId));
    if (options.q?.trim()) params.set('q', options.q.trim());
    // Always sent: their presence is what asks the server for the paged
    // envelope rather than the historical bare array.
    params.set('page', String(Math.max(1, options.page ?? 1)));
    params.set('perPage', String(Math.max(1, Math.min(100, options.perPage ?? 20))));

    const body: any = await request(`/people/${tenant}?${params.toString()}`);

    return {
      people: Array.isArray(body?.people) ? body.people.map((r: any) => normalize(r, tenant)) : [],
      total: Number(body?.total ?? 0),
      page: Number(body?.page ?? 1),
      perPage: Number(body?.perPage ?? 20),
      pages: Number(body?.pages ?? 1),
    };
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

  /**
   * GET /api/v1/people/{tenantId}/{id}/twin - the full person profile.
   *
   * The path still says `twin` because that is the shipped route and renaming it
   * would break any client already calling it. What it returns is the person's
   * ERP master row, their unit and profile, the operational records their
   * reference appears in, and whatever the intelligence loop holds about them —
   * so the method is named for the payload rather than for the URL.
   */
  getProfile: (tenantId: string, id: string) => request(`/people/${scopedTenant(tenantId)}/${id}/twin`),

  /** @deprecated Use getProfile. Kept for callers written against the old name. */
  getTwin: (tenantId: string, id: string) => api.getProfile(tenantId, id),
};
