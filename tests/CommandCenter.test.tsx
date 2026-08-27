import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CommandCenter from '../src/components/workspace/CommandCenter';

const getHomeMetrics = vi.fn();
const listCapabilities = vi.fn();
const listDepartments = vi.fn();
const getStructure = vi.fn();
const getDataQuality = vi.fn();
const getAuditLogs = vi.fn();
const updateOrganization = vi.fn();
const archiveOrganization = vi.fn();
const listSources = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: {
    getHomeMetrics: (...args: unknown[]) => getHomeMetrics(...args),
  },
}));

vi.mock('../src/api/capability', () => ({
  api: {
    listCapabilities: (...args: unknown[]) => listCapabilities(...args),
  },
}));

vi.mock('../src/api/department', () => ({
  api: {
    listDepartments: (...args: unknown[]) => listDepartments(...args),
  },
}));

vi.mock('../src/api/organization', () => ({
  api: {
    getStructure: (...args: unknown[]) => getStructure(...args),
    getDataQuality: (...args: unknown[]) => getDataQuality(...args),
    getAuditLogs: (...args: unknown[]) => getAuditLogs(...args),
    updateOrganization: (...args: unknown[]) => updateOrganization(...args),
    archiveOrganization: (...args: unknown[]) => archiveOrganization(...args),
  },
}));

vi.mock('../src/api/ingestion', () => ({
  ingestionApi: {
    listSources: (...args: unknown[]) => listSources(...args),
  },
}));

const organization = {
  id: '1000000',
  tenantId: '1000000',
  name: 'Sunrise International School',
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

/** The loop counts the server returns for this tenant, verbatim. */
const PIPELINE_COUNTS = {
  operationalRecords: 27000,
  signals: 15002,
  evidence: 375,
  cases: 0,
  hypotheses: 0,
  recommendations: 0,
  decisions: 0,
  executions: 0,
  outcomes: 0,
  learnings: 0,
};

describe('CommandCenter organization overview', () => {
  beforeEach(() => {
    getHomeMetrics.mockReset().mockResolvedValue({
      erp: {
        activePeople: 1001,
        activeDepartments: 12,
        peopleWithoutDepartment: 4,
        departmentsWithoutManager: 0,
        peopleWithoutProfile: 0,
      },
      pipeline: {
        stage: 'signals_detected',
        blocker: 'Signals exist, but no case has been opened yet.',
        nextAction: 'Open cases for the real fired signals.',
        counts: PIPELINE_COUNTS,
      },
      attention: [
        {
          id: 'people-without-dept',
          title: '4 students without a class section',
          description: 'Students with no class section sit outside every rollup this system produces.',
          severity: 'medium',
          link: 'people',
          metric: 4,
        },
      ],
      dataFreshness: { erp: 'live', brain: '2026-08-14 00:00:00' },
    });
    listCapabilities.mockReset().mockResolvedValue([{ id: 'cap-1', name: 'Fee collection' }]);
    listDepartments.mockReset().mockResolvedValue([{ id: 'dept-1', name: 'Administration', status: 'active' }]);
    getStructure.mockReset().mockResolvedValue({
      departments: [{ id: 'dept-1', name: 'Administration', status: 'active' }],
      peopleByDepartment: { 'dept-1': 3 },
      heads: {},
    });
    getDataQuality.mockReset().mockResolvedValue({ score: 88, totalPeople: 3, totalDepartments: 1, issues: [] });
    getAuditLogs.mockReset().mockResolvedValue([
      { id: 'audit-1', action: 'organization_updated', actorName: 'Admin', createdDate: '2026-08-12T00:00:00Z' },
    ]);
    listSources.mockReset().mockResolvedValue([
      { source_key: 'fees', display_name: 'Fees Data', source_type: 'csv', is_active: true },
    ]);
    archiveOrganization.mockReset().mockResolvedValue({ ok: true });
    updateOrganization.mockReset();
  });

  it('renders the organization, its real counts and its attention queue, and opens ingestion in the same tenant context', async () => {
    const onNavigate = vi.fn();

    render(
      <CommandCenter
        tenantId="1000000"
        organizationName="Sunrise International School"
        organization={organization}
        onNavigate={onNavigate}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Sunrise International School' })).toBeTruthy();

    // Identity and the record card, each appearing exactly once on the page.
    expect(screen.getByText('Sunrise International School Trust')).toBeTruthy();
    expect(screen.getByLabelText('What this organization contains')).toBeTruthy();

    // Supporting collections resolved from their own endpoints, each in its own
    // panel. Scoped rather than global, because the department also appears in
    // the structure table below and a bare text query cannot tell them apart.
    expect(within(await screen.findByLabelText('Departments')).getByText('Administration')).toBeTruthy();
    expect(within(screen.getByLabelText('Data sources')).getByText('Fees Data')).toBeTruthy();

    // The attention queue is the server's, including its tenant vocabulary.
    expect(screen.getByText('4 students without a class section')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Open Ingestion Engine/i }));
    expect(onNavigate).toHaveBeenCalledWith('ingestion');

    await waitFor(() => expect(getHomeMetrics).toHaveBeenCalledWith('1000000'));
    expect(listCapabilities).toHaveBeenCalledWith('1000000', '1000000');
    // Departments are NOT fetched from the department list endpoint here. The
    // overview reads them out of the structure response, which is the same
    // payload it already needs for the org chart, so asking for them twice
    // would be a second round trip for rows it is holding.
    expect(getStructure).toHaveBeenCalledWith('1000000', '1000000');
    expect(listSources).toHaveBeenCalledWith('1000000');
  });

  /**
   * The regression this file exists for.
   *
   * The strip used to be captioned "Signal to execution pipeline" and its
   * Signals box showed `risks + qualityAlerts + pendingRecommendations` — for
   * this tenant, 0 — while the tenant actually held 15,002 signals. Asserting
   * the published number equals the server's count is what stops a figure from
   * drifting away from its own label again.
   */
  it('publishes the loop counts the server returned, not figures assembled on the client', async () => {
    render(
      <CommandCenter
        tenantId="1000000"
        organizationName="Sunrise International School"
        organization={organization}
        onNavigate={vi.fn()}
      />,
    );

    const strip = await screen.findByLabelText('Progress through the intelligence loop');

    for (const [label, count] of [
      ['Records', PIPELINE_COUNTS.operationalRecords],
      ['Signals', PIPELINE_COUNTS.signals],
      ['Evidence', PIPELINE_COUNTS.evidence],
      ['Cases', PIPELINE_COUNTS.cases],
    ] as Array<[string, number]>) {
      const stage = within(strip).getByRole('button', { name: new RegExp(`^${label}`) });
      expect(stage.textContent).toContain(count.toLocaleString());
    }

    // The server's own next step, rather than a status sentence invented here.
    expect(screen.getByText(/Open cases for the real fired signals/)).toBeTruthy();
  });

  it('navigates from a loop stage to the screen that owns it', async () => {
    const onNavigate = vi.fn();

    render(
      <CommandCenter
        tenantId="1000000"
        organizationName="Sunrise International School"
        organization={organization}
        onNavigate={onNavigate}
      />,
    );

    const strip = await screen.findByLabelText('Progress through the intelligence loop');
    fireEvent.click(within(strip).getByRole('button', { name: /^Signals/ }));

    expect(onNavigate).toHaveBeenCalledWith('signals');
  });

  it('loads data quality and audit only when their tab is opened', async () => {
    render(
      <CommandCenter
        tenantId="1000000"
        organizationName="Sunrise International School"
        organization={organization}
        onNavigate={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Sunrise International School' });
    expect(getDataQuality).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Data quality' }));
    await waitFor(() => expect(getDataQuality).toHaveBeenCalledWith('1000000', '1000000'));

    fireEvent.click(screen.getByRole('tab', { name: 'Audit' }));
    await waitFor(() => expect(getAuditLogs).toHaveBeenCalledWith('1000000', '1000000'));

    // Column names never reach the reader: `organization_updated` is shown as a
    // sentence, not as the string the audit table stores.
    expect(await screen.findByText('Organization updated')).toBeTruthy();
  });
});
