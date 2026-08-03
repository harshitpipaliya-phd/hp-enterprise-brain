import { request } from './client.js';

function normalize(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    id: String(row.id ?? ''),
    tenantId: row.tenant_id ?? row.tenantId ?? '',
    orgId: String(row.org_id ?? row.orgId ?? ''),
    personId: row.person_id ?? row.personId ?? '',
    currentStep: Number(row.current_step ?? row.currentStep ?? 0),
    totalSteps: Number(row.total_steps ?? row.totalSteps ?? 0),
    status: row.status ?? '',
    startedAt: row.started_at ?? row.startedAt ?? null,
    completedAt: row.completed_at ?? row.completedAt ?? null,
    activatedAt: row.activated_at ?? row.activatedAt ?? null,
    abandonedAt: row.abandoned_at ?? row.abandonedAt ?? null,
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function normalizeAll(rows: any): any[] {
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

export const api = {
  listOnboarding: async (tenantId: string, orgId?: string) =>
    normalizeAll(await request(`/onboarding/${tenantId}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`)),

  getOnboarding: async (tenantId: string, id: string) =>
    normalize(await request(`/onboarding/${tenantId}/${id}`)),

  startOnboarding: async (tenantId: string, body: Record<string, unknown>) =>
    normalize(await request(`/onboarding/${tenantId}/start`, { method: 'POST', body: JSON.stringify(body) })),

  completeStep: async (tenantId: string, id: string, step: string | number) =>
    normalize(await request(`/onboarding/${tenantId}/${id}/complete-step`, { method: 'POST', body: JSON.stringify({ step }) })),

  activate: async (tenantId: string, id: string) =>
    normalize(await request(`/onboarding/${tenantId}/${id}/activate`, { method: 'POST' })),

  abandon: async (tenantId: string, id: string) =>
    normalize(await request(`/onboarding/${tenantId}/${id}/abandon`, { method: 'POST' })),

  getReadiness: (tenantId: string, id: string) =>
    request(`/onboarding/${tenantId}/${id}/readiness`),

  getAuditLogs: (tenantId: string, id: string) =>
    request(`/onboarding/${tenantId}/${id}/audit`),
};
