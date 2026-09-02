import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DepartmentIntelligenceScreen from '../src/components/department/intelligence/DepartmentIntelligenceScreen';
import type { DepartmentIntelligence } from '../src/api/departmentIntelligence';

import livePage1 from './fixtures/cst-fvcpl.intelligence.json';
import livePage2 from './fixtures/cst-fvcpl.intelligence.page2.json';
import liveLabelAttributed from './fixtures/cst-label-attributed.intelligence.json';

/**
 * THE DEPARTMENT INTELLIGENCE SCREEN, RENDERED AGAINST REAL DATA.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES ARE NOT MADE UP
 *
 * Both are the VERBATIM RESPONSE of
 * GET /departments/1000018/2054/intelligence, captured from the live Fiber
 * Valley database — CST - FVCPL, 111 people, 16,505 owner-attributed job orders,
 * two signals, five capabilities. That matters: a screen tested only against
 * hand-written fixtures is tested against the shape its author expected, and
 * every defect this screen exists to prevent is a shape the author did not.
 *
 * Re-capture them with the request above whenever the contract changes; a stale
 * fixture failing here is the contract telling you it moved.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHAT IS ASSERTED
 *
 *   · every populated section renders its real figures;
 *   · a section that cannot be filled renders its REASON — never 0, never "—";
 *   · health and confidence are shown as two different numbers;
 *   · the score table adds up on screen;
 *   · the roster pages against the API, five at a time, and the request carries
 *     the page — it does not slice a downloaded list;
 *   · a failed load is a screen with a retry, not a raw error string;
 *   · nothing writes to the console.
 */

const get = vi.fn();

vi.mock('../src/api/departmentIntelligence', () => ({
  api: { get: (...args: unknown[]) => get(...args) },
}));

vi.mock('../src/api/case', () => ({
  caseApi: { createCase: vi.fn().mockResolvedValue({ id: 'case-1' }) },
}));

const page1 = livePage1 as unknown as DepartmentIntelligence;
const page2 = livePage2 as unknown as DepartmentIntelligence;

/**
 * The OTHER half of the split register: unit 2053 "CST", which holds 47,693
 * records booked to its name and nobody on its roster. Captured live from
 * GET /departments/1000018/2053/intelligence.
 *
 * It is here because it is the shape that caught a real contradiction — the
 * panels read owner-attributed work while the score read label attribution, so
 * this unit rendered a completion rate in its verdict above a panel saying no
 * dataset attributed any work to it.
 */
const labelAttributed = liveLabelAttributed as unknown as DepartmentIntelligence;

/**
 * A console write during a render is a defect report the test suite would
 * otherwise swallow — a missing key, an unknown DOM prop, an act() warning.
 */
let consoleErrors: unknown[][] = [];
let consoleWarns: unknown[][] = [];

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(page1);

  consoleErrors = [];
  consoleWarns = [];

  vi.spyOn(console, 'error').mockImplementation((...a) => { consoleErrors.push(a); });
  vi.spyOn(console, 'warn').mockImplementation((...a) => { consoleWarns.push(a); });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(props: Partial<React.ComponentProps<typeof DepartmentIntelligenceScreen>> = {}) {
  return render(
    <DepartmentIntelligenceScreen tenantId="1000018" departmentId="2054" {...props} />,
  );
}

describe('the department intelligence screen, on live Fiber Valley data', () => {
  it('opens with the verdict, and shows health and confidence as two different numbers', async () => {
    mount();

    // The verdict owns the hero: band, score, and the plain sentence.
    expect(await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' })).toBeInTheDocument();
    expect(screen.getByText(page1.health.label)).toBeInTheDocument();
    expect(screen.getByText(String(page1.health.score))).toBeInTheDocument();
    expect(screen.getByText(page1.health.reason)).toBeInTheDocument();

    // Confidence is a SEPARATE figure, labelled as such — never folded into the
    // verdict. Both are announced with their real values to assistive tech.
    expect(screen.getByText(page1.confidence.caption)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: new RegExp(`Data confidence ${page1.confidence.pct} percent`) }),
    ).toBeInTheDocument();
  });

  it('renders the real figures in every populated section', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    /*
      Scoped to the tile strip. Several of these figures legitimately appear
      more than once on the page — 109 is both the "open work items" tile and
      the workload backlog, which is the point of the tile — so an unscoped
      query would fail on the screen being correct.
    */
    const tiles = document.querySelector('.dv-tiles')!;
    expect(within(tiles as HTMLElement).getByText('111')).toBeInTheDocument();
    expect(within(tiles as HTMLElement).getByText('109')).toBeInTheDocument();
    expect(within(tiles as HTMLElement).getByText('772')).toBeInTheDocument();
    expect(within(tiles as HTMLElement).getByText('50 older than 14 days')).toBeInTheDocument();

    // Performance, from the owner-attributed job order ledger.
    expect(screen.getAllByText('91%').length).toBeGreaterThan(0);   // completion 0.908
    expect(screen.getByText('5.8 days')).toBeInTheDocument();       // turnaround 5.83
    // The denominator AND the import it came from sit on the same line, so the
    // percentage above can be audited without leaving the panel.
    expect(
      screen.getByText(/14,986 of 16,505 classified records · from Job Order/),
    ).toBeInTheDocument();

    // The provenance line names the import the figures were read from.
    expect(screen.getAllByText(/Job Order/).length).toBeGreaterThan(0);
    // Named in more than one place — the chart's provenance line and the page
    // footer both cite it — which is the intent, so assert presence not count.
    expect(
      screen.getAllByText(/FiberValley_2_CST_SPLICING_CABLEPULLING\.csv/).length,
    ).toBeGreaterThan(0);

    // The chart is described in words with its real totals, so a reader who
    // cannot see the lines loses none of the meaning.
    const chart = screen.getByRole('img', { name: /items were received and/ });
    expect(chart).toBeInTheDocument();
  });

  /**
   * THE RULE THE WHOLE SCREEN EXISTS FOR.
   */
  it('renders a reason, never a zero, for anything it cannot measure', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    // SLA has no recorded target anywhere, so the row is the sentence saying so.
    const sla = page1.performance.find((m) => m.key === 'sla')!;
    expect(sla.value).toBeNull();
    expect(screen.getByText(sla.hint)).toBeInTheDocument();

    // Cross-unit flow cannot be derived from any connected source, and the panel
    // stays on the page saying what would answer it.
    expect(screen.getByText(/Work moving between units is not measurable yet/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(page1.flow.requires.slice(0, 40)))).toBeInTheDocument();

    // Every blind spot is listed with its reason and a fix.
    const spots = screen.getByText(/What we can't see yet/).closest('details')!;
    for (const spot of page1.blindSpots) {
      expect(within(spots).getByText(spot.reason)).toBeInTheDocument();
    }

    // And the rule itself is stated where the reader can see it.
    expect(screen.getByText(/none was scored as zero/)).toBeInTheDocument();
  });

  /**
   * A PANEL NOBODY CAN CHECK IS A PANEL NOBODY SHOULD TRUST.
   */
  it('shows a score table that adds up, open by default', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    const fold = screen.getByText(/How this score is calculated/).closest('details')!;
    expect(fold.open).toBe(true);

    const explain = page1.scoreExplain;
    const sum = explain.components.reduce((total, c) => total + c.points, 0);

    expect(Math.abs(sum - (explain.total ?? 0))).toBeLessThan(1);
    expect(within(fold).getByText(`${explain.total} / 100`)).toBeInTheDocument();

    /*
      Each component's own arithmetic is on screen beside it. `getAllByText`
      because two dimensions scoring the same percentage is ordinary, and an
      exact-match query would fail on the table being right.
    */
    for (const component of explain.components) {
      expect(within(fold).getAllByText(`${component.valuePct}%`).length).toBeGreaterThan(0);
      expect(within(fold).getAllByText(component.points.toFixed(1)).length).toBeGreaterThan(0);
      // The basis sentence travels with the row, so the figure is checkable.
      expect(within(fold).getByText(component.basis)).toBeInTheDocument();
    }

    // The weights shown are shares of one, so nothing is missing from the table
    // the total was built from.
    const weightSum = explain.components.reduce((t, c) => t + c.weight, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(0.01);
  });

  /**
   * THE ROSTER PAGES ON THE SERVER.
   */
  it('pages the roster through the API five at a time', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    expect(get).toHaveBeenCalledWith('1000018', '2054', {
      page: 1,
      pageSize: 5,
      fresh: false,
    });

    expect(screen.getByText(/Showing 1–5 of 111/)).toBeInTheDocument();
    expect(screen.getByText('Irfanmiya Anvarmiya Shaikh')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 23')).toBeInTheDocument();

    get.mockResolvedValue(page2);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => {
      expect(get).toHaveBeenLastCalledWith('1000018', '2054', {
        page: 2,
        pageSize: 5,
        fresh: false,
      });
    });

    // The next page's people came from the server, not from a client-side slice.
    expect(await screen.findByText('Mitesh Bharatbhai Bhatt')).toBeInTheDocument();
    expect(screen.queryByText('Irfanmiya Anvarmiya Shaikh')).not.toBeInTheDocument();
  });

  /**
   * NOBODY IS GRADED ON A ROSTER THAT RECORDS NO ROLES.
   */
  it('publishes no per-person verdict, and says why', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    expect(screen.getByText(new RegExp(page1.people.verdictNote.slice(0, 50)))).toBeInTheDocument();

    // The fixture's roster records no role for anyone. That renders as the
    // absence it is, not as a role literally called "Unassigned".
    expect(screen.getAllByText('Role not recorded').length).toBe(page1.people.items.length);
  });

  it('asks the server for fresh data when the reader refreshes', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));

    await waitFor(() => {
      expect(get).toHaveBeenLastCalledWith('1000018', '2054', {
        page: 1,
        pageSize: 5,
        fresh: true,
      });
    });
  });

  /**
   * A FAILURE IS A SCREEN, NOT A STACK TRACE.
   */
  it('renders a retryable error state in the interface voice, with no raw error text', async () => {
    get.mockRejectedValueOnce(new Error('SQLSTATE[HY000] connection refused'));

    mount({ onNavigate: vi.fn() });

    expect(await screen.findByText(/Couldn't load department intelligence/)).toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();

    get.mockResolvedValue(page1);
    fireEvent.click(screen.getByRole('button', { name: /Retry|Try again/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' })).toBeInTheDocument();
  });

  /**
   * A BLIND SPOT THE READER CANNOT ACT ON IS A COMPLAINT, NOT A FINDING.
   */
  it('routes each blind-spot fix into the screen that closes it', async () => {
    const onNavigate = vi.fn();
    mount({ onNavigate });

    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    const fold = screen.getByText(/What we can't see yet/).closest('details')!;
    const [firstFix] = within(fold).getAllByRole('button');

    fireEvent.click(firstFix);

    expect(onNavigate).toHaveBeenCalledWith(page1.blindSpots[0].fixRoute);
  });

  /**
   * THE PAGE MUST NOT CONTRADICT ITSELF.
   */
  it('shows the work of a unit whose records name it, rather than claiming it has none', async () => {
    get.mockResolvedValue(labelAttributed);
    mount({ departmentId: '2053' });

    await screen.findByRole('heading', { level: 1, name: 'CST' });

    // The verdict is built from this unit's completion rate, so the panel below
    // it has to show that same work — this is the unit whose page used to say
    // both "68 / 100" and "no dataset attributes work to this unit".
    const completion = labelAttributed.performance.find((m) => m.key === 'completion')!;
    expect(completion.value).not.toBeNull();
    expect(screen.getAllByText(`${Math.round(completion.value! * 100)}%`).length).toBeGreaterThan(0);

    const backlog = labelAttributed.workload.find((m) => m.key === 'backlog')!;
    expect(screen.getAllByText(backlog.value!.toLocaleString()).length).toBeGreaterThan(0);

    // What this basis genuinely cannot show is stated, not faked: one line, and
    // the caption says why there is no second one.
    expect(labelAttributed.activity.granularity).toBe('month');
    expect(screen.getByText(/Monthly volume of work booked to this unit's name/)).toBeInTheDocument();
    expect(screen.getByText('Recorded')).toBeInTheDocument();
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();

    // A unit with nobody on it reports an empty roster as a fact about the unit.
    expect(screen.getAllByText(/Nobody is assigned to this unit/).length).toBeGreaterThan(0);
  });

  it('renders without writing anything to the console', async () => {
    mount({ onNavigate: vi.fn(), onBack: vi.fn(), onOpenPerson: vi.fn() });
    await screen.findByRole('heading', { level: 1, name: 'CST - FVCPL' });

    expect(consoleErrors).toEqual([]);
    expect(consoleWarns).toEqual([]);
  });
});
