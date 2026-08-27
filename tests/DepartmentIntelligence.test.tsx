import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DepartmentIntelligence from '../src/components/workspace/DepartmentIntelligence';

/**
 * The department page.
 *
 * WHAT THIS FILE IS ABOUT IS THE DIFFERENCE BETWEEN ZERO AND UNKNOWN, because
 * that distinction is the whole reason the screen was rewritten. The page it
 * replaced printed four tiles — people, risk signals, decisions, approval rate
 * — and a 0 in three of them for every organization that had not yet recorded
 * decisions, which described a healthy department as an idle one. It also
 * rendered its own request URLs on screen and listed every person in the unit
 * as one unbounded column.
 *
 * So the assertions are:
 *   · an unmeasurable signal is EXCLUDED from the health score, not scored 0;
 *   · a measurable one is included, and the page says which is which;
 *   · a department larger than the median is described relative to its peers;
 *   · the roster paginates rather than rendering four hundred rows.
 */

const getTwin = vi.fn();
const listDepartments = vi.fn();
const getSummary = vi.fn();
const listPeople = vi.fn();
const listCapabilities = vi.fn();

vi.mock('../src/api/department', () => ({
  api: {
    getTwin: (...a: unknown[]) => getTwin(...a),
    listDepartments: (...a: unknown[]) => listDepartments(...a),
    getSummary: (...a: unknown[]) => getSummary(...a),
  },
}));
vi.mock('../src/api/person', () => ({
  api: { listPeople: (...a: unknown[]) => listPeople(...a) },
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

function people(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
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
  listPeople.mockReset().mockResolvedValue(people(3));
  listCapabilities.mockReset().mockResolvedValue([{ id: 'cap-1', name: 'Fault diagnosis' }]);
  getTwin.mockReset().mockResolvedValue(twin());
});

describe('department intelligence', () => {
  it('leaves an unmeasurable signal out of the score instead of counting it as zero', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const health = await screen.findByLabelText('Department health');

    // Capability and decision quality have no data on this fixture, so the
    // score is the average of the two that do — never a quarter of it.
    expect(within(health).getByText(/2 of 4 signals measurable/)).toBeTruthy();
    expect(within(health).getAllByText('Not measured').length).toBe(2);

    // And the reason each is unmeasured is stated, rather than left implied.
    expect(within(health).getByText(/No capability in this unit has been assessed/)).toBeTruthy();
    expect(within(health).getByText(/No decision with a recorded outcome/)).toBeTruthy();
  });

  it('does not show a capability tile when nothing has been assessed', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);
    await screen.findByLabelText('Department indicators');

    // A "0.0 / 5" headline reads as an incompetent team, not an unmeasured one.
    expect(screen.queryByText('Capability strength')).toBeNull();
  });

  it('scores capability once it exists, and shows what the number is made of', async () => {
    getTwin.mockResolvedValue(twin({
      capabilityHeatmap: [{ capabilityId: 'cap-1', departmentId: '2', averageLevel: 4, assessedCount: 12 }],
    }));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const health = await screen.findByLabelText('Department health');
    expect(within(health).getByText(/3 of 4 signals measurable/)).toBeTruthy();
    expect(within(health).getByText(/Average assessed level 4\.0 of 5/)).toBeTruthy();

    // The capability name is resolved, not printed as its id.
    expect(screen.getAllByText('Fault diagnosis').length).toBeGreaterThan(0);
  });

  it('describes the unit against its peers rather than in isolation', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const benchmark = await screen.findByLabelText('Benchmark against other departments');
    expect(within(benchmark).getByText('1st of 3')).toBeTruthy();
    // 24 people against a median staffed unit of 8.
    expect(within(benchmark).getByText('+16')).toBeTruthy();

    expect(screen.getByText('Substantially larger than a typical unit')).toBeTruthy();
  });

  it('paginates the roster instead of rendering every person', async () => {
    listPeople.mockResolvedValue(people(24));

    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);

    const roster = await screen.findByLabelText('People in this department');
    await waitFor(() => expect(within(roster).getByText('First1 Last1')).toBeTruthy());

    // Ten on the page, and the eleventh is not in the DOM at all.
    expect(within(roster).getByText('First10 Last10')).toBeTruthy();
    expect(within(roster).queryByText('First11 Last11')).toBeNull();
    expect(within(roster).getByText(/1–10 of 24/)).toBeTruthy();

    fireEvent.click(within(roster).getByRole('button', { name: /Next/ }));
    expect(within(roster).getByText('First11 Last11')).toBeTruthy();
    expect(within(roster).queryByText('First1 Last1')).toBeNull();
  });

  it('never prints a request path or a response key on screen', async () => {
    render(<DepartmentIntelligence tenantId="4" departmentId="2" />);
    await screen.findByLabelText('Department health');

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('/departments/');
    expect(text).not.toContain('capabilityHeatmap');
    expect(text).not.toContain('timeline[]');
  });
});
