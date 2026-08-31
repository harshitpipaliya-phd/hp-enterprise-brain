import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CommandCenter from '../src/components/workspace/CommandCenter';
import Settings from '../src/components/workspace/Settings';

const getHomeMetrics = vi.fn();
const listCapabilities = vi.fn();
const getStructure = vi.fn();
const getDataQuality = vi.fn();
const getAuditLogs = vi.fn();
const updateOrganization = vi.fn();
const archiveOrganization = vi.fn();
const getDeletionPreview = vi.fn();
const deleteOrganizationPermanently = vi.fn();
const listSources = vi.fn();
const listSettings = vi.fn();
const setSettings = vi.fn();
const changePassword = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: { getHomeMetrics: (...a: unknown[]) => getHomeMetrics(...a) },
}));

vi.mock('../src/api/capability', () => ({
  api: { listCapabilities: (...a: unknown[]) => listCapabilities(...a) },
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

vi.mock('../src/api/notification', () => ({
  settingsApi: {
    list: (...a: unknown[]) => listSettings(...a),
    set: (...a: unknown[]) => setSettings(...a),
  },
  authApi: { changePassword: (...a: unknown[]) => changePassword(...a) },
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
  email: null,
  phone: null,
  website: null,
  address: null,
  registrationNumber: null,
  taxId: null,
  contactPerson: null,
  employeeCount: null,
  workWeek: null,
  logo: null,
  status: 'active',
  createdBy: 'system',
  createdDate: '2026-08-01T00:00:00Z',
  updatedDate: '2026-08-10T00:00:00Z',
  profileFields: [],
  identityFields: [],
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

function renderSettings(overrides: Record<string, unknown> = {}) {
  return render(
    <Settings
      tenantId={organization.tenantId}
      organizationName={organization.name}
      orgStatus={organization.status}
      organization={organization as never}
      {...overrides}
    />,
  );
}

async function openDeleteDialog() {
  renderSettings();

  await screen.findByText('Danger Zone');
  fireEvent.click(screen.getByRole('button', { name: /Delete Organization/i }));
  await screen.findByRole('dialog', {}, { timeout: 5000 });
}

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
    });
    listCapabilities.mockReset().mockResolvedValue([]);
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
    listSettings.mockReset().mockResolvedValue([]);
    setSettings.mockReset().mockResolvedValue({ ok: true });
    changePassword.mockReset().mockResolvedValue({ ok: true });
  });

  it('does not render a permanent delete action in the organization overview header', async () => {
    render(
      <CommandCenter
        tenantId={organization.tenantId}
        organizationName={organization.name}
        organization={organization as never}
        onNavigate={vi.fn()}
      />,
    );

    await screen.findByText(ORG_NAME, {}, { timeout: 5000 });

    expect(screen.queryByRole('button', { name: /^Delete$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete Organization/i })).toBeNull();
    expect(deleteOrganizationPermanently).not.toHaveBeenCalled();
  });

  it('places permanent deletion in Settings danger zone', async () => {
    renderSettings();

    expect(await screen.findByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('Delete organization')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete Organization/i })).toBeTruthy();
  });

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

  it('calls the permanent delete endpoint and reports deletion upward for session teardown', async () => {
    const onDeleted = vi.fn();
    renderSettings({ onDeleted });

    fireEvent.click(await screen.findByRole('button', { name: /Delete Organization/i }));
    await screen.findByRole('dialog');
    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    fireEvent.click(deleteButton());

    await waitFor(() => expect(deleteOrganizationPermanently).toHaveBeenCalledTimes(1));

    expect(deleteOrganizationPermanently).toHaveBeenCalledWith('1000000', ORG_NAME, false);
    expect(archiveOrganization).not.toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onDeleted.mock.calls[0][0].name).toBe(ORG_NAME);
    expect(onDeleted.mock.calls[0][1].rows).toBe(12592);
  });

  it('shows preview counts and uses the backend canonical name', async () => {
    getDeletionPreview.mockResolvedValueOnce({ ...PREVIEW, organizationName: 'Lions' });

    await openDeleteDialog();

    const dialog = within(screen.getByRole('dialog'));
    await waitFor(() => expect(dialog.getByText(/Organization: Lions/i)).toBeTruthy());
    expect(dialog.getByText(/12,592/)).toBeTruthy();
    expect(dialog.queryByText(ORG_NAME)).toBeNull();

    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    expect(deleteButton().disabled).toBe(true);

    fireEvent.change(nameInput(), { target: { value: 'Lions' } });
    expect(deleteButton().disabled).toBe(false);
  });

  it('loads the preview when the Settings dialog opens and deletes nothing while previewing', async () => {
    await openDeleteDialog();

    await waitFor(() => expect(getDeletionPreview).toHaveBeenCalledTimes(1));
    expect(deleteOrganizationPermanently).not.toHaveBeenCalled();
    expect(archiveOrganization).not.toHaveBeenCalled();
  });

  it('requires an explicit acknowledgement when other systems hold this tenant rows', async () => {
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

    await screen.findByText(/belonging to other applications/i);
    expect(screen.getByText('lms_course_enroll')).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(deleteButton().disabled).toBe(false);

    fireEvent.click(deleteButton());

    await waitFor(() => expect(deleteOrganizationPermanently).toHaveBeenCalledTimes(2));
    expect(deleteOrganizationPermanently).toHaveBeenLastCalledWith('1000000', ORG_NAME, true);
  });

  it('shows the error and does not report success when the server rolls back', async () => {
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

    renderSettings({ onDeleted });

    fireEvent.click(await screen.findByRole('button', { name: /Delete Organization/i }));
    await screen.findByRole('dialog');
    fireEvent.change(nameInput(), { target: { value: ORG_NAME } });
    fireEvent.click(deleteButton());

    await screen.findByText(/rolled back/i);

    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
