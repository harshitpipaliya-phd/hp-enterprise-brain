import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CommandCenter from '../src/components/workspace/CommandCenter';

/**
 * The Delete Organization flow on the organization overview.
 *
 * TWO CLAIMS ARE UNDER TEST AND THE SECOND IS THE IMPORTANT ONE:
 *
 *   1. "Delete Permanently" stays disabled until the organization's exact name
 *      has been typed.
 *   2. Confirming calls the PERMANENT DELETE endpoint and never the archive
 *      endpoint. Pointing the delete button at /archive is precisely the bug
 *      this work replaces, and it is the kind of regression that reintroduces
 *      itself quietly — the UI behaves identically either way, right up until
 *      someone checks whether the data is actually gone.
 *
 * archiveOrganization is therefore mocked and asserted NEVER to have been
 * called, rather than simply left out of the mock. Omitting it would make the
 * test pass by crashing, which proves nothing.
 */

const getHomeMetrics = vi.fn();
const listCapabilities = vi.fn();
const listDepartments = vi.fn();
const getStructure = vi.fn();
const getDataQuality = vi.fn();
const getAuditLogs = vi.fn();
const updateOrganization = vi.fn();
const archiveOrganization = vi.fn();
const getDeletionPreview = vi.fn();
const deleteOrganizationPermanently = vi.fn();
const listSources = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: { getHomeMetrics: (...a: unknown[]) => getHomeMetrics(...a) },
}));

vi.mock('../src/api/capability', () => ({
  api: { listCapabilities: (...a: unknown[]) => listCapabilities(...a) },
}));

vi.mock('../src/api/department', () => ({
  api: { listDepartments: (...a: unknown[]) => listDepartments(...a) },
}));

vi.mock('../src/api/organization', () => ({
  api: {
    getStructure: (...a: unknown[]) => getStructure(...a),
    getDataQuality: (...a: unknown[]) => getDataQuality(...a),
    getAuditLogs: (...a: unknown[]) => getAuditLogs(...a),
    updateOrganization: (...a: unknown[]) => updateOrganization(...a),
    archiveOrganization: (...a: unknown[]) => archiveOrganization(...a),
    getDeletionPreview: (...a: unknown[]) => getDeletionPreview(...a),
    deleteOrganizationPermanently: (...a: unknown[]) => deleteOrganizationPermanently(...a),
  },
}));

vi.mock('../src/api/ingestion', () => ({
  ingestionApi: { listSources: (...a: unknown[]) => listSources(...a) },
}));

const ORG_NAME = 'Sunrise International School';

const organization = {
  id: '1000000',
  tenantId: '1000000',
  name: ORG_NAME,
  legalName: 'Sunrise International School Trust',
  orgCode: 'SIS',
  industry: 'education',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  logo: null,
  status: 'active',
  createdBy: 'system',
  createdDate: '2026-08-01T00:00:00Z',
  updatedDate: '2026-08-10T00:00:00Z',
};

const PREVIEW = {
  tenantId: '1000000',
  organizationName: ORG_NAME,
  totals: { rows: 12592, tables: 15, brain: 12000, identity: 592, sourceSystem: 0 },
  tables: [
    { table: 'hpbrain_operational_records', column: 'tenant_id', tier: 'brain', rows: 10430 },
    { table: 'tbluser', column: 'sub_institute_id', tier: 'identity', rows: 3 },
  ],
  missingReferences: [],
};

async function openDeleteDialog() {
  render(
    <CommandCenter
      tenantId={organization.tenantId}
      organizationName={organization.name}
      organization={organization as never}
      onNavigate={vi.fn()}
    />,
  );

  await screen.findByText(ORG_NAME);
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
  await screen.findByRole('dialog');
}

/** The confirm button, by its new label. */
function deleteButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Delete Permanently/i }) as HTMLButtonElement;
}

function nameInput(): HTMLInputElement {
  return screen.getByPlaceholderText('Type organization name') as HTMLInputElement;
}

describe('permanent organization deletion', () => {
  beforeEach(() => {
    getHomeMetrics.mockReset().mockResolvedValue({
      erp: {
        activePeople: 1001, activeDepartments: 12, peopleWithoutDepartment: 4,
        departmentsWithoutManager: 0, peopleWithoutProfile: 0,
      },
      pipeline: { stage: 'signals_detected', blocker: null, nextAction: null, counts: {} },
      attention: [],
      dataFreshness: { erp: 'live', brain: '2026-08-14 00:00:00' },
    });
    listCapabilities.mockReset().mockResolvedValue([]);
    listDepartments.mockReset().mockResolvedValue([]);
    getStructure.mockReset().mockResolvedValue({ departments: [], peopleByDepartment: {}, heads: {} });
    getDataQuality.mockReset().mockResolvedValue({ score: 88, totalPeople: 3, totalDepartments: 1, issues: [] });
    getAuditLogs.mockReset().mockResolvedValue([]);
    listSources.mockReset().mockResolvedValue([]);
    updateOrganization.mockReset();
    archiveOrganization.mockReset().mockResolvedValue({ ok: true });
    getDeletionPreview.mockReset().mockResolvedValue(PREVIEW);
    deleteOrganizationPermanently.mockReset().mockResolvedValue({
      ok: true, tenantId: '1000000', organizationName: ORG_NAME,
      tables: 15, rows: 12592, deleted: {},
    });
  });

  /* ─────────── TEST 8 — exact-name confirmation ─────────── */

  it('keeps Delete Permanently disabled until the exact organization name is typed', async () => {
    await openDeleteDialog();

    expect(deleteButton().disabled).toBe(true);

    for (const wrong of [
      'Sunrise',
      'sunrise international school',
      'SUNRISE INTERNATIONAL SCHOOL',
      'Sunrise International Schoo',
      'Lions School',
    ]) {
      fireEvent.change(nameInput(), { target: { value: wrong } });
      expect(deleteButton().disabled).toBe(true);
    }

    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    expect(deleteButton().disabled).toBe(false);
  });

  it('does not call any deletion endpoint while the name is still wrong', async () => {
    await openDeleteDialog();

    fireEvent.change(nameInput(), { target: { value: 'Sunrise' } });
    fireEvent.click(deleteButton());

    expect(deleteOrganizationPermanently).not.toHaveBeenCalled();
    expect(archiveOrganization).not.toHaveBeenCalled();
  });

  /* ─────────── TEST 9 — not the archive endpoint ─────────── */

  it('calls the permanent delete endpoint and never the archive endpoint', async () => {
    await openDeleteDialog();

    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    fireEvent.click(deleteButton());

    await waitFor(() => expect(deleteOrganizationPermanently).toHaveBeenCalledTimes(1));

    expect(deleteOrganizationPermanently).toHaveBeenCalledWith('1000000', ORG_NAME, false);
    expect(archiveOrganization).not.toHaveBeenCalled();
  });

  it('reports the deletion upward so the caller can leave the dead tenant', async () => {
    const onDeleted = vi.fn();

    render(
      <CommandCenter
        tenantId={organization.tenantId}
        organizationName={organization.name}
        organization={organization as never}
        onNavigate={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    await screen.findByText(ORG_NAME);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    await screen.findByRole('dialog');

    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    fireEvent.click(deleteButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));

    expect(onDeleted.mock.calls[0][0].name).toBe(ORG_NAME);
    expect(onDeleted.mock.calls[0][1].rows).toBe(12592);
  });

  /* ─────────── the dialog itself ─────────── */

  it('states that the deletion is permanent and shows what will be destroyed', async () => {
    await openDeleteDialog();

    expect(screen.getByText('Delete Organization?')).toBeTruthy();
    // Both the question and the warning say "permanently delete" — that is the
    // point, so assert on both rather than on one and matching two.
    expect(screen.getAllByText(/permanently delete/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/This action cannot be undone/i)).toBeTruthy();

    // The old copy promised the opposite. It must be gone.
    expect(screen.queryByText(/archives the organization/i)).toBeNull();
    expect(screen.queryByText(/is not deleted/i)).toBeNull();

    await waitFor(() => expect(screen.getByText(/12,592/)).toBeTruthy());
  });

  it('loads the preview when the dialog opens and deletes nothing doing so', async () => {
    await openDeleteDialog();

    await waitFor(() => expect(getDeletionPreview).toHaveBeenCalledTimes(1));

    expect(deleteOrganizationPermanently).not.toHaveBeenCalled();
    expect(archiveOrganization).not.toHaveBeenCalled();
  });

  /* ─────────── source-system acknowledgement ─────────── */

  it('requires an explicit acknowledgement when other systems hold this tenant\'s rows', async () => {
    deleteOrganizationPermanently.mockRejectedValueOnce(
      Object.assign(new Error('source_system_data_present'), {
        status: 409,
        responseJson: {
          error: 'source_system_data_present',
          message: 'This organization holds 6613 row(s) in 24 table(s) belonging to other applications.',
          tables: [{ table: 'lms_course_enroll', column: 'sub_institute_id', tier: 'source_system', rows: 12 }],
          rows: 6613,
        },
      }),
    );

    await openDeleteDialog();
    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    fireEvent.click(deleteButton());

    // The refusal is rendered as a question, with the tables named.
    await screen.findByText(/belonging to other applications/i);
    expect(screen.getByText('lms_course_enroll')).toBeTruthy();

    // And the button is blocked again until the box is ticked.
    expect(deleteButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(deleteButton().disabled).toBe(false);

    fireEvent.click(deleteButton());

    await waitFor(() => expect(deleteOrganizationPermanently).toHaveBeenCalledTimes(2));
    expect(deleteOrganizationPermanently).toHaveBeenLastCalledWith('1000000', ORG_NAME, true);
  });

  /* ─────────── canonical name wins over stale session state ─────────── */

  describe('when session state carries a stale or placeholder name', () => {
    // Exactly the live situation for tenant 8: archived through the old flow,
    // so login handed the SPA a manufactured "Organization 8" while the
    // database — and therefore the deletion preview — said "Lions".
    const STALE = { ...organization, name: 'Organization 8' };
    const CANONICAL = 'Lions';

    beforeEach(() => {
      getDeletionPreview.mockResolvedValue({ ...PREVIEW, organizationName: CANONICAL });
    });

    async function openWithStaleName(onDeleted = vi.fn()) {
      render(
        <CommandCenter
          tenantId={STALE.tenantId}
          organizationName={STALE.name}
          organization={STALE as never}
          onNavigate={vi.fn()}
          onDeleted={onDeleted}
        />,
      );
      fireEvent.click(await screen.findByRole('button', { name: /^Delete$/ }));
      await screen.findByRole('dialog');
      // Wait for the canonical name to arrive before asserting on it.
      await waitFor(() => expect(getDeletionPreview).toHaveBeenCalled());
      return onDeleted;
    }

    it('displays the canonical name from the preview, not the stale session name', async () => {
      await openWithStaleName();

      // Scoped to the dialog on purpose. The page heading behind it still shows
      // whatever the session holds; what must never be wrong is the name the
      // confirmation is asking for.
      const dialog = within(screen.getByRole('dialog'));
      await waitFor(() => expect(dialog.getAllByText(CANONICAL).length).toBeGreaterThan(0));
      expect(dialog.queryByText('Organization 8')).toBeNull();
    });

    it('refuses the stale placeholder name', async () => {
      await openWithStaleName();
      await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByText(CANONICAL).length).toBeGreaterThan(0));

      fireEvent.change(nameInput(), { target: { value: 'Organization 8' } });
      expect(deleteButton().disabled).toBe(true);

      fireEvent.click(deleteButton());
      expect(deleteOrganizationPermanently).not.toHaveBeenCalled();
    });

    it('accepts the canonical name and sends it', async () => {
      await openWithStaleName();
      await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByText(CANONICAL).length).toBeGreaterThan(0));

      fireEvent.change(nameInput(), { target: { value: CANONICAL } });
      expect(deleteButton().disabled).toBe(false);

      fireEvent.click(deleteButton());

      await waitFor(() => expect(deleteOrganizationPermanently).toHaveBeenCalledTimes(1));
      expect(deleteOrganizationPermanently).toHaveBeenCalledWith('1000000', CANONICAL, false);
    });

    it('stays disabled while the canonical name is still unknown', async () => {
      // Preview never resolves: there is no safe string to compare against, so
      // the dialog must not allow a deletion on the strength of a guess.
      getDeletionPreview.mockReturnValue(new Promise(() => {}));

      render(
        <CommandCenter
          tenantId={STALE.tenantId}
          organizationName={STALE.name}
          organization={STALE as never}
          onNavigate={vi.fn()}
        />,
      );
      fireEvent.click(await screen.findByRole('button', { name: /^Delete$/ }));
      await screen.findByRole('dialog');

      expect(deleteButton().disabled).toBe(true);
      expect((screen.getByPlaceholderText('Type organization name') as HTMLInputElement).disabled).toBe(true);
    });
  });

  /* ─────────── failure ─────────── */

  it('shows the error and does not report success when the server refuses', async () => {
    const onDeleted = vi.fn();
    deleteOrganizationPermanently.mockRejectedValueOnce(
      Object.assign(new Error('deletion_failed'), {
        status: 500,
        responseJson: {
          error: 'deletion_failed',
          message: 'The organization was NOT deleted. Every change has been rolled back.',
        },
      }),
    );

    render(
      <CommandCenter
        tenantId={organization.tenantId}
        organizationName={organization.name}
        organization={organization as never}
        onNavigate={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    await screen.findByText(ORG_NAME);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    await screen.findByRole('dialog');

    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    fireEvent.click(deleteButton());

    await screen.findByText(/rolled back/i);

    // The dialog stays open and nothing upstream is told the org is gone.
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
