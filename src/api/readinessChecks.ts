import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    category: row.category ?? '',
    name: row.name ?? '',
    description: row.description ?? null,
    status: row.status ?? '',
    passed: row.passed ?? null,
    message: row.message ?? null,
    checkedAt: row.checked_at ?? row.checkedAt ?? '',
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  listReadinessChecks: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/readiness-checks/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getReadinessCheck: async (tenantId: string, id: string) =>
    normalize(await request(`/readiness-checks/${tenantId}/${id}`)),

  createReadinessCheck: async (body: Record<string, unknown>) =>
    normalize(await request(`/readiness-checks/${body.tenantId || ''}`, { method: 'POST', body: JSON.stringify(body) })),

  updateReadinessCheck: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/readiness-checks/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveReadinessCheck: async (tenantId: string, id: string) =>
    normalize(await request(`/readiness-checks/${tenantId}/${id}/archive`, { method: 'POST' })),

  getByOrg: async (tenantId: string, orgId: string) =>
    normalizeAll(await request(`/readiness-checks/${tenantId}/by-org/${orgId}`)),

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/readiness-checks/${tenantId}/${id}/audit`),
};
