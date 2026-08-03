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
  listCompetencies: async (tenantId: string) =>
    normalizeAll(await request(`/competencies/${tenantId}`)),

  getCompetency: async (tenantId: string, id: string) =>
    normalize(await request(`/competencies/${tenantId}/${id}`)),

  createCompetency: async (body: Record<string, unknown>) =>
    normalize(await request('/competencies', { method: 'POST', body: JSON.stringify(body) })),

  updateCompetency: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/competencies/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveCompetency: async (tenantId: string, id: string) =>
    normalize(await request(`/competencies/${tenantId}/${id}/archive`, { method: 'POST' })),

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/competencies/${tenantId}/${id}/audit`),
};
