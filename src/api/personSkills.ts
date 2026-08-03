import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    personId: String(row.person_id ?? row.personId ?? ''),
    skillId: String(row.skill_id ?? row.skillId ?? ''),
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
  listPersonSkills: async (tenantId: string, personId?: string) => {
    const rows = normalizeAll(await request(`/person-skills/${tenantId}`));
    return personId ? rows.filter((r) => String(r.personId) === String(personId)) : rows;
  },

  getPersonSkill: async (tenantId: string, id: string) =>
    normalize(await request(`/person-skills/${tenantId}/${id}`)),

  createPersonSkill: async (body: Record<string, unknown>) =>
    normalize(await request('/person-skills', { method: 'POST', body: JSON.stringify(body) })),

  updatePersonSkill: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/person-skills/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archivePersonSkill: async (tenantId: string, id: string) =>
    normalize(await request(`/person-skills/${tenantId}/${id}/archive`, { method: 'POST' })),

  getByPerson: async (tenantId: string, personId: string) => {
    const rows = normalizeAll(await request(`/person-skills/${tenantId}?personId=${encodeURIComponent(personId)}`));
    return rows.filter((r) => String(r.personId) === String(personId));
  },

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/person-skills/${tenantId}/${id}/audit`),
};
