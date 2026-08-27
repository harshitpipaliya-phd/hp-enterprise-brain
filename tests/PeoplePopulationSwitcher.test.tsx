import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PersonApp from '../src/components/person/PersonApp';

/**
 * The People screen must expose BOTH of an organization's populations.
 *
 * The defect this locks out: the screen used to choose one population and
 * return early, so a school with students could never reach its staff. Every
 * assertion below is about that choice — never about a particular tenant, and
 * never about a particular school. The counts are the ones the server reports.
 */

const getSummary = vi.fn();
const listDepartments = vi.fn();
const listPeople = vi.fn();

vi.mock('../src/api/department', () => ({
  api: {
    getSummary: (...args: unknown[]) => getSummary(...args),
    listDepartments: (...args: unknown[]) => listDepartments(...args),
  },
}));

vi.mock('../src/api/person', () => ({
  api: {
    listPeople: (...args: unknown[]) => listPeople(...args),
  },
}));

// The two list bodies are exercised by their own suites. Here they only need to
// announce which one is on screen.
vi.mock('../src/components/person/PersonList', () => ({
  default: ({ people }: { people: unknown[] }) => <div data-testid="staff-list">staff rows: {people.length}</div>,
}));
vi.mock('../src/components/student/StudentList', () => ({
  default: () => <div data-testid="student-list">student list</div>,
}));
vi.mock('../src/components/student/StudentDetail', () => ({ default: () => <div /> }));
vi.mock('../src/components/workspace/PersonIntelligence', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonCreate', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonEdit', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonDetails', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonArchiveConfirm', () => ({ default: () => <div /> }));

const organization = { id: '254', tenantId: '254', name: 'Hills High School' } as any;

/** The shape FoundationCounts returns — the Organization overview's own source. */
const summary = (staff: number, students: number) => ({
  people: { total: staff },
  students: { total: students },
});

beforeEach(() => {
  vi.clearAllMocks();
  listDepartments.mockResolvedValue([]);
  listPeople.mockResolvedValue([]);
});

describe('People population switcher', () => {
  it('offers both populations, labelled with the organization\'s own counts, and lets staff be reached from students', async () => {
    getSummary.mockResolvedValue(summary(215, 5015));
    listPeople.mockResolvedValue(Array.from({ length: 215 }, (_, i) => ({ id: String(i) })));

    render(<PersonApp organization={organization} onBack={() => {}} />);

    // Students open first, because this organization has them — the same
    // default as before the switcher existed.
    await waitFor(() => expect(screen.getByTestId('student-list')).toBeTruthy());

    const staffTab = screen.getByRole('tab', { name: /Staff/ });
    const studentTab = screen.getByRole('tab', { name: /Students/ });

    // The labels are the server's counts, not the length of anything loaded here.
    expect(staffTab.textContent).toContain('215');
    expect(studentTab.textContent).toContain('5,015');
    expect(studentTab.getAttribute('aria-selected')).toBe('true');

    // The whole point: staff are reachable.
    fireEvent.click(staffTab);
    await waitFor(() => expect(screen.getByTestId('staff-list')).toBeTruthy());
    expect(screen.queryByTestId('student-list')).toBeNull();
    expect(staffTab.getAttribute('aria-selected')).toBe('true');

    // And students are reachable again.
    fireEvent.click(studentTab);
    await waitFor(() => expect(screen.getByTestId('student-list')).toBeTruthy());
  });

  it('shows no switcher for an organization with only staff, and keeps the screen it already had', async () => {
    getSummary.mockResolvedValue(summary(23, 0));
    listPeople.mockResolvedValue([{ id: '1' }]);

    render(<PersonApp organization={{ ...organization, tenantId: '342' }} onBack={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('staff-list')).toBeTruthy());
    expect(screen.queryByRole('tab')).toBeNull();
    // No switcher means no staff/student distinction to draw, so the screen
    // is about the whole workforce rather than one half of it.
    expect(screen.getByRole('heading', { name: 'Workforce Intelligence' })).toBeTruthy();
  });

  it('shows no switcher for an organization with only students', async () => {
    getSummary.mockResolvedValue(summary(0, 4955));

    render(<PersonApp organization={{ ...organization, tenantId: '203' }} onBack={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('student-list')).toBeTruthy());
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('says so plainly when the HR system holds nobody, rather than inventing a row', async () => {
    getSummary.mockResolvedValue(summary(0, 0));
    listPeople.mockResolvedValue([]);

    render(<PersonApp organization={{ ...organization, tenantId: '999' }} onBack={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText('No staff records found for this organization.')).toBeTruthy()
    );
  });
});
