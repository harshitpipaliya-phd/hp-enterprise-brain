import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

export interface OrganizationRow {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  orgCode: string;
  industry: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  logo: string | null;
  status: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

function normalize(row: any, _listedUnder: string): OrganizationRow {
  const id = String(row.id ?? row.sub_institute_id ?? '');

  return {
    id,
    tenantId: id,
    name: row.name ?? row.organization_name ?? '',
    legalName: row.legal_name ?? row.legalName ?? null,
    orgCode: row.org_code ?? row.orgCode ?? '',
    industry: row.industry ?? row.industry_type ?? null,
    country: row.country ?? null,
    timezone: row.timezone ?? null,
    currency: row.currency ?? null,
    logo: row.logo ?? null,
    status: row.status ?? 'active',
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

function scopedTenant(fallback: string): string {
  return getAuthTenantId() || fallback;
}

export const api = {
  /** GET /api/v1/organizations/{tenantId} - scoped to the logged-in organization. */
  listOrganizations: async (tenantId: string = getAuthTenantId()): Promise<OrganizationRow[]> => {
    const tenant = scopedTenant(tenantId);
    const rows = await request(`/organizations/${tenant}`);
    return Array.isArray(rows) ? rows.map((r) => normalize(r, tenant)).filter((org) => org.id === tenant) : [];
  },

  /** GET /api/v1/organizations/{tenantId}/{id} */
  getOrganization: async (tenantId: string, _id: string): Promise<OrganizationRow> => {
    const tenant = scopedTenant(tenantId);
    return normalize(await request(`/organizations/${tenant}/${tenant}`), tenant);
  },

  /** POST /api/v1/organizations */
  createOrganization: async (body: Record<string, unknown>, tenantId: string = getAuthTenantId()): Promise<OrganizationRow> => {
    const tenant = scopedTenant(tenantId);
    const created = await request('/organizations', { method: 'POST', body: JSON.stringify(body) });
    try {
      return await api.getOrganization(tenant, String(created.id));
    } catch {
      return normalize(created, tenant);
    }
  },

  /** PATCH /api/v1/organizations/{tenantId}/{id} - responds {ok:true}, so re-read. */
  updateOrganization: async (tenantId: string, _id: string, body: Record<string, unknown>): Promise<OrganizationRow> => {
    const tenant = scopedTenant(tenantId);
    await request(`/organizations/${tenant}/${tenant}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getOrganization(tenant, tenant);
  },

  /** POST /api/v1/organizations/{tenantId}/{id}/archive */
  archiveOrganization: (tenantId: string, _id: string) => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}/archive`, { method: 'POST' });
  },

  /** GET /api/v1/organizations/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, _id: string) => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}/audit`);
  },

  /** Organization hierarchy and department headcount, scoped by the API. */
  getStructure: (tenantId: string, _id: string) => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}/structure`);
  },

  /** Source-system completeness findings for the selected organization. */
  getDataQuality: (tenantId: string, _id: string) => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}/data-quality`);
  },
};
