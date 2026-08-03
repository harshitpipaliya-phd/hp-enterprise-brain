import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    personId: String(row.person_id ?? row.personId ?? ''),
    competencyId: String(row.competency_id ?? row.competencyId ?? ''),
    proficiencyLevel: row.proficiency_level ?? row.proficiencyLevel ?? '',
    verified: row.verified ?? false,
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
  listPersonCompetencies: async (tenantId: string, personId?: string) => {
    const rows = normalizeAll(await request(`/person-competencies/${tenantId}`));
    return personId ? rows.filter((r) => String(r.personId) === String(personId)) : rows;
  },

  getPersonCompetency: async (tenantId: string, id: string) =>
    normalize(await request(`/person-competencies/${tenantId}/${id}`)),

  createPersonCompetency: async (body: Record<string, unknown>) =>
    normalize(await request('/person-competencies', { method: 'POST', body: JSON.stringify(body) })),

  updatePersonCompetency: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/person-competencies/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archivePersonCompetency: async (tenantId: string, id: string) =>
    normalize(await request(`/person-competencies/${tenantId}/${id}/archive`, { method: 'POST' })),

  getByPerson: async (tenantId: string, personId: string) => {
    const rows = normalizeAll(await request(`/person-competencies/${tenantId}?personId=${encodeURIComponent(personId)}`));
    return rows.filter((r) => String(r.personId) === String(personId));
  },

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/person-competencies/${tenantId}/${id}/audit`),
};
