import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DepartmentIntelligence from '../src/components/workspace/DepartmentIntelligence';

/**
 * The department page.
 *
 * WHAT THIS FILE IS ABOUT IS THE DIFFERENCE BETWEEN ZERO AND UNKNOWN, because
 * that distinction is the whole reason the screen exists in this shape. The page
 * it replaced printed four tiles and a 0 in three of them for every organization
 * that had not yet recorded decisions, which described a healthy department as an
 * idle one; and it published 50 / 100 for every department with nobody in it,
 * which is the mean of "nothing is here" and "nothing is wrong here".
 *
 * So the assertions are:
 *   · an unmeasurable dimension is EXCLUDED from the score, not scored 0;
 *   · a measurable one is included, and the page says which is which;
 *   · an unstaffed unit is NOT scored, and says why;
 *   · a department is positioned against the units that could be scored;
 *   · the roster pages ON THE SERVER rather than downloading the workforce.
 */

const getTwin = vi.fn();
const listDepartments = vi.fn();
const getSummary = vi.fn();
const getIntelligence = vi.fn();
const listPeoplePage = vi.fn();
const listCapabilities = vi.fn();

vi.mock('../src/api/department', () => ({
  api: {
    getTwin: (...a: unknown[]) => getTwin(...a),
    listDepartments: (...a: unknown[]) => listDepartments(...a),
    getSummary: (...a: unknown[]) => getSummary(...a),
    getIntelligence: (...a: unknown[]) => getIntelligence(...a),
  },
}));
vi.mock('../src/api/person', () => ({
  api: { listPeoplePage: (...a: unknown[]) => listPeoplePage(...a) },
}));
vi.mock('../src/api/capability', () => ({
  api: { listCapabilities: (...a: unknown[]) => listCapabilities(...a) },
}));

function twin(over: Record<string, unknown> = {}) {
  return {
    department: { id: '2', name: 'Field Operations', description: null },
    personCount: 24,
    capabilityHeatmap: [],
    openRiskSignalCount: 0,
    decisionCount: 0,
    decisionApprovalRate: null,
    timeline: [],
    ...over,
  };
}

/** One department's metrics row, as the batched endpoint publishes it. */
function row(over: Record<string, number | null> = {}) {
  return {
    people: 24,
    peopleWithRole: 24, peopleWithContact: 24, peopleWithReference: 24,
    capabilityAssessedPeople: 0, capabilityCount: 0, capabilityAverageLevel: null,
    signalsTotal: 10, signalsOpen: 1, signalsOpenHigh: 0, signalsResolved: 9,
    evidenceCount: 8,
    casesTotal: 0, casesOpen: 0,
    decisionCount: 0, decisionsApproved: 0, decisionsWithOutcome: 0,
    activityTotal: 0, activityRecent: 0,
    ...over,
  };
}

function intelligence(over: Record<string, unknown> = {}) {
  return {
    departments: {
      '1': row({ people: 8, peopleWithRole: 8, peopleWithContact: 8, peopleWithReference: 8, signalsTotal: 4, signalsResolved: 2, signalsOpen: 2, evidenceCount: 1 }),
      '2': row(),
      '3': row({ people: 8, peopleWithRole: 4, peopleWithContact: 8, peopleWithReference: 8, signalsTotal: 4, signalsResolved: 1, signalsOpen: 3, signalsOpenHigh: 2, evidenceCount: 0 }),
    },
    support: { capability: false, signals: true, evidence: true, cases: false, decisions: false, activity: false },
    tenant: { departments: 3, people: 40, signalsTotal: 18, evidenceTotal: 9, casesTotal: 0, capabilityAssignments: 0 },
    ...over,
  };
}

function peopleRows(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(offset + i + 1),
    firstName: `First${offset + i + 1}`,
    lastName: `Last${offset + i + 1}`,
    designation: 'Technician',
  }));
}

beforeEach(() => {
  listDepartments.mockReset().mockResolvedValue([
    { id: '1', name: 'Administration' },
    { id: '2', name: 'Field Operations' },
    { id: '3', name: 'Support' },
  ]);
  getSummary.mockReset().mockResolvedValue({
    people: { total: 40 },
    peoplePerDepartment: { '1': 8, '2': 24, '3': 8 },
  });
  getIntelligence.mockReset().mockResolvedValue(intelligence());
  listPeoplePage.mockReset().mockResolvedValue({
    people: peopleRows(3), total: 3, page: 1, perPage: 10, pages: 1,
  });
  listCapabilities.mockReset().mockResolvedValue([{ id: 'cap-1', name: 'Fault diagnosis' }]);
  getTwin.mockReset().mockResolvedValue(twin());
});

describe('a dimension with no input leaves the score', () => {
  it('excludes what this organization does not record instead of scoring it zero', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Department intelligence');

    // Capability, cases and decisions are unsupported on this fixture, so three
    // of the five dimensions cannot be measured — and the score is the weighted
    // mean of the two that can, never two fifths of it.
    await waitFor(() => expect(within(panel).getByText(/3 of 7 dimensions measured/)).toBeTruthy());
    expect(within(panel).getAllByText('Not measured').length).toBe(4);

    // And the reason each is unmeasured is stated rather than left implied.
    expect(within(panel).getByText(/has not recorded any capability assessment/i)).toBeTruthy();
    expect(within(panel).getByText(/has not recorded any decision/i)).toBeTruthy();
  });

  it('scores capability once the organization records it, and shows what the number is made of', async () => {
    getIntelligence.mockResolvedValue(intelligence({
      departments: {
        '1': row({ people: 8 }),
        '2': row({ capabilityAssessedPeople: 12, capabilityCount: 1, capabilityAverageLevel: 4 }),
        '3': row({ people: 8 }),
      },
      support: { capability: true, signals: true, evidence: true, cases: false, decisions: false, activity: false },
    }));
    getTwin.mockResolvedValue(twin({
      capabilityHeatmap: [{ capabilityId: 'cap-1', departmentId: '2', averageLevel: 4, assessedCount: 12 }],
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Department intelligence');
    await waitFor(() => expect(within(panel).getByText(/4 of 7 dimensions measured/)).toBeTruthy());
    expect(within(panel).getByText(/12 of 24 assessed/)).toBeTruthy();

    // The capability name is resolved, not printed as its id.
    expect(screen.getAllByText('Fault diagnosis').length).toBeGreaterThan(0);
  });
});

describe('the 50/100 defect', () => {
  it('does not score a department that has nobody in it', async () => {
    getSummary.mockResolvedValue({
      people: { total: 40 },
      peoplePerDepartment: { '1': 8, '2': 0, '3': 8 },
    });
    getIntelligence.mockResolvedValue(intelligence({
      departments: { '1': row({ people: 8 }), '2': row({ people: 0 }), '3': row({ people: 8 }) },
    }));
    getTwin.mockResolvedValue(twin({ personCount: 0 }));
    listPeoplePage.mockResolvedValue({ people: [], total: 0, page: 1, perPage: 10, pages: 1 });

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Department intelligence');
    await waitFor(() => expect(within(panel).getByText(/no people are assigned/i)).toBeTruthy());

    // The number the old model produced for exactly this case must not appear.
    expect(document.body.textContent).not.toContain('50%');
    expect(document.body.textContent).not.toContain('50 / 100');
  });

  it('offers an empty unit something to do instead of a grade', async () => {
    getSummary.mockResolvedValue({ people: { total: 40 }, peoplePerDepartment: { '2': 0 } });
    getIntelligence.mockResolvedValue(intelligence({
      departments: { '1': row({ people: 8 }), '2': row({ people: 0 }), '3': row({ people: 8 }) },
    }));
    getTwin.mockResolvedValue(twin({ personCount: 0 }));
    listPeoplePage.mockResolvedValue({ people: [], total: 0, page: 1, perPage: 10, pages: 1 });

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const insights = await screen.findByLabelText('What this department tells us');
    await waitFor(() => expect(within(insights).getByText(/No one is assigned to this unit/i)).toBeTruthy());
    expect(within(insights).getByText(/Assign people, or retire the unit/i)).toBeTruthy();
  });
});

describe('position among peers', () => {
  it('ranks the unit against the departments that could be scored', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const position = await screen.findByLabelText('Department position');
    await waitFor(() => expect(within(position).getByText(/#\d of 3/)).toBeTruthy());

    expect(within(position).getByText('Organization average')).toBeTruthy();
    expect(within(position).getByText('Difference')).toBeTruthy();
  });

  it('does not rank a unit it could not score', async () => {
    getSummary.mockResolvedValue({ people: { total: 40 }, peoplePerDepartment: { '2': 0 } });
    getIntelligence.mockResolvedValue(intelligence({
      departments: { '1': row({ people: 8 }), '2': row({ people: 0 }), '3': row({ people: 8 }) },
    }));
    getTwin.mockResolvedValue(twin({ personCount: 0 }));
    listPeoplePage.mockResolvedValue({ people: [], total: 0, page: 1, perPage: 10, pages: 1 });

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const position = await screen.findByLabelText('Department position');
    await waitFor(() => expect(within(position).getByText(/not scored, so it cannot be ranked/i)).toBeTruthy());
  });
});

describe('capabilities', () => {
  it('says what to do rather than printing a zero when none are assigned anywhere', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Capabilities');
    expect(within(panel).getByText(/No capability has been assigned anywhere/i)).toBeTruthy();
    expect(within(panel).getByText(/identify skill gaps/i)).toBeTruthy();
    expect(within(panel).queryByText('0')).toBeNull();
  });

  it('distinguishes an unassessed department from an organization that assesses nothing', async () => {
    getIntelligence.mockResolvedValue(intelligence({
      support: { capability: true, signals: true, evidence: true, cases: false, decisions: false, activity: false },
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Capabilities');
    await waitFor(() => expect(
      within(panel).getByText(/although other departments have assessments recorded/i),
    ).toBeTruthy());
  });
});

describe('the roster pages on the server', () => {
  it('asks for one page rather than downloading the department', async () => {
    listPeoplePage.mockResolvedValue({
      people: peopleRows(10), total: 24, page: 1, perPage: 10, pages: 3,
    });

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const roster = await screen.findByLabelText('People in this department');
    await waitFor(() => expect(within(roster).getByText('First1 Last1')).toBeTruthy());

    // The unit filter and the page are both sent to the server.
    expect(listPeoplePage).toHaveBeenCalledWith('4', expect.objectContaining({
      unitId: '2', page: 1, perPage: 10,
    }));

    // Ten on the page, and the eleventh is not in the DOM at all.
    expect(within(roster).getByText('First10 Last10')).toBeTruthy();
    expect(within(roster).queryByText('First11 Last11')).toBeNull();
    expect(within(roster).getByText(/Showing 1–10 of 24/)).toBeTruthy();
  });

  it('fetches the next page instead of slicing one it already holds', async () => {
    listPeoplePage.mockImplementation((_tenant: string, options: { page?: number }) => Promise.resolve(
      options.page === 2
        ? { people: peopleRows(10, 10), total: 24, page: 2, perPage: 10, pages: 3 }
        : { people: peopleRows(10), total: 24, page: 1, perPage: 10, pages: 3 },
    ));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const roster = await screen.findByLabelText('People in this department');
    await waitFor(() => expect(within(roster).getByText('First1 Last1')).toBeTruthy());

    fireEvent.click(within(roster).getByRole('button', { name: /Next/ }));

    await waitFor(() => expect(within(roster).getByText('First11 Last11')).toBeTruthy());
    expect(within(roster).queryByText('First1 Last1')).toBeNull();
    expect(listPeoplePage).toHaveBeenCalledWith('4', expect.objectContaining({ page: 2 }));
  });

  it('sends a search to the server so it can find someone off the current page', async () => {
    listPeoplePage.mockResolvedValue({
      people: peopleRows(10), total: 24, page: 1, perPage: 10, pages: 3,
    });

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);
    const roster = await screen.findByLabelText('People in this department');
    await waitFor(() => expect(within(roster).getByText('First1 Last1')).toBeTruthy());

    fireEvent.change(within(roster).getByLabelText('Search people in this department'), {
      target: { value: 'First23' },
    });

    await waitFor(() => expect(listPeoplePage).toHaveBeenCalledWith('4', expect.objectContaining({
      q: 'First23', unitId: '2',
    })));
  });
});

describe('honesty of the rendered page', () => {
  it('never prints a request path or a response key on screen', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);
    await screen.findByLabelText('Department intelligence');

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('/departments/');
    expect(text).not.toContain('capabilityHeatmap');
    expect(text).not.toContain('signalsOpenHigh');
    expect(text).not.toContain('timeline[]');
  });

  it('shows no tile for a family of data this organization does not record', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const indicators = await screen.findByLabelText('Department indicators');

    // Cases and decisions are unsupported here, so no tile claims zero of them.
    expect(within(indicators).queryByText('Cases')).toBeNull();
    expect(within(indicators).getByText('Signals')).toBeTruthy();
    expect(within(indicators).getByText('Evidence')).toBeTruthy();
  });
});
