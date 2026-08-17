import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CommandCenter from '../src/components/workspace/CommandCenter';

const getExecutiveSummary = vi.fn();
const getHomeMetrics = vi.fn();
const missingEvidence = vi.fn();
const duplicateSignals = vi.fn();
const unreadCount = vi.fn();
const executions = vi.fn();
const providers = vi.fn();
const listRegistry = vi.fn();
const listCapabilities = vi.fn();
const listDepartments = vi.fn();
const getStructure = vi.fn();
const getDataQuality = vi.fn();
const getAuditLogs = vi.fn();
const updateOrganization = vi.fn();
const archiveOrganization = vi.fn();
const listSources = vi.fn();
const listSignals = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: {
    getHomeMetrics: (...args: unknown[]) => getHomeMetrics(...args),
  },
  decisionIntelligenceApi: {
    getExecutiveSummary: (...args: unknown[]) => getExecutiveSummary(...args),
  },
}));

vi.mock('../src/api/reasoning-engine', () => ({
  reasoningEngineApi: {
    missingEvidence: (...args: unknown[]) => missingEvidence(...args),
    duplicateSignals: (...args: unknown[]) => duplicateSignals(...args),
  },
}));

vi.mock('../src/api/notification', () => ({
  notificationApi: {
    unreadCount: (...args: unknown[]) => unreadCount(...args),
  },
}));

vi.mock('../src/api/ai', () => ({
  aiApi: {
    executions: (...args: unknown[]) => executions(...args),
    providers: (...args: unknown[]) => providers(...args),
  },
}));

vi.mock('../src/api/task', () => ({
  taskApi: {
    listRegistry: (...args: unknown[]) => listRegistry(...args),
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

vi.mock('../src/api/signal', () => ({
  api: {
    listSignals: (...args: unknown[]) => listSignals(...args),
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

describe('CommandCenter organization overview', () => {
  beforeEach(() => {
    getExecutiveSummary.mockReset().mockResolvedValue({
      intelligenceScore: {
        score: null,
        measuredComponents: 0,
        unmeasuredComponents: 4,
        basis: null,
      },
      pendingRecommendations: [],
      openDecisionsCount: 0,
      topRisks: [],
    });
    getHomeMetrics.mockReset().mockResolvedValue({
      erp: {
        activePeople: 0,
        activeDepartments: 0,
        peopleWithoutDepartment: 0,
        departmentsWithoutManager: 0,
        peopleWithoutProfile: 0,
      },
      intelligence: {
        openSignals: 0,
        highSignals: 0,
        pendingRecommendations: 0,
        openDecisions: 0,
      },
      attention: [],
      dataFreshness: {
        erp: 'live',
        brain: '2026-08-14 00:00:00',
      },
    });
    missingEvidence.mockReset().mockResolvedValue({ count: 0 });
    duplicateSignals.mockReset().mockResolvedValue({ count: 0 });
    unreadCount.mockReset().mockResolvedValue({ count: 0 });
    executions.mockReset().mockResolvedValue([]);
    providers.mockReset().mockResolvedValue({ providers: [] });
    listRegistry.mockReset().mockResolvedValue([]);
    listCapabilities.mockReset().mockResolvedValue([]);
    listDepartments.mockReset().mockResolvedValue([]);
    getStructure.mockReset().mockResolvedValue({
      departments: [{ id: 'dept-1', name: 'Administration', status: 'active' }],
      peopleByDepartment: { 'dept-1': 3 },
      heads: {},
    });
    getDataQuality.mockReset().mockResolvedValue({ score: 88, totalPeople: 3, totalDepartments: 1, issues: [] });
    getAuditLogs.mockReset().mockResolvedValue([{ id: 'audit-1', action: 'Organization updated', actorName: 'Admin', createdDate: '2026-08-12T00:00:00Z' }]);
    listSources.mockReset().mockResolvedValue([{ source_key: 'fees', display_name: 'Fees Data', source_type: 'csv', is_active: true }]);
    listSignals.mockReset().mockResolvedValue([{ id: 'sig-1', title: 'Low attendance', severity: 'medium', status: 'open' }]);
    archiveOrganization.mockReset().mockResolvedValue({ ok: true });
    updateOrganization.mockReset();
  });

  it('keeps the full organization overview visible when intelligence data is empty and opens ingestion in the same tenant context', async () => {
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
    expect(screen.getByLabelText('Organization overview KPIs')).toBeTruthy();
    expect(screen.getByText('Organization information')).toBeTruthy();
    expect(screen.getByText('Administration')).toBeTruthy();
    expect(screen.getByText('Fees Data')).toBeTruthy();
    expect(screen.getByText('Low attendance')).toBeTruthy();
    expect(screen.getByText('Structure, coverage, and operating completeness')).toBeTruthy();
    expect(screen.getByLabelText('Operational pulse')).toBeTruthy();
    expect(screen.getByText('Signal to execution pipeline')).toBeTruthy();
    expect(screen.getByText('Profile, structure, quality, and audit')).toBeTruthy();
    expect(screen.queryByText('Welcome to Enterprise Brain')).toBeNull();
    expect(screen.queryByText('No organizational intelligence has been generated yet.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Open Ingestion Engine/i }));

    expect(onNavigate).toHaveBeenCalledWith('ingestion');
    await waitFor(() => expect(getHomeMetrics).toHaveBeenCalledWith('1000000'));
    expect(listCapabilities).toHaveBeenCalledWith('1000000', '1000000');
    expect(listDepartments).toHaveBeenCalledWith('1000000', '1000000');
    expect(getStructure).toHaveBeenCalledWith('1000000', '1000000');
    expect(getDataQuality).toHaveBeenCalledWith('1000000', '1000000');
    expect(getAuditLogs).toHaveBeenCalledWith('1000000', '1000000');
    expect(listSources).toHaveBeenCalledWith('1000000');
    expect(listSignals).toHaveBeenCalledWith('1000000');
  });
});
