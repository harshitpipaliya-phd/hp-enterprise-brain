import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    entityType: row.entity_type ?? row.entityType ?? '',
    status: row.status ?? '',
    fileName: row.file_name ?? row.fileName ?? '',
    totalRows: Number(row.total_rows ?? row.totalRows ?? 0),
    processedRows: Number(row.processed_rows ?? row.processedRows ?? 0),
    successCount: Number(row.success_count ?? row.successCount ?? 0),
    errorCount: Number(row.error_count ?? row.errorCount ?? 0),
    duplicateCount: Number(row.duplicate_count ?? row.duplicateCount ?? 0),
    startedAt: row.started_at ?? row.startedAt ?? null,
    completedAt: row.completed_at ?? row.completedAt ?? null,
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  previewImport: async (tenantId: string, body: Record<string, unknown>) =>
    request(`/import/${tenantId}/preview`, { method: 'POST', body: JSON.stringify(body) }),

  startImport: async (tenantId: string, body: Record<string, unknown>) =>
    normalize(await request(`/import/${tenantId}/start`, { method: 'POST', body: JSON.stringify(body) })),

  rollbackImport: async (tenantId: string, id: string) =>
    normalize(await request(`/import/${tenantId}/${id}/rollback`, { method: 'POST' })),

  getImportLogs: (tenantId: string, id: string) =>
    request(`/import/${tenantId}/${id}/logs`),

  getActiveImports: async (tenantId: string) =>
    normalizeAll(await request(`/import/${tenantId}/active`)),
};
