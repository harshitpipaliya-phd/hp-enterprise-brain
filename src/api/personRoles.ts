import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    personId: String(row.person_id ?? row.personId ?? ''),
    roleId: String(row.role_id ?? row.roleId ?? ''),
    orgId: String(row.org_id ?? row.orgId ?? ''),
    startDate: row.start_date ?? row.startDate ?? '',
    endDate: row.end_date ?? row.endDate ?? '',
    status: row.status ?? '',
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  listPersonRoles: async (tenantId: string, personId?: string) => {
    const rows = normalizeAll(await request(`/person-roles/${tenantId}`));
    return personId ? rows.filter((r) => String(r.personId) === String(personId)) : rows;
  },

  getPersonRole: async (tenantId: string, id: string) =>
    normalize(await request(`/person-roles/${tenantId}/${id}`)),

  createPersonRole: async (body: Record<string, unknown>) =>
    normalize(await request('/person-roles', { method: 'POST', body: JSON.stringify(body) })),

  updatePersonRole: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/person-roles/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archivePersonRole: async (tenantId: string, id: string) =>
    normalize(await request(`/person-roles/${tenantId}/${id}/archive`, { method: 'POST' })),

  getByPerson: async (tenantId: string, personId: string) => {
    const rows = normalizeAll(await request(`/person-roles/${tenantId}?personId=${encodeURIComponent(personId)}`));
    return rows.filter((r) => String(r.personId) === String(personId));
  },

  getByRole: async (tenantId: string, roleId: string) => {
    const rows = normalizeAll(await request(`/person-roles/${tenantId}?roleId=${encodeURIComponent(roleId)}`));
    return rows.filter((r) => String(r.roleId) === String(roleId));
  },

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/person-roles/${tenantId}/${id}/audit`),
};
