import { request } from './client.js';

/**
 * Capabilities are Brain-owned (hpbrain_capabilities), so unlike departments
 * and people the ?orgId= filter is honoured server-side by
 * CapabilityController::index().
 *
 * The controller returns the raw table row rather than a mapped shape — every
 * column arrives snake_case (capability_code, capability_type, tenant_id,
 * created_date). The list, detail, edit and assignment screens all read
 * camelCase, so without this mapping every column but `name` and `status`
 * rendered blank and cap.tenantId was undefined in the URLs they build.
 */
function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    capabilityCode: row.capability_code ?? row.capabilityCode ?? '',
    name: row.name ?? '',
    description: row.description ?? null,
    category: row.category ?? '',
    capabilityType: row.capability_type ?? row.capabilityType ?? '',
    difficulty: row.difficulty ?? '',
    criticality: row.criticality ?? '',
    version: Number(row.version ?? 1),
    status: row.status ?? '',
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
    knowledge: row.knowledge ?? null,
    ability: row.ability ?? null,
    skill: row.skill ?? null,
    behaviour: row.behaviour ?? null,
    attitude: row.attitude ?? null,
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  /** GET /api/v1/capabilities/{tenantId}[?orgId=] */
  listCapabilities: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/capabilities/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  /**
   * GET /api/v1/capabilities/{tenantId}/search?q=
   *
   * This route is currently unreachable. routes/api.php registers
   * `capabilities/{tenantId}/{id}` in the Foundation block, ~100 lines BEFORE
   * `capabilities/{tenantId}/search` in the Capabilities block, and Laravel
   * matches in registration order — so /search resolves to show() with
   * id='search' and answers 404 capability_not_found. (The file's header
   * comment asserts Laravel is immune to this Express ordering hazard; it is
   * not. Same shape as the bug that comment was written about. People,
   * conversations and knowledge-library escape it only because their literal
   * route happens to be registered first — those three do return 200.)
   *
   * Until the two registrations are reordered server-side, fall back to
   * filtering the tenant's capability list, which is the same rows the server
   * would search over (name / capabilityCode, matching its LIKE %term%). Real
   * data from a real endpoint, just filtered a hop later.
   */
  searchCapabilities: async (tenantId: string, query: string, orgId?: string) => {
    const term = query.trim().toLowerCase();
    let rows: any[];
    try {
      rows = normalizeAll(await request(`/capabilities/${tenantId}/search?q=${encodeURIComponent(query)}`));
    } catch {
      rows = (await api.listCapabilities(tenantId, orgId)).filter(
        (c: any) =>
          c.name.toLowerCase().includes(term) || c.capabilityCode.toLowerCase().includes(term),
      );
    }
    return orgId ? rows.filter((r) => String(r.orgId) === String(orgId)) : rows;
  },

  /** GET /api/v1/capabilities/{tenantId}/{id} */
  getCapability: async (tenantId: string, id: string) =>
    normalize(await request(`/capabilities/${tenantId}/${id}`)),

  /** POST /api/v1/capabilities */
  createCapability: async (body: Record<string, unknown>) =>
    normalize(await request('/capabilities', { method: 'POST', body: JSON.stringify(body) })),

  /** PATCH /api/v1/capabilities/{tenantId}/{id} — returns the updated row. */
  updateCapability: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/capabilities/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  /** POST /api/v1/capabilities/{tenantId}/{id}/version — snapshots the current row. */
  createVersion: (tenantId: string, id: string) =>
    request(`/capabilities/${tenantId}/${id}/version`, { method: 'POST' }),

  /** GET /api/v1/capabilities/{tenantId}/{id}/versions */
  getVersions: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/versions`),

  /** POST /api/v1/capabilities/{tenantId}/{id}/archive — returns the updated row. */
  archiveCapability: async (tenantId: string, id: string) =>
    normalize(await request(`/capabilities/${tenantId}/${id}/archive`, { method: 'POST' })),

  /**
   * POST /api/v1/capabilities/{tenantId}/{id}/assign
   *
   * hpbrain_capability_assignments is polymorphic — (target_type, target_id) —
   * so Person, Department, JobRole and Organization are all assignable targets.
   * The controller has been corrected to match the table it writes to; it
   * previously validated a `personId` and wrote a `person_id` column that does
   * not exist, so every assignment 500'd.
   */
  assignCapability: (tenantId: string, id: string, targetType: string, targetId: string) =>
    request(`/capabilities/${tenantId}/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    }),

  /** GET /api/v1/capabilities/{tenantId}/{id}/assignments */
  getAssignments: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/assignments`),

  /** GET /api/v1/capabilities/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/capabilities/${tenantId}/${id}/audit`),
};
