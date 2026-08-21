import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App';

const listOrganizations = vi.fn();

vi.mock('../src/api/organization', () => ({
  api: {
    listOrganizations: (...a: unknown[]) => listOrganizations(...a),
    getDeletionPreview: vi.fn(),
    deleteOrganizationPermanently: vi.fn(),
    archiveOrganization: vi.fn(),
    getStructure: vi.fn(),
    getDataQuality: vi.fn(),
    getAuditLogs: vi.fn(),
    updateOrganization: vi.fn(),
  },
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

describe('application entry session gate', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    listOrganizations.mockReset();
  });

  it('opens Login instead of a stale protected screen from localStorage', () => {
    localStorage.setItem('accessToken', 'old-local-token');
    localStorage.setItem('refreshToken', 'old-local-refresh');
    localStorage.setItem('selectedOrgId', ORG.id);
    localStorage.setItem('hpbrain-session', JSON.stringify({
      role: 'tenant_admin',
      userName: 'Administrator',
      organization: ORG,
      view: 'people',
      personId: null,
    }));

    render(<App />);

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'People' })).toBeNull();
    expect(screen.queryByText('Lions')).toBeNull();
    expect(listOrganizations).not.toHaveBeenCalled();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
