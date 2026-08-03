import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    code: row.code ?? '',
    name: row.name ?? '',
    description: row.description ?? null,
    category: row.category ?? '',
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
  listSkills: async (tenantId: string) =>
    normalizeAll(await request(`/skills/${tenantId}`)),

  getSkill: async (tenantId: string, id: string) =>
    normalize(await request(`/skills/${tenantId}/${id}`)),

  createSkill: async (body: Record<string, unknown>) =>
    normalize(await request('/skills', { method: 'POST', body: JSON.stringify(body) })),

  updateSkill: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/skills/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveSkill: async (tenantId: string, id: string) =>
    normalize(await request(`/skills/${tenantId}/${id}/archive`, { method: 'POST' })),

  getAuditLogs: async (tenantId: string, id: string) =>
    request(`/skills/${tenantId}/${id}/audit`),
};
