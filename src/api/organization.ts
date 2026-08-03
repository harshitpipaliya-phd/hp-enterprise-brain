import { request } from './client.js';
import { getAuthTenantId } from '../utils/tenant.js';

/**
 * Organizations are read from the institute ERP (institute_detail joined to
 * org_details), not from a Brain-owned table — see OrganizationRepository.
 * Two consequences the UI has to absorb:
 *
 * 1. The rows come back in the ERP's snake_case with `sub_institute_id` aliased
 *    to `id`. normalize() maps them onto the camelCase Organization shape the
 *    components consume. Without this, org.orgCode / org.createdDate and, worse,
 *    org.tenantId were all undefined — and an undefined tenantId is what every
 *    downstream screen was interpolating into its URL.
 *
 * 2. The ERP has no country / timezone / currency / status columns. Those come
 *    back null rather than being invented; the detail screen renders '—'.
 *
 * The list endpoint ignores its {tenantId} segment and returns every
 * organization, so the caller gets all of them regardless of the tenant passed.
 */
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
    // An organization IS its own tenant: the Brain stores hpbrain_* rows under
    // tenant_id = sub_institute_id, which is exactly this id. Stamping it here
    // is what makes every downstream screen — which builds its URLs from
    // org.tenantId — read the right organization's data. The tenant the list
    // was fetched under is irrelevant to the rows it returns.
    tenantId: id,
    name: row.name ?? row.organization_name ?? '',
    legalName: row.legal_name ?? row.legalName ?? null,
    orgCode: row.org_code ?? row.orgCode ?? '',
    industry: row.industry ?? row.industry_type ?? null,
    country: row.country ?? null,
    timezone: row.timezone ?? null,
    currency: row.currency ?? null,
    logo: row.logo ?? null,
    // The repository already filters `deleted_at IS NULL`, so anything that
    // comes back is live. Archived rows simply stop appearing.
    status: row.status ?? 'active',
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
  };
}

export const api = {
  /** GET /api/v1/organizations/{tenantId} — returns only the requested organization. */
  listOrganizations: async (tenantId: string = getAuthTenantId()): Promise<OrganizationRow[]> => {
    const rows = await request(`/organizations/${tenantId}`);
    return Array.isArray(rows) ? rows.map((r) => normalize(r, tenantId)) : [];
  },

  /** GET /api/v1/organizations/{tenantId}/{id} */
  getOrganization: async (tenantId: string, id: string): Promise<OrganizationRow> =>
    normalize(await request(`/organizations/${tenantId}/${id}`), tenantId),

  /** POST /api/v1/organizations */
  createOrganization: async (body: Record<string, unknown>, tenantId: string = getAuthTenantId()): Promise<OrganizationRow> => {
    const created = await request('/organizations', { method: 'POST', body: JSON.stringify(body) });
    // store() echoes its validated input plus the new id rather than re-reading
    // the row, so read it back to get the ERP's canonical values (timestamps in
    // particular) instead of the ones we sent.
    try {
      return await api.getOrganization(tenantId, String(created.id));
    } catch {
      return normalize(created, tenantId);
    }
  },

  /** PATCH /api/v1/organizations/{tenantId}/{id} — responds {ok:true}, so re-read. */
  updateOrganization: async (tenantId: string, id: string, body: Record<string, unknown>): Promise<OrganizationRow> => {
    await request(`/organizations/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getOrganization(tenantId, id);
  },

  /**
   * POST /api/v1/organizations/{tenantId}/{id}/archive — soft delete. The row
   * is excluded from every subsequent read, so there is nothing to re-read;
   * callers reload the list.
   */
  archiveOrganization: (tenantId: string, id: string) =>
    request(`/organizations/${tenantId}/${id}/archive`, { method: 'POST' }),

  /** GET /api/v1/organizations/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/organizations/${tenantId}/${id}/audit`),
};
