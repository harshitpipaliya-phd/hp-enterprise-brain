import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

/**
 * Every organization field the product knows how to show and edit.
 *
 * WHICH OF THEM A GIVEN TENANT ACTUALLY HAS is not a property of this type — it
 * is `profileFields` / `identityFields` below, computed per tenant by the server
 * from the entity mapping and the physical schema of the source table. A field
 * absent from those lists is one this organization's system of record has no
 * column for, and the screens omit it rather than printing "Not recorded"
 * against something that can never be recorded.
 */
export type OrganizationField =
  | 'name'
  | 'orgCode'
  | 'industry'
  | 'legalName'
  | 'registrationNumber'
  | 'taxId'
  | 'country'
  | 'address'
  | 'email'
  | 'phone'
  | 'website'
  | 'contactPerson'
  | 'employeeCount'
  | 'workWeek'
  | 'logo';

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
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  registrationNumber: string | null;
  /** Company/tax registration the ERP keeps beside the legal name (GSTIN, VAT…). */
  taxId: string | null;
  /** The named human the source system records as the point of contact. */
  contactPerson: string | null;
  /**
   * A BAND, NOT A COUNT. Source systems record this as the range an onboarding
   * form asked for ('51-200'), so it is a string and must never be summed,
   * compared numerically, or rendered beside a real headcount as if the two
   * measured the same thing.
   */
  employeeCount: string | null;
  /** e.g. 'mon-fri', 'mon-sat' — what "a working week" means for this tenant. */
  workWeek: string | null;
  logo: string | null;
  status: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
  /**
   * The profile fields this tenant's source system can hold, server-computed.
   * Empty when the server is older than this client, which the screens read as
   * "assume the classic three" rather than "this organization has nothing".
   */
  profileFields: OrganizationField[];
  /** The identity fields (name / code / industry) the register itself carries. */
  identityFields: OrganizationField[];
}

/** One table in a deletion plan, as the preview endpoint reports it. */
export interface DeletionPreviewTable {
  table: string;
  column: string;
  /**
   * 'brain'         — hpbrain_-owned, created by this application
   * 'identity'      — the organization and its logins inside the shared ERP
   * 'source_system' — tenant-scoped rows owned by ANOTHER application sharing
   *                   this database; needs a separate acknowledgement
   */
  tier: 'brain' | 'identity' | 'source_system' | 'preserved';
  rows: number;
}

export interface DeletionPreview {
  tenantId: string;
  organizationName: string;
  totals: {
    rows: number;
    tables: number;
    brain: number;
    identity: number;
    sourceSystem: number;
  };
  tables: DeletionPreviewTable[];
  /**
   * Rows in tables this organization does NOT own directly, reached through a
   * foreign key into one it does — a junction table with no tenant column of
   * its own. Reported apart from `tables` because they are a different kind of
   * thing, and counted in `totals.rows` because they are destroyed too.
   */
  dependents?: Array<{ table: string; column: string; via: string; tier: DeletionPreviewTable['tier']; rows: number }>;
  /** Expected tables discovery did not find — a migration or config warning. */
  missingReferences: string[];
}

export interface DeletionResult {
  ok: true;
  tenantId: string;
  organizationName: string;
  tables: number;
  rows: number;
  deleted: Record<string, number>;
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
    email: row.email ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    address: row.address ?? null,
    registrationNumber: row.registration_number ?? row.registrationNumber ?? null,
    taxId: row.tax_id ?? row.taxId ?? null,
    contactPerson: row.contact_person ?? row.contactPerson ?? null,
    employeeCount: emptyToNull(row.employee_count ?? row.employeeCount),
    workWeek: emptyToNull(row.work_week ?? row.workWeek),
    logo: row.logo ?? null,
    status: row.status ?? 'active',
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    createdDate: row.created_date ?? row.createdDate ?? '',
    updatedDate: row.updated_date ?? row.updatedDate ?? '',
    profileFields: fieldList(row.profile_fields ?? row.profileFields),
    identityFields: fieldList(row.identity_fields ?? row.identityFields, DEFAULT_IDENTITY_FIELDS),
  };
}

/**
 * A server older than this client publishes no capability list. Falling back to
 * the three fields every organization register has ever had keeps the edit form
 * usable instead of empty, and is the smallest claim that can be made safely.
 */
const DEFAULT_IDENTITY_FIELDS: OrganizationField[] = ['name', 'orgCode', 'industry'];

function fieldList(value: unknown, fallback: OrganizationField[] = []): OrganizationField[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((entry) => (entry === 'code' ? 'orgCode' : String(entry))) as OrganizationField[];
}

/**
 * '' and '0' are what an ERP writes into an optional text column nobody filled
 * in. Carrying them through would put an empty row on the screen, which is the
 * "meaningless 0" the profile panel exists to avoid.
 */
function emptyToNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text === '' || text === '0' ? null : text;
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

  /**
   * POST /api/v1/organizations/{tenantId}/{id}/archive
   *
   * SOFT DELETE. Sets deleted_at on the organization row so it drops out of the
   * list, and destroys nothing. Kept, unchanged, because it is still the right
   * operation for taking an organization out of circulation — it is simply not
   * a deletion, which is what deleteOrganizationPermanently below is for.
   */
  archiveOrganization: (tenantId: string, _id: string) => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}/archive`, { method: 'POST' });
  },

  /**
   * GET /api/v1/organizations/{tenantId}/{id}/deletion-preview
   *
   * Exactly what a permanent deletion would destroy, per table and per tier.
   * Reads only, so it is safe to call when the confirmation dialog opens —
   * which is the point: an administrator should see the real row counts before
   * typing the organization's name, not after.
   */
  getDeletionPreview: (tenantId: string, _id?: string): Promise<DeletionPreview> => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}/deletion-preview`);
  },

  /**
   * DELETE /api/v1/organizations/{tenantId}/{id}
   *
   * PERMANENT AND IRREVERSIBLE. Destroys the organization, every record its
   * tenant owns, and every login belonging to it, in one transaction. A
   * non-2xx means nothing was deleted at all.
   *
   * NOT the archive endpoint above, and deliberately a different function:
   * pointing this at /archive is the exact bug this replaces.
   */
  deleteOrganizationPermanently: (
    tenantId: string,
    confirmName: string,
    acknowledgeSourceSystemData = false,
  ): Promise<DeletionResult> => {
    const tenant = scopedTenant(tenantId);
    return request(`/organizations/${tenant}/${tenant}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName, acknowledgeSourceSystemData }),
    });
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
