import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    templateType: row.template_type ?? row.templateType ?? '',
    templateKey: row.template_key ?? row.templateKey ?? '',
    level: row.level ?? '',
    value: row.value ?? null,
    reason: row.reason ?? null,
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  listTemplateOverrides: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/template-overrides/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getTemplateOverride: async (tenantId: string, id: string) =>
    normalize(await request(`/template-overrides/${tenantId}/${id}`)),

  createTemplateOverride: async (body: Record<string, unknown>) =>
    normalize(await request(`/template-overrides/${body.tenantId || ''}`, { method: 'POST', body: JSON.stringify(body) })),

  updateTemplateOverride: async (tenantId: string, id: string, body: Record<string, unknown>) =>
    normalize(await request(`/template-overrides/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  archiveTemplateOverride: async (tenantId: string, id: string) =>
    normalize(await request(`/template-overrides/${tenantId}/${id}/archive`, { method: 'POST' })),

  getEffective: async (tenantId: string, templateType: string, templateKey: string, orgId?: string) =>
    normalize(await request(`/template-overrides/${tenantId}/effective?templateType=${encodeURIComponent(templateType)}&templateKey=${encodeURIComponent(templateKey)}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/template-overrides/${tenantId}/${id}/audit`),
};
