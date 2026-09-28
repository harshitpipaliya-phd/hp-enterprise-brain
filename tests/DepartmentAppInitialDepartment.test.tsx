import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DepartmentApp from '../src/components/department/DepartmentApp';
import type { Organization } from '../src/App';

const listDepartments = vi.fn();

vi.mock('../src/api/department', () => ({
  api: { listDepartments: (...args: unknown[]) => listDepartments(...args) },
}));

vi.mock('../src/components/department/DepartmentList', () => ({
  default: () => <div data-testid="department-list">Department list</div>,
}));
vi.mock('../src/components/department/DepartmentCreate', () => ({ default: () => null }));
vi.mock('../src/components/department/DepartmentEdit', () => ({ default: () => null }));
vi.mock('../src/components/department/DepartmentDetails', () => ({ default: () => null }));
vi.mock('../src/components/department/DepartmentArchiveConfirm', () => ({ default: () => null }));
vi.mock('../src/components/workspace/PersonIntelligence', () => ({ default: () => null }));
vi.mock('../src/components/department/intelligence/DepartmentIntelligenceScreen', () => ({
  default: ({ departmentId }: { departmentId: string }) => (
    <div data-testid="department-intelligence">Intelligence for {departmentId}</div>
  ),
}));

const ORG: Organization = {
  id: 'org-1',
  tenantId: 'tenant-1',
  name: 'Acme',
} as Organization;

const DEPARTMENTS = [
  { id: '1', tenantId: 'tenant-1', name: 'Nursing', description: null, departmentType: 'unit', parentDepartmentId: null, headId: null, orgId: 'org-1', status: 'active', createdBy: 'x', createdDate: '', updatedDate: '' },
  { id: '2', tenantId: 'tenant-1', name: 'Surgery', description: null, departmentType: 'unit', parentDepartmentId: null, headId: null, orgId: 'org-1', status: 'active', createdBy: 'x', createdDate: '', updatedDate: '' },
];

beforeEach(() => {
  listDepartments.mockReset();
  listDepartments.mockResolvedValue(DEPARTMENTS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * DepartmentApp's `initialDepartmentId` — opening straight into a specific
 * department's intelligence screen from the Organization overview's row
 * click, rather than always landing on the list.
 */
describe('DepartmentApp — opening a specific department from outside', () => {
  it('opens straight into the matching department’s intelligence screen once the list has loaded', async () => {
    render(<DepartmentApp organization={ORG} onBack={() => {}} initialDepartmentId="2" />);

    expect(await screen.findByTestId('department-intelligence')).toHaveTextContent('Intelligence for 2');
    expect(screen.queryByTestId('department-list')).not.toBeInTheDocument();
  });

  it('falls back to the ordinary list when the requested id matches nothing in this organization', async () => {
    render(<DepartmentApp organization={ORG} onBack={() => {}} initialDepartmentId="does-not-exist" />);

    await waitFor(() => expect(listDepartments).toHaveBeenCalled());
    expect(await screen.findByTestId('department-list')).toBeInTheDocument();
    expect(screen.queryByTestId('department-intelligence')).not.toBeInTheDocument();
  });

  it('opens on the ordinary list when no id is requested at all', async () => {
    render(<DepartmentApp organization={ORG} onBack={() => {}} />);

    expect(await screen.findByTestId('department-list')).toBeInTheDocument();
  });
});
