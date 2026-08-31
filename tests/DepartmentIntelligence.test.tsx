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
const getProfile = vi.fn();
const listPeoplePage = vi.fn();
const listCapabilities = vi.fn();

vi.mock('../src/api/department', () => ({
  api: {
    getTwin: (...a: unknown[]) => getTwin(...a),
    listDepartments: (...a: unknown[]) => listDepartments(...a),
    getSummary: (...a: unknown[]) => getSummary(...a),
    getIntelligence: (...a: unknown[]) => getIntelligence(...a),
    getProfile: (...a: unknown[]) => getProfile(...a),
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

/**
 * The composed profile, as the server publishes it.
 *
 * The detail screen no longer scores anything client-side — the score, the
 * ranks, the narrative and the next action are derived from tenant-wide
 * aggregates and arrive computed. These tests therefore assert what the screen
 * DOES WITH the contract, and the scoring rules themselves are pinned in
 * departmentScore.test.ts and the PHP DepartmentProfile tests.
 */
const dimension = (over: Record<string, unknown> = {}) => ({
  key: 'operational', label: 'Operational performance', weight: 1.5,
  score: 91, status: 'healthy', basis: '91% of 1,200 classified records completed.', ...over,
});

const profile = (over: Record<string, unknown> = {}) => ({
  departmentId: '2',
  score: 86, status: 'healthy', statusLabel: 'Healthy',
  measuredCount: 3, dimensionCount: 7, confidence: 'medium',
  dimensions: [
    dimension(),
    dimension({ key: 'people', label: 'People coverage', weight: 1, score: 84, status: 'good', basis: '2 of 3 recorded fields are filled.' }),
    dimension({ key: 'confidence', label: 'Data confidence', weight: 0.75, score: 95, status: 'healthy', basis: 'Records 4 of 6 kinds of data.' }),
    dimension({ key: 'capability', label: 'Capability coverage', weight: 1.25, score: null, status: null, basis: 'This organization has not recorded any capability assessment.' }),
    dimension({ key: 'signal', label: 'Signal health', weight: 1, score: null, status: null, basis: 'This organization does not attribute signals to departments.' }),
    dimension({ key: 'service', label: 'Service health', weight: 1, score: null, status: null, basis: 'Too few records carry both timestamps.' }),
    dimension({ key: 'decision', label: 'Decision quality', weight: 0.75, score: null, status: null, basis: 'This organization has not recorded any decision.' }),
  ],
  pulse: [
    { key: 'people', label: 'People', value: 24, format: 'count', reason: null },
    { key: 'activity', label: 'Activity', value: 1200, format: 'count', reason: null },
    { key: 'score', label: 'Intelligence', value: 86, format: 'score', reason: null },
  ],
  performance: {
    supported: true, records: 1200, completed: 1092, cancelled: 24, backlog: 84, classified: 1200,
    completionRate: 0.91, cancellationRate: 0.02, turnaroundHours: 12.4, turnaroundMeasured: 900,
    perPerson: 50, momentum: { changePercent: 8.4 }, reason: null,
  },
  workload: {
    supported: true, total: 1200, active: 84, perPerson: 50, reason: null,
    segments: [
      { key: 'completed', label: 'Completed', count: 1092, share: 0.91 },
      { key: 'open', label: 'Open', count: 84, share: 0.07 },
      { key: 'cancelled', label: 'Cancelled', count: 24, share: 0.02 },
    ],
  },
  people: {
    total: 24, assessed: 0, perPerson: 50,
    fields: [{ label: 'Contact details', have: 24, missing: 0, share: 1 }],
    individualReason: 'Individual performance is not measurable from the connected source.',
  },
  trend: { supported: true, series: [{ period: '2026-01', records: 500 }, { period: '2026-02', records: 700 }], momentum: { changePercent: 8.4 }, reason: null },
  contribution: {
    records: 1200, recordShare: 0.055, organizationRecords: 21818,
    people: 24, peopleShare: 0.115, organizationPeople: 209,
    activityRank: 3, activityOf: 13, scoreDifference: 7,
  },
  position: {
    size: { rank: 2, of: 3, value: 24 },
    activity: { rank: 3, of: 3, value: 1200 },
    score: { rank: 1, of: 3, value: 86 },
    organizationAverage: 79, difference: 7,
  },
  work: { primaryDataset: 'work_order', breakdown: [], datasets: 2 },
  signals: { supported: false, organizationTotal: 5, total: 0, open: 0, openHigh: 0, resolved: 0, reason: '5 signals exist for this organization, but none records the department it concerns.' },
  evidence: { supported: false, organizationTotal: 21, total: 0, reason: '21 evidence records exist for this organization.' },
  cases: { supported: false, organizationTotal: 5, total: 0, open: 0, reason: '5 investigations exist for this organization, but none is attributed to a department.' },
  health: { status: 'healthy', label: 'Healthy', lines: ['Operational performance is strong at 91%.'] },
  narrative: [
    { kind: 'observation', text: 'This unit accounts for 11.5% of the recorded workforce.' },
    { kind: 'risk', text: 'Pending workload is concentrated.' },
  ],
  nextAction: { title: 'Work down the open backlog', detail: '84 of 1,200 records are open.', target: 'activity' },
  unclaimedWork: null,
  ...over,
});


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
  /*
    The profile endpoint is a SEPARATE request from the metrics one, and the
    screen renders its panels only when it resolves. Rejecting it by default
    keeps these tests on the sections they were written for, and the profile
    panels get their own coverage where they are asserted.
  */
  getProfile.mockReset().mockResolvedValue(profile());
  listPeoplePage.mockReset().mockResolvedValue({
    people: peopleRows(3), total: 3, page: 1, perPage: 10, pages: 1,
  });
  listCapabilities.mockReset().mockResolvedValue([{ id: 'cap-1', name: 'Fault diagnosis' }]);
  getTwin.mockReset().mockResolvedValue(twin());
});

describe('a dimension with no input leaves the score', () => {
  it('shows what could not be measured instead of scoring it zero', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Intelligence breakdown');

    // Four of seven dimensions are unmeasurable on this fixture, and the header
    // says so rather than the score silently resting on three.
    await waitFor(() => expect(within(panel).getByText(/3 of 7 measurable/)).toBeTruthy());
    expect(within(panel).getAllByText('Not measurable').length).toBe(4);

    // And each states WHY, which is the part a reader can act on.
    expect(within(panel).getByText(/has not recorded any capability assessment/i)).toBeTruthy();
    expect(within(panel).getByText(/has not recorded any decision/i)).toBeTruthy();
  });

  it('never prints a zero for a dimension the organization cannot record', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Intelligence breakdown');
    const missing = within(panel).getAllByText('Not measurable');

    // The whole defect this replaced: an absence rendered as 0% and averaged in.
    for (const node of missing) {
      expect(node.textContent).not.toBe('0%');
    }
  });
});

describe('the 50/100 defect', () => {
  it('does not publish a midpoint for a department it could not score', async () => {
    getProfile.mockResolvedValue(profile({
      score: null, status: 'unknown', statusLabel: 'Not measurable',
      measuredCount: 0, confidence: 'none',
      health: { status: 'unknown', label: 'Not measurable', lines: ['Nothing this model reads is recorded for this unit yet.'] },
      pulse: [{ key: 'score', label: 'Intelligence', value: null, format: 'score', reason: 'No dimension of this model is measurable for this unit.' }],
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);
    await screen.findByLabelText('Department health');

    // The exact figure the old averaging model produced for an empty unit.
    expect(document.body.textContent).not.toContain('50 / 100');
    expect(document.body.textContent).not.toContain('50%');
  });

  it('offers an unscored unit a reason rather than a grade', async () => {
    getProfile.mockResolvedValue(profile({
      score: null, status: 'unknown', statusLabel: 'Not measurable', measuredCount: 0,
      health: { status: 'unknown', label: 'Not measurable', lines: ['Nothing this model reads is recorded for this unit yet.'] },
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const health = await screen.findByLabelText('Department health');
    await waitFor(() => expect(within(health).getByText(/Not measurable/i)).toBeTruthy());
    expect(within(health).getByText(/Nothing this model reads is recorded/i)).toBeTruthy();
  });
});

describe('position among peers', () => {
  it('ranks the unit against the departments that could be scored', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Organization contribution');
    await waitFor(() => expect(within(panel).getByText(/#1 of 3/)).toBeTruthy());

    expect(within(panel).getByText('Organization average')).toBeTruthy();
    expect(within(panel).getByText('Difference')).toBeTruthy();
    expect(within(panel).getByText('+7 pts')).toBeTruthy();
  });

  it('does not invent a rank for a unit it could not score', async () => {
    getProfile.mockResolvedValue(profile({
      position: {
        size: { rank: null, of: 0, value: null },
        activity: { rank: null, of: 0, value: null },
        score: { rank: null, of: 0, value: null },
        organizationAverage: null, difference: null,
      },
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Organization contribution');
    await waitFor(() => expect(within(panel).queryByText(/#\d+ of/)).toBeNull());
  });
});

describe('capabilities', () => {
  it('says what to do rather than printing a zero when none are assigned', async () => {
    getTwin.mockResolvedValue(twin({ capabilityHeatmap: [] }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Capabilities');
    await waitFor(() => expect(within(panel).getByText(/No capability has been assigned/i)).toBeTruthy());
    expect(within(panel).getByText(/makes capability coverage/i)).toBeTruthy();
    expect(within(panel).queryByText('0')).toBeNull();
  });

  it('resolves a capability id to its name rather than printing the id', async () => {
    getTwin.mockResolvedValue(twin({
      capabilityHeatmap: [{ capabilityId: 'cap-1', departmentId: '2', averageLevel: 4, assessedCount: 12 }],
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const panel = await screen.findByLabelText('Capabilities');
    await waitFor(() => expect(within(panel).getByText('Fault diagnosis')).toBeTruthy());
    expect(within(panel).queryByText('cap-1')).toBeNull();
    expect(within(panel).getByText(/Assessed across 12 people/i)).toBeTruthy();
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
    await screen.findByLabelText('Intelligence breakdown');

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
