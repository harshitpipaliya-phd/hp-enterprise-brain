import { getAccessToken } from './authTokens';

/**
 * The tenant is the selected organization's sub_institute_id.
 *
 * That is how the data is actually stored — hpbrain_signals and hpbrain_cases
 * hold tenant_id '6', which is Scholar Clone's id in institute_detail.
 *
 * CORRECTION, VERIFIED AGAINST THE RUNNING SERVER. The paragraph that stood here
 * said "EnsureTenantScope now lets an admin token address any organization that
 * exists, instead of pinning every request to the single tenant claim baked into
 * the token". That is not what the middleware does. It compares the route's
 * {tenantId} against the token claim and returns 403 on any mismatch, with no
 * branch for role — confirmed by probing thirteen endpoint families in both
 * directions between two real tenants, every one of which answered 403. The
 * test that asserted the widening (ApiAuthorizationTest::an_admin_may_address_an_
 * organization_that_exists) fails for that reason.
 *
 * WHICH GETTER TO USE. `getAuthTenantId()` reads the tenant claim out of the JWT
 * and is the only one production code should use — every api/*.ts module already
 * routes through it via its own `scopedTenant()`. `getTenantId()` below prefers
 * the id in localStorage and falls back to the claim; because the middleware
 * pins to the claim, any call it made with a DIFFERENT selected id would 403.
 * Nothing outside tenant.test.ts calls it. See that test and the note in the
 * verification report before reaching for it.
 */

const SELECTED_ORG_KEY = 'selectedOrgId';

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

export function getTenantId(): string {
  const selected = getSelectedOrgId();
  if (selected) return selected;

  const token = getAccessToken();
  if (token) {
    const claims = decodeJwtPayload(token);
    if (typeof claims?.tenantId === 'string' && claims.tenantId !== '') {
      return claims.tenantId;
    }
  }

  return '';
}

export function getAuthTenantId(): string {
  const token = getAccessToken();
  if (token) {
    const claims = decodeJwtPayload(token);
    if (typeof claims?.tenantId === 'string' && claims.tenantId !== '') {
      return claims.tenantId;
    }
  }

  return '';
}

export function getSelectedOrgId(): string {
  return localStorage.getItem(SELECTED_ORG_KEY) || '';
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
