import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTenantId,
  getAuthTenantId,
  getSelectedOrgId,
  setSelectedOrgId,
  clearSelectedOrgId,
  hasSelectedOrg,
} from '../src/utils/tenant';

/**
 * Two identifiers, deliberately separate:
 *
 *   getTenantId()     — the {tenantId} URL segment. It is the SELECTED
 *                       ORGANIZATION's sub_institute_id, because that is how the
 *                       Brain stores its rows (hpbrain_signals.tenant_id = '6'
 *                       is Scholar Clone). Reading them under any other tenant
 *                       returns an empty list rather than an error, which is the
 *                       failure mode these tests exist to prevent regressing.
 *
 *   getAuthTenantId() — the tenant claim carried by the access token. Used only
 *                       for the organizations list, which has to be fetched
 *                       before any organization has been selected.
 *
 * Conflating the two is what made every intelligence screen render empty.
 */

/** Minimal unsigned JWT — only the payload is base64-decoded. */
function makeToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature-not-checked-here`;
}

describe('getAuthTenantId', () => {
  beforeEach(() => localStorage.clear());

  it('resolves the tenant from a real JWT rather than the fallback', () => {
    localStorage.setItem('accessToken', makeToken({ sub: 'u-1', tenantId: 'tenant-alpha', role: 'analyst' }));

    expect(getAuthTenantId()).toBe('tenant-alpha');
    expect(getAuthTenantId()).not.toBe('demo-tenant');
  });

  it('tracks the session: a different token yields a different tenant', () => {
    localStorage.setItem('accessToken', makeToken({ tenantId: 'tenant-alpha' }));
    expect(getAuthTenantId()).toBe('tenant-alpha');

    localStorage.setItem('accessToken', makeToken({ tenantId: 'tenant-beta' }));
    expect(getAuthTenantId()).toBe('tenant-beta');
  });

  it('decodes base64url payloads containing - and _', () => {
    // Standard base64 of this payload contains both '+' and '/', so the token
    // genuinely exercises the url-safe substitution done before atob.
    const tenantId = 'tenant-a?>~b';
    const token = makeToken({ tenantId });

    expect(token.split('.')[1]).toMatch(/[-_]/);
    localStorage.setItem('accessToken', token);

    expect(getAuthTenantId()).toBe(tenantId);
  });

  it('falls back to the dev-bypass tenant when no token is stored', () => {
    expect(getAuthTenantId()).toBe('demo-tenant');
  });

  it('falls back when the token is malformed rather than throwing', () => {
    localStorage.setItem('accessToken', 'not-a-jwt');
    expect(getAuthTenantId()).toBe('demo-tenant');

    localStorage.setItem('accessToken', 'a.!!!not-base64!!!.c');
    expect(getAuthTenantId()).toBe('demo-tenant');
  });

  it('falls back when the payload carries no tenantId claim', () => {
    localStorage.setItem('accessToken', makeToken({ sub: 'u-1', role: 'viewer' }));
    expect(getAuthTenantId()).toBe('demo-tenant');
  });

  it('ignores a non-string tenantId instead of returning a number', () => {
    localStorage.setItem('accessToken', makeToken({ tenantId: 12345 }));
    expect(getAuthTenantId()).toBe('demo-tenant');
  });
});

describe('getTenantId', () => {
  beforeEach(() => localStorage.clear());

  it('is the selected organization, not the token tenant', () => {
    localStorage.setItem('accessToken', makeToken({ tenantId: 'demo-tenant' }));
    setSelectedOrgId('6');

    expect(getTenantId()).toBe('6');
    // The distinction that matters: signals live under '6', never 'demo-tenant'.
    expect(getTenantId()).not.toBe(getAuthTenantId());
  });

  it('follows the selection when the user switches organization', () => {
    setSelectedOrgId('6');
    expect(getTenantId()).toBe('6');

    setSelectedOrgId('4');
    expect(getTenantId()).toBe('4');
  });

  it('defaults to org 6 before anything has been selected', () => {
    expect(hasSelectedOrg()).toBe(false);
    expect(getTenantId()).toBe('6');
  });

  it('accepts a numeric org id and stores it as a string', () => {
    setSelectedOrgId(4);
    expect(getSelectedOrgId()).toBe('4');
    expect(getTenantId()).toBe('4');
  });

  it('returns to the default once the selection is cleared on sign-out', () => {
    setSelectedOrgId('4');
    clearSelectedOrgId();

    expect(hasSelectedOrg()).toBe(false);
    expect(getTenantId()).toBe('6');
  });
});
