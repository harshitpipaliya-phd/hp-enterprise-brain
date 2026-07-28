import { request } from './client.js';

/**
 * Departments come from the ERP table hrms_departments.
 *
 * DepartmentController::index() takes no orgId filter — it returns every
 * department across every institute (a few hundred KB on a real database) and
 * stamps each row with its own `orgId` (the ERP's sub_institute_id). The
 * ?orgId= query parameter this client used to send was therefore ignored, and
 * the Departments screen showed every institute's departments at once.
 *
 * Filtering here on the field the server actually returns is what makes the
 * selected organization mean something. It is a real filter over real rows.
 */
/**
 * DepartmentController::map() emits camelCase but has no tenantId to emit — the
 * ERP table is not tenant-scoped. The edit/archive/twin screens read
 * department.tenantId straight back into their request URLs, so leaving it
 * undefined produced /api/v1/departments/undefined/12 and a 403. Stamping the
 * tenant the row was fetched under keeps that round-trip intact.
 */
function withTenant(row: any, tenantId: string): any {
  return { ...row, tenantId };
}

function filterByOrg(rows: any, tenantId: string, orgId?: string): any[] {
  if (!Array.isArray(rows)) return [];
  const scoped = orgId ? rows.filter((r) => String(r.orgId ?? '') === String(orgId)) : rows;
  return scoped.map((r) => withTenant(r, tenantId));
}

export const api = {
  /** GET /api/v1/departments/{tenantId} — scoped to orgId client-side. */
  listDepartments: async (tenantId: string, orgId?: string) =>
    filterByOrg(await request(`/departments/${tenantId}`), tenantId, orgId),

  /** GET /api/v1/departments/{tenantId}/{id} */
  getDepartment: async (tenantId: string, id: string) =>
    withTenant(await request(`/departments/${tenantId}/${id}`), tenantId),

  /** POST /api/v1/departments — orgId is required and must be the sub_institute_id. */
  createDepartment: async (tenantId: string, body: Record<string, unknown>) =>
    withTenant(await request('/departments', { method: 'POST', body: JSON.stringify(body) }), tenantId),

  /** PATCH /api/v1/departments/{tenantId}/{id} — responds {ok:true}, so re-read the row. */
  updateDepartment: async (tenantId: string, id: string, body: Record<string, unknown>) => {
    await request(`/departments/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getDepartment(tenantId, id);
  },

  /**
   * POST /api/v1/departments/{tenantId}/{id}/archive — soft delete. The row is
   * excluded from every later read, so callers reload the list rather than
   * re-reading a row that now 404s.
   */
  archiveDepartment: (tenantId: string, id: string) =>
    request(`/departments/${tenantId}/${id}/archive`, { method: 'POST' }),

  /** GET /api/v1/departments/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/departments/${tenantId}/${id}/audit`),

  /** GET /api/v1/departments/{tenantId}/{id}/twin */
  getTwin: (tenantId: string, id: string) => request(`/departments/${tenantId}/${id}/twin`),
};
