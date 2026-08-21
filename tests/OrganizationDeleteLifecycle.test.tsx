import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App';

/**
 * What happens to the SESSION when an organization is permanently deleted.
 *
 * The other delete test covers the dialog. This one covers the thing the dialog
 * cannot: after the deletion commits, the browser is still holding tokens for a
 * tenant that no longer exists. EnsureTenantScope only ever lets an
 * administrator delete their OWN organization, so there is never another tenant
 * to fall back to — the session has to be torn down and the user returned to
 * the login screen.
 *
 * Rendered through the real <App/> rather than a stub, because the assertion is
 * about App's own state machine: authenticated -> not authenticated, tokens
 * cleared, persisted session cleared, Login mounted. A stub would prove the
 * handler was called and nothing about what it did.
 */

const listOrganizations = vi.fn();
const getDeletionPreview = vi.fn();
const deleteOrganizationPermanently = vi.fn();
const archiveOrganization = vi.fn();

const getHomeMetrics = vi.fn();
const listCapabilities = vi.fn();
const listDepartments = vi.fn();
const listSources = vi.fn();
const getStructure = vi.fn();
const getDataQuality = vi.fn();
const getAuditLogs = vi.fn();

vi.mock('../src/api/organization', () => ({
  api: {
    listOrganizations: (...a: unknown[]) => listOrganizations(...a),
    getDeletionPreview: (...a: unknown[]) => getDeletionPreview(...a),
    deleteOrganizationPermanently: (...a: unknown[]) => deleteOrganizationPermanently(...a),
    archiveOrganization: (...a: unknown[]) => archiveOrganization(...a),
    getStructure: (...a: unknown[]) => getStructure(...a),
    getDataQuality: (...a: unknown[]) => getDataQuality(...a),
    getAuditLogs: (...a: unknown[]) => getAuditLogs(...a),
    updateOrganization: vi.fn(),
  },
}));

vi.mock('../src/api/intelligence', () => ({
  api: { getHomeMetrics: (...a: unknown[]) => getHomeMetrics(...a) },
}));
vi.mock('../src/api/capability', () => ({
  api: { listCapabilities: (...a: unknown[]) => listCapabilities(...a) },
}));
vi.mock('../src/api/department', () => ({
  api: { listDepartments: (...a: unknown[]) => listDepartments(...a) },
}));
vi.mock('../src/api/ingestion', () => ({
  ingestionApi: { listSources: (...a: unknown[]) => listSources(...a) },
}));

const ORG = {
  id: '8',
  tenantId: '8',
  name: 'Lions',
  legalName: 'Lions',
  orgCode: 'LIONS',
  industry: 'Education',
  country: null,
  timezone: 'UTC',
  currency: 'USD',
  logo: null,
  status: 'active',
  createdBy: 'system',
  createdDate: '2026-08-07T00:00:00Z',
  updatedDate: '2026-08-07T00:00:00Z',
};

describe('permanent deletion ends the session', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // A live workspace session for tenant 8, exactly as login would leave it.
    sessionStorage.setItem('accessToken', 'access-token-for-tenant-8');
    sessionStorage.setItem('refreshToken', 'refresh-token-for-tenant-8');
    localStorage.setItem('hpbrain-session', JSON.stringify({
      role: 'tenant_admin', userName: 'Administrator', organization: ORG, view: 'home', personId: null,
    }));

    listOrganizations.mockReset().mockResolvedValue([ORG]);
    archiveOrganization.mockReset();
    getDeletionPreview.mockReset().mockResolvedValue({
      tenantId: '8',
      organizationName: 'Lions',
      totals: { rows: 19221, tables: 41, brain: 12607, identity: 36, sourceSystem: 0 },
      tables: [],
      missingReferences: [],
    });
    deleteOrganizationPermanently.mockReset().mockResolvedValue({
      ok: true, tenantId: '8', organizationName: 'Lions', tables: 42, rows: 19224, deleted: {},
    });

    getHomeMetrics.mockReset().mockResolvedValue({
      erp: { activePeople: 3, activeDepartments: 19, peopleWithoutDepartment: 0, departmentsWithoutManager: 0, peopleWithoutProfile: 0 },
      pipeline: { stage: 'signals_detected', blocker: null, nextAction: null, counts: {} },
      attention: [],
      dataFreshness: { erp: 'live', brain: null },
    });
    listCapabilities.mockReset().mockResolvedValue([]);
    listDepartments.mockReset().mockResolvedValue([]);
    listSources.mockReset().mockResolvedValue([]);
    getStructure.mockReset().mockResolvedValue({ departments: [], peopleByDepartment: {}, heads: {} });
    getDataQuality.mockReset().mockResolvedValue({ score: 100, totalPeople: 0, totalDepartments: 0, issues: [] });
    getAuditLogs.mockReset().mockResolvedValue([]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  async function deleteFromTheUi() {
    render(<App />);

    // Boots straight into the workspace, because tokens are present.
    await screen.findByRole('button', { name: /^Delete$/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(getDeletionPreview).toHaveBeenCalled());
    await waitFor(() => expect(within(dialog).getAllByText('Lions').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Type organization name'), { target: { value: 'Lions' } });
    fireEvent.click(screen.getByRole('button', { name: /Delete Permanently/i }));

    await waitFor(() => expect(deleteOrganizationPermanently).toHaveBeenCalledTimes(1));
  }

  /* ─────────── TEST 12 — redirect to login ─────────── */

  it('returns the browser to the login screen', async () => {
    await deleteFromTheUi();

    await screen.findByText('Welcome back', {}, { timeout: 5000 });
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeTruthy();
  });

  it('clears the access and refresh tokens', async () => {
    await deleteFromTheUi();

    await waitFor(() => {
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(sessionStorage.getItem('accessToken')).toBeNull();
      expect(sessionStorage.getItem('refreshToken')).toBeNull();
    });
  });

  it('clears the persisted workspace session so a reload cannot restore the dead tenant', async () => {
    await deleteFromTheUi();

    await waitFor(() => expect(localStorage.getItem('hpbrain-session')).toBeNull());
  });

  it('does not call the server logout endpoint — those tokens no longer exist', async () => {
    await deleteFromTheUi();

    await screen.findByText('Welcome back', {}, { timeout: 5000 });

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const logoutCalls = calls.filter((c) => String(c[0]).includes('/auth/logout'));
    expect(logoutCalls).toHaveLength(0);
  });

  it('never shows the deleted organization workspace again', async () => {
    await deleteFromTheUi();

    await screen.findByText('Welcome back', {}, { timeout: 5000 });

    // No workspace chrome, and no stale organization name flashing behind the
    // login form.
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /* ─────────── failure must NOT log the user out ─────────── */

  it('keeps the session when the deletion fails', async () => {
    deleteOrganizationPermanently.mockRejectedValueOnce(
      Object.assign(new Error('deletion_failed'), {
        status: 500,
        responseJson: { error: 'deletion_failed', message: 'The organization was NOT deleted. Rolled back.' },
      }),
    );

    render(<App />);
    await screen.findByRole('button', { name: /^Delete$/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getAllByText('Lions').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Type organization name'), { target: { value: 'Lions' } });
    fireEvent.click(screen.getByRole('button', { name: /Delete Permanently/i }));

    await screen.findByText(/NOT deleted/i);

    // Still signed in, still holding the session.
    expect(sessionStorage.getItem('accessToken')).toBe('access-token-for-tenant-8');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(screen.queryByText('Welcome back')).toBeNull();
  });
});
