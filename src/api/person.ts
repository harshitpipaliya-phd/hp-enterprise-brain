import { request } from './client.js';

/**
 * People come from the ERP's employee tables (tbluser).
 *
 * Two things PersonController does not do, which this module has to absorb:
 *
 * 1. index() and search() ignore orgId / departmentId — index() is a bare
 *    `$this->query()->get()` returning every person in the institute group.
 *    Each row carries its own orgId and departmentId, so the scoping happens
 *    here over the rows the server really sent.
 *
 * 2. map() emits no tenantId, and no displayName / employmentType /
 *    employmentStatus / managerId / location — tbluser has no such columns. The
 *    edit and twin screens feed person.tenantId straight back into a request
 *    URL, so an undefined there became /api/v1/people/undefined/7 and a 403.
 *    normalize() supplies the tenant and fills the absent fields with null
 *    rather than leaving them undefined, so `?? ''` in the forms behaves.
 */
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

export const api = {
  /** GET /api/v1/people/{tenantId} — scoped to orgId / departmentId client-side. */
  listPeople: async (tenantId: string, orgId?: string, departmentId?: string) =>
    scope(await request(`/people/${tenantId}`), tenantId, orgId, departmentId),

  /** GET /api/v1/people/{tenantId}/search?q= — server caps at 50 rows, then scoped. */
  searchPeople: async (tenantId: string, query: string, orgId?: string) =>
    scope(await request(`/people/${tenantId}/search?q=${encodeURIComponent(query)}`), tenantId, orgId),

  /** GET /api/v1/people/{tenantId}/{id} */
  getPerson: async (tenantId: string, id: string) =>
    normalize(await request(`/people/${tenantId}/${id}`), tenantId),

  /** POST /api/v1/people — accepts employeeId, firstName, lastName, email, orgId, phone, gender. */
  createPerson: async (tenantId: string, body: Record<string, unknown>) =>
    normalize(await request('/people', { method: 'POST', body: JSON.stringify(body) }), tenantId),

  /** PATCH /api/v1/people/{tenantId}/{id} — responds {ok:true}, so re-read the row. */
  updatePerson: async (tenantId: string, id: string, body: Record<string, unknown>) => {
    await request(`/people/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getPerson(tenantId, id);
  },

  /** POST /api/v1/people/{tenantId}/{id}/archive — soft delete; callers reload the list. */
  archivePerson: (tenantId: string, id: string) =>
    request(`/people/${tenantId}/${id}/archive`, { method: 'POST' }),

  /** GET /api/v1/people/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/people/${tenantId}/${id}/audit`),

  /** GET /api/v1/people/{tenantId}/{id}/twin */
  getTwin: (tenantId: string, id: string) => request(`/people/${tenantId}/${id}/twin`),
};
