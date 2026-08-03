import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    reporterId: row.reporter_id ?? row.reporterId ?? '',
    reporteeId: row.reportee_id ?? row.reporteeId ?? '',
    type: row.type ?? '',
    level: row.level ?? null,
    startDate: row.start_date ?? row.startDate ?? '',
    endDate: row.end_date ?? row.endDate ?? null,
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
  listReportingStructures: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/reporting-structures/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getReportingStructure: async (tenantId: string, id: string) =>
    normalize(await request(`/reporting-structures/${tenantId}/${id}`)),

  createReportingStructure: async (body: Record<string, unknown>) =>
    normalize(await request(`/reporting-structures/${body.tenantId || ''}`, { method: 'POST', body: JSON.stringify(body) })),

  updateReportingStructure: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/reporting-structures/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveReportingStructure: async (tenantId: string, id: string) =>
    normalize(await request(`/reporting-structures/${tenantId}/${id}/archive`, { method: 'POST' })),

  getForPerson: async (tenantId: string, personId: string) =>
    normalizeAll(await request(`/reporting-structures/${tenantId}/for-person/${personId}`)),

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/reporting-structures/${tenantId}/${id}/audit`),
};
