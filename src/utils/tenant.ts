/**
 * The tenant is the selected organization's sub_institute_id.
 *
 * That is how the data is actually stored — hpbrain_signals and hpbrain_cases
 * hold tenant_id '6', which is Scholar Clone's id in institute_detail. Reading
 * them under any other tenant returns an empty list, not an error, which is why
 * the intelligence screens looked unseeded when they were not.
 *
 * This only works because EnsureTenantScope now lets an admin token address any
 * organization that exists, instead of pinning every request to the single
 * tenant claim baked into the token. A non-admin is still confined to its own
 * tenant, and an organization that does not exist is still a 403.
 */

const SELECTED_ORG_KEY = 'selectedOrgId';

/** Falls back to the first organization the ERP seeds (Scholar Clone). */
const DEFAULT_ORG_ID: string = import.meta.env.VITE_DEFAULT_ORG_ID || '6';

/** Tenant the dev-bypass token carries; see AuthenticateJwt::handle(). */
const DEV_BYPASS_TENANT: string = import.meta.env.VITE_AUTH_TENANT_ID || 'demo-tenant';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * The tenant segment for every /api/v1/{resource}/{tenantId} call: the selected
 * organization's sub_institute_id.
 */
export function getTenantId(): string {
  return getSelectedOrgId();
}

/**
 * The tenant the bearer token itself carries. Used for the one call that has to
 * happen BEFORE an organization is chosen — listing the organizations — since
 * at that point there is no selection to derive a tenant from. The endpoint
 * ignores its tenant segment and returns all organizations regardless.
 */
export function getAuthTenantId(): string {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const claims = decodeJwtPayload(token);
    if (typeof claims?.tenantId === 'string' && claims.tenantId !== '') {
      return claims.tenantId;
    }
  }
  return DEV_BYPASS_TENANT;
}

/** The selected organization's sub_institute_id. */
export function getSelectedOrgId(): string {
  return localStorage.getItem(SELECTED_ORG_KEY) || DEFAULT_ORG_ID;
}

export function setSelectedOrgId(orgId: string | number): void {
  localStorage.setItem(SELECTED_ORG_KEY, String(orgId));
}

export function clearSelectedOrgId(): void {
  localStorage.removeItem(SELECTED_ORG_KEY);
}

export function hasSelectedOrg(): boolean {
  return localStorage.getItem(SELECTED_ORG_KEY) !== null;
}
