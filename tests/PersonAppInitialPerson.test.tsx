import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PersonApp from '../src/components/person/PersonApp';
import type { Organization } from '../src/App';

const listPeoplePage = vi.fn();
const listPeople = vi.fn();
const listDepartments = vi.fn();
const getSummary = vi.fn();

vi.mock('../src/api/person', () => ({
  api: {
    listPeoplePage: (...args: unknown[]) => listPeoplePage(...args),
    listPeople: (...args: unknown[]) => listPeople(...args),
  },
}));

vi.mock('../src/api/department', () => ({
  api: {
    listDepartments: (...args: unknown[]) => listDepartments(...args),
    getSummary: (...args: unknown[]) => getSummary(...args),
  },
}));

vi.mock('../src/components/person/PersonList', () => ({
  default: () => <div data-testid="person-list">Person list</div>,
}));
vi.mock('../src/components/person/PersonCreate', () => ({ default: () => null }));
vi.mock('../src/components/person/PersonEdit', () => ({ default: () => null }));
vi.mock('../src/components/person/PersonDetails', () => ({ default: () => null }));
vi.mock('../src/components/person/PersonArchiveConfirm', () => ({ default: () => null }));
vi.mock('../src/components/student/StudentList', () => ({ default: () => null }));
vi.mock('../src/components/student/StudentDetail', () => ({ default: () => null }));
vi.mock('../src/components/workspace/PersonIntelligence', () => ({
  default: ({ personId }: { personId: string }) => (
    <div data-testid="person-intelligence">Intelligence for {personId}</div>
  ),
}));

const ORG: Organization = { id: 'org-1', tenantId: 'tenant-1', name: 'Acme' } as Organization;

const PEOPLE = [
  { id: '11', tenantId: 'tenant-1', employeeId: 'E11', firstName: 'Asha', lastName: 'Rao' },
  { id: '21', tenantId: 'tenant-1', employeeId: 'E21', firstName: 'Bilal', lastName: 'Khan' },
];

beforeEach(() => {
  listPeoplePage.mockReset();
  listPeople.mockReset();
  listDepartments.mockReset();
  getSummary.mockReset();

  listPeoplePage.mockResolvedValue({ people: PEOPLE, total: PEOPLE.length });
  listDepartments.mockResolvedValue([]);
  getSummary.mockResolvedValue({ people: { total: PEOPLE.length }, students: { total: 0 } });

  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * PersonApp's `initialPersonId` — opening straight into a specific person's
 * intelligence screen from outside (Graph Explorer, Global Search), the
 * same shape of fix as DepartmentApp's `initialDepartmentId`.
 */
describe('PersonApp — opening a specific person from outside', () => {
  it('opens straight into the matching person’s intelligence screen once the roster has loaded', async () => {
    render(<PersonApp organization={ORG} onBack={() => {}} initialPersonId="21" />);

    expect(await screen.findByTestId('person-intelligence')).toHaveTextContent('Intelligence for 21');
    expect(screen.queryByTestId('person-list')).not.toBeInTheDocument();
  });

  it('falls back to the ordinary roster when the requested id matches nobody in this organization', async () => {
    render(<PersonApp organization={ORG} onBack={() => {}} initialPersonId="does-not-exist" />);

    await waitFor(() => expect(listPeoplePage).toHaveBeenCalled());
    expect(await screen.findByTestId('person-list')).toBeInTheDocument();
    expect(screen.queryByTestId('person-intelligence')).not.toBeInTheDocument();
  });

  it('opens on the ordinary roster when no id is requested at all', async () => {
    render(<PersonApp organization={ORG} onBack={() => {}} />);

    expect(await screen.findByTestId('person-list')).toBeInTheDocument();
  });
});
