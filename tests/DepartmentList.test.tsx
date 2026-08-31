import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DepartmentList from '../src/components/department/DepartmentList';

/**
 * The Departments directory.
 *
 * THE TWO DEFECTS THESE PIN, both visible in one screenshot of Fiber Valley:
 *
 *   · Every department with no people read "50 / 100 · Watch" — the mean of
 *     "nothing is here" (staffing 0) and "nothing is wrong here" (risk 100).
 *     Four cards in a row published the same fabricated midpoint.
 *
 *   · Scoring those cards cost one `getTwin` request PER DEPARTMENT, each
 *     running six queries of its own, before the first number could appear.
 *
 * And the interaction defect: the card was an <article> with an onClick, which
 * gives a mouse a target and a keyboard nothing.
 */

const listDepartments = vi.fn();
const getSummary = vi.fn();
const getIntelligence = vi.fn();
const getTwin = vi.fn();
const getPerson = vi.fn();

vi.mock('../src/api/department', () => ({
  api: {
    listDepartments: (...a: unknown[]) => listDepartments(...a),
    getSummary: (...a: unknown[]) => getSummary(...a),
    getIntelligence: (...a: unknown[]) => getIntelligence(...a),
    getTwin: (...a: unknown[]) => getTwin(...a),
  },
}));
vi.mock('../src/api/person', () => ({
  api: { getPerson: (...a: unknown[]) => getPerson(...a) },
}));

const organization = { id: 'org-1', tenantId: '4', name: 'Fiber Valley' } as never;

function department(id: string, name: string) {
  return {
    id, name, tenantId: '4', description: null, departmentType: 'operations',
    parentDepartmentId: null, headId: null, orgId: 'org-1', status: 'active',
    createdBy: '1', createdDate: '2026-01-01', updatedDate: '2026-01-01',
  };
}

function row(over: Record<string, number | null> = {}) {
  return {
    people: 24,
    peopleWithRole: 24, peopleWithContact: 24, peopleWithReference: 24,
    capabilityAssessedPeople: 0, capabilityCount: 0, capabilityAverageLevel: null,
    signalsTotal: 10, signalsOpen: 1, signalsOpenHigh: 0, signalsResolved: 9,
    evidenceCount: 10,
    casesTotal: 0, casesOpen: 0,
    decisionCount: 0, decisionsApproved: 0, decisionsWithOutcome: 0,
    activityTotal: 0, activityRecent: 0,
    ...over,
  };
}

const departments = [department('1', 'Cable Pulling'), department('2', 'Sales - FVCPL')];

function renderList(props: Partial<Record<string, unknown>> = {}) {
  const onSelect = vi.fn();
  const onOpenPeople = vi.fn();

  render(
    <DepartmentList
      organization={organization}
      departments={departments as never}
      loading={false}
      onSelect={onSelect}
      onOpenPeople={onOpenPeople}
      onCreate={vi.fn()}
      onRefresh={vi.fn()}
      onBack={vi.fn()}
      {...(props as never)}
    />,
  );

  return { onSelect, onOpenPeople };
}

beforeEach(() => {
  listDepartments.mockReset().mockResolvedValue(departments);
  getSummary.mockReset().mockResolvedValue({
    departments: { total: 2, active: 2, inactive: 0, supported: true },
    people: { total: 24, withoutUnit: 0, inVisibleUnits: 24, supported: true },
    students: { total: 0, inBothFiles: 0, supported: false },
    records: { total: 0 },
    // Cable Pulling holds nobody; Sales holds everyone.
    peoplePerDepartment: { '1': 0, '2': 24 },
  });
  getIntelligence.mockReset().mockResolvedValue({
    departments: { '1': row({ people: 0, peopleWithRole: 0, peopleWithContact: 0, peopleWithReference: 0, signalsTotal: 0, signalsResolved: 0, signalsOpen: 0, evidenceCount: 0 }), '2': row() },
    support: { capability: false, signals: true, evidence: true, cases: false, decisions: false, activity: false },
    tenant: { departments: 2, people: 24, signalsTotal: 10, evidenceTotal: 10, casesTotal: 0, capabilityAssignments: 0 },
  });
  getTwin.mockReset().mockResolvedValue({});
  getPerson.mockReset().mockResolvedValue(null);
});

describe('the 50/100 defect', () => {
  it('does not publish a midpoint for a department with nobody in it', async () => {
    renderList();

    const card = await screen.findByLabelText('Open Cable Pulling');
    await waitFor(() => expect(within(card).getByText('Not scored')).toBeTruthy());

    // The exact string four cards used to show.
    expect(document.body.textContent).not.toContain('50 / 100');
    expect(within(card).queryByText('Watch')).toBeNull();

    /*
      And it says WHY, which is the part a reader can act on.

      The card carries the SHORT form — thirteen cards each naming every
      unmeasured dimension is a wall of identical text — and keeps the full
      sentence on the element's title, where the detail page also prints it.
    */
    const reason = within(card).getByText(/no people, and no recorded work/i);
    expect(reason).toBeTruthy();
    expect(reason.getAttribute('title')).toMatch(/no people are assigned/i);
  });

  it('shows a real zero headcount as a fact rather than as broken data', async () => {
    renderList();

    const card = await screen.findByLabelText('Open Cable Pulling');
    await waitFor(() => expect(within(card).getByText('0')).toBeTruthy());
    expect(within(card).getByText('No people currently assigned')).toBeTruthy();
  });

  it('scores a staffed department as a percentage, not a fraction', async () => {
    renderList();

    const card = await screen.findByLabelText('Open Sales - FVCPL');
    await waitFor(() => expect(within(card).getByText('%')).toBeTruthy());

    expect(within(card).getByText('24')).toBeTruthy();
    expect(within(card).queryByText(/\/ 100/)).toBeNull();
  });
});

describe('the card is the control', () => {
  it('opens the department from anywhere on the card, for a keyboard as well as a mouse', async () => {
    const { onSelect } = renderList();

    const card = await screen.findByLabelText('Open Sales - FVCPL');

    // A real <button>: it has a role, it is focusable, and Enter activates it.
    expect(card.tagName).toBe('BUTTON');

    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
  });

  it('keeps People as a separate action that does not open the department', async () => {
    const { onSelect, onOpenPeople } = renderList();

    await screen.findByLabelText('Open Sales - FVCPL');

    const peopleButtons = screen.getAllByRole('button', { name: 'People' });
    fireEvent.click(peopleButtons[1]);

    expect(onOpenPeople).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  /**
   * A <button> nested inside a <button> is invalid HTML and browsers recover
   * from it inconsistently — the inner control may not receive clicks at all.
   * The People action must therefore be a SIBLING of the card button.
   */
  it('never nests one button inside another', async () => {
    renderList();
    await screen.findByLabelText('Open Sales - FVCPL');

    for (const button of Array.from(document.querySelectorAll('button'))) {
      expect(button.querySelector('button')).toBeNull();
    }
  });
});

describe('one request, not one per department', () => {
  it('scores every card from a single batched call', async () => {
    renderList();
    await screen.findByLabelText('Open Sales - FVCPL');

    await waitFor(() => expect(getIntelligence).toHaveBeenCalledTimes(1));
    expect(getIntelligence).toHaveBeenCalledWith('4');
  });

  /**
   * The twin remains ONLY for the fee panel, which is genuinely per-unit and
   * has no aggregate endpoint. It is gated on the organization actually holding
   * student records, because the server derives it from `school_fee` rows and
   * returns null for every other tenant — so a telecom organization must now
   * issue no twin requests at all.
   */
  it('asks for no twin at all on an organization with no student records', async () => {
    renderList();
    await screen.findByLabelText('Open Sales - FVCPL');

    await waitFor(() => expect(getIntelligence).toHaveBeenCalled());
    expect(getTwin).not.toHaveBeenCalled();
  });

  it('still loads the fee panel for a school, where it can return something', async () => {
    getSummary.mockResolvedValue({
      departments: { total: 2, active: 2, inactive: 0, supported: true },
      people: { total: 24, withoutUnit: 0, inVisibleUnits: 24, supported: true },
      students: { total: 7445, inBothFiles: 1911, supported: true },
      records: { total: 398831 },
      peoplePerDepartment: { '1': 0, '2': 24 },
    });

    renderList();
    await screen.findByLabelText('Open Sales - FVCPL');

    await waitFor(() => expect(getTwin).toHaveBeenCalled());
  });
});

describe('degraded data', () => {
  it('renders the directory when the batched metrics fail entirely', async () => {
    getIntelligence.mockRejectedValue(new Error('network'));

    renderList();

    // The names and headcounts still come from the department list and the
    // summary, so a failed scoring request costs the score and nothing else.
    const card = await screen.findByLabelText('Open Sales - FVCPL');
    await waitFor(() => expect(within(card).getByText('24')).toBeTruthy());
    expect(within(card).getByText('Not scored')).toBeTruthy();
  });

  it('never prints undefined, null or NaN on a card', async () => {
    getIntelligence.mockResolvedValue({ departments: {}, support: {}, tenant: {} });

    renderList();
    await screen.findByLabelText('Open Sales - FVCPL');

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    expect(text).not.toContain('NaN');
  });
});
