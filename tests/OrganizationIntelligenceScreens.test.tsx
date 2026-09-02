import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import MentalModelBrowser from '../src/components/workspace/MentalModelBrowser';
import DecisionIntelligence from '../src/components/workspace/DecisionIntelligence';
import ExecutiveDashboard from '../src/components/workspace/ExecutiveDashboard';
import EsoLibraryScreen from '../src/components/workspace/EsoLibraryScreen';
import { clearRequestCache } from '../src/api/client';

/**
 * The three intelligence screens, rendered against RESPONSES CAPTURED FROM THE
 * RUNNING BACKEND — not against hand-written fixtures.
 *
 * WHY THAT DISTINCTION IS THE WHOLE POINT. A hand-written fixture encodes what the
 * test author believed the API returns, so these tests would keep passing after the
 * engine changed shape, which is precisely when a screen breaks. The files in
 * tests/fixtures were fetched from /organization-intelligence/{tenant}/... against
 * the real database and are checked in as evidence of the contract at that moment.
 *
 * TWO ORGANIZATIONS, DELIBERATELY, because their data shapes are opposites and each
 * exercises a different half of the honesty rules:
 *
 *   tenant 7  96,416 operational records, 5 domains, 13 derived risks, 0 outcomes.
 *             Exercises the populated path — and the UNDETERMINED path for accuracy,
 *             which is the figure this screen exists for and cannot compute.
 *   tenant 8  1,499 signals, 0 operational records, 0 capabilities, 0 decisions.
 *             Exercises three loop dimensions coming back null, and every empty state
 *             having to explain itself rather than render a zero.
 *
 * These are render-and-assert tests, and their main job is catching what typecheck
 * cannot: a component reaching into a nullable branch of a real payload. Every
 * assertion below is about honesty behaviour — that a null renders as an explanation,
 * that an empty register says why it is empty — rather than about layout.
 */

const tenant7 = {
  state: JSON.parse(JSON.stringify(require('./fixtures/tenant7-state.json'))),
  knowledge: require('./fixtures/tenant7-knowledge.json'),
  decisions: require('./fixtures/tenant7-decisions.json'),
  gaps: require('./fixtures/tenant7-gaps.json'),
  recommendations: require('./fixtures/tenant7-recommendations.json'),
  esoDefinitions: require('./fixtures/tenant7-eso-definitions.json'),
};

const tenant8 = {
  state: require('./fixtures/tenant8-state.json'),
  knowledge: require('./fixtures/tenant8-knowledge.json'),
  decisions: require('./fixtures/tenant8-decisions.json'),
  gaps: require('./fixtures/tenant8-gaps.json'),
  recommendations: require('./fixtures/tenant8-recommendations.json'),
};

type Bundle = Record<string, unknown>;

/**
 * Route by URL suffix, exactly as the real client composes it.
 *
 * A test double that ignores the path would let a screen request the wrong endpoint
 * and still pass, which defeats the purpose of testing the client wiring at all.
 */
function mockApi(bundle: Bundle) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.keys(bundle).find((suffix) => url.includes(suffix));

    if (!match) {
      throw new Error(`Unexpected request in test: ${url}`);
    }

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => bundle[match],
      text: async () => JSON.stringify(bundle[match]),
    } as unknown as Response;
  }));
}

beforeEach(() => {
  sessionStorage.setItem('accessToken', 'test-token');
  // The api client caches GET responses by token+url for a short TTL. Two tests
  // in this file request the same catalogue URL expecting different fixtures,
  // and without this the second silently reads the first one's answer — the
  // failure looks like a broken screen and is nothing of the kind.
  clearRequestCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

/* ─────────────────────────── Organizational Knowledge ─────────────────────────── */

describe('Organizational Knowledge', () => {
  it('reports the domains derived from 96,416 real operational records', async () => {
    mockApi({ '/knowledge': tenant7.knowledge });

    render(<MentalModelBrowser tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Organizational Knowledge')).toBeTruthy());

    // The State layer figure is the domain count from the response, not a constant.
    const domains = tenant7.knowledge.state.domains as number;
    expect(domains).toBeGreaterThan(0);
    expect(screen.getByText(String(domains))).toBeTruthy();

    // Every derived domain name reaches the table.
    for (const domain of tenant7.knowledge.domains as { domain: string }[]) {
      expect(screen.getAllByText(domain.domain).length).toBeGreaterThan(0);
    }
  });

  it('states that no language model contributed to any figure', async () => {
    mockApi({ '/knowledge': tenant7.knowledge });

    render(<MentalModelBrowser tenantId="7" />);

    await waitFor(() => expect(screen.getByText(/No model output/)).toBeTruthy());
    expect(screen.getByText(new RegExp(tenant7.knowledge.derivation.llm.slice(0, 40)))).toBeTruthy();
  });

  it('names each blind spot the detectors actually found', async () => {
    mockApi({ '/knowledge': tenant7.knowledge });

    render(<MentalModelBrowser tenantId="7" />);

    const spots = tenant7.knowledge.blindSpots as { title: string }[];
    expect(spots.length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getAllByText(spots[0].title).length).toBeGreaterThan(0));
  });

  it('explains an empty knowledge base rather than rendering zero domains as a result', async () => {
    mockApi({ '/knowledge': tenant8.knowledge });

    render(<MentalModelBrowser tenantId="8" />);

    await waitFor(() => expect(screen.getByText('Organizational Knowledge')).toBeTruthy());

    expect((tenant8.knowledge.domains as unknown[]).length).toBe(0);
    // The empty state names the missing input and what would produce it — the
    // ConsequenceEmpty contract — instead of showing "0 domains" and stopping.
    expect(screen.getAllByText(/No body of recorded work is classified/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/an ingested dataset with a classifier column/).length).toBeGreaterThan(0);
  });
});

/* ─────────────────────────── Decision Intelligence ─────────────────────────── */

describe('Decision Intelligence', () => {
  it('renders accuracy as UNDETERMINED when no outcome exists, never as 0%', async () => {
    mockApi({ '/decisions': tenant7.decisions });

    render(<DecisionIntelligence tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Decision Intelligence')).toBeTruthy());

    // The regression this test exists for: the previous screen rendered
    // Math.round(accuracy * 100) and displayed a confident "0%" for an
    // organization that had recorded no outcomes at all.
    expect(tenant7.decisions.accuracy.measurable).toBe(false);
    expect(tenant7.decisions.accuracy.value).toBeNull();

    expect(screen.getByText('Undetermined')).toBeTruthy();
    expect(screen.getByText(/hpbrain_outcomes/)).toBeTruthy();
    // The engine's own words, asserted verbatim: the screen must carry the reason,
    // not just the state, or a reader sees "Undetermined" and assumes a bug.
    expect(screen.getByText(/not zero, which would assert that every decision was wrong/)).toBeTruthy();
  });

  it('falls back on acceptance against evidence support, which is measurable', async () => {
    mockApi({ '/decisions': tenant7.decisions });

    render(<DecisionIntelligence tenantId="7" />);

    await waitFor(() =>
      expect(screen.getByText('Acceptance against evidence support, by category')).toBeTruthy());

    for (const point of tenant7.decisions.acceptanceVsEvidence.points as { category: string }[]) {
      expect(screen.getAllByText(point.category).length).toBeGreaterThan(0);
    }
  });

  it('marks every derived risk as unowned, because nothing was written to the register', async () => {
    mockApi({ '/decisions': tenant7.decisions });

    render(<DecisionIntelligence tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Risk register')).toBeTruthy());

    const risks = tenant7.decisions.risks;
    expect(risks.derived).toBeGreaterThan(0);
    expect(risks.registered).toBe(0);
    expect(risks.unowned).toBe(risks.open);

    expect(screen.getAllByText('unowned').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/derived on read/).length).toBeGreaterThan(0);
  });

  it('discloses that most decisions were written by a seeder rather than decided', async () => {
    mockApi({ '/decisions': tenant7.decisions });

    render(<DecisionIntelligence tenantId="7" />);

    expect(tenant7.decisions.state.syntheticDecisions).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getByText('Provenance of these decisions')).toBeTruthy());
    expect(screen.getByText(/written by a seeder/)).toBeTruthy();
  });

  it('renders for an organization with no decisions at all', async () => {
    mockApi({ '/decisions': tenant8.decisions });

    render(<DecisionIntelligence tenantId="8" />);

    await waitFor(() => expect(screen.getByText('Decision Intelligence')).toBeTruthy());
    expect(tenant8.decisions.state.decisions).toBe(0);
    expect(screen.getByText(/Nothing has been decided/)).toBeTruthy();
  });
});

/* ─────────────────────────── Executive Dashboard ─────────────────────────── */

describe('Executive Dashboard', () => {
  it('excludes unmeasurable loop stages from the composite instead of scoring them zero', async () => {
    mockApi({
      '/state': tenant7.state,
      '/recommendations': tenant7.recommendations,
      '/gaps': tenant7.gaps,
    });

    render(<ExecutiveDashboard tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Executive Dashboard')).toBeTruthy());

    const overall = tenant7.state.state.overall;
    expect(overall.dimensionsUnmeasured).toBeGreaterThan(0);
    expect(overall.weightMeasured).toBeLessThan(1);

    // A stage with no input reads as undetermined, and the composite says how much
    // of its intended weight was actually available.
    expect(screen.getAllByText('undetermined').length).toBeGreaterThan(0);
    expect(screen.getByText(/excluded rather than scored zero/)).toBeTruthy();
  });

  it('ranks recommendations and shows a labelled benefit on each', async () => {
    mockApi({
      '/state': tenant7.state,
      '/recommendations': tenant7.recommendations,
      '/gaps': tenant7.gaps,
    });

    render(<ExecutiveDashboard tenantId="7" />);

    const first = tenant7.recommendations.recommendations[0];
    expect(first.rank).toBe(1);

    await waitFor(() => expect(screen.getAllByText(first.recommendation).length).toBeGreaterThan(0));

    // Benefit support labels are mandatory — a benefit without one is a promise.
    expect(screen.getAllByText(/^(Observed|Estimated|Projected|Unknown)$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Next action/).length).toBeGreaterThan(0);
  });

  it('renders for an organization where three loop stages have no input at all', async () => {
    mockApi({
      '/state': tenant8.state,
      '/recommendations': tenant8.recommendations,
      '/gaps': tenant8.gaps,
    });

    render(<ExecutiveDashboard tenantId="8" />);

    await waitFor(() => expect(screen.getByText('Executive Dashboard')).toBeTruthy());
    expect(tenant8.state.state.overall.dimensionsUnmeasured).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('undetermined').length).toBeGreaterThan(0);
  });
});

/* ─────────────────────────── ESO Library ─────────────────────────── */

/**
 * A catalogue with one real, runnable capability.
 *
 * Built here rather than in a fixture file because the assertions below are
 * about the SHAPE the server now sends — a readiness block, an evidence list,
 * an efficacy list that is allowed to be empty — and a reader of this test
 * should be able to see that shape without opening another file.
 */
const runnableEso = {
  id: 'eso-1',
  esoCode: 'ESO-FEE-REMIND',
  name: 'Targeted fee reminder',
  purpose: 'Collection has fallen behind the agreed cadence.',
  objective: 'PERFORM',
  category: 'Capability',
  status: 'published',
  version: 1,
  owner: 'ops@school',
  trustLevel: 'approve',
  allowedExecutorClasses: ['human'],
  gapTypes: ['loop_never_closed'],
  whenToUse: ['Collection rate has fallen for two consecutive months.'],
  inputs: [{ name: 'departmentId', type: 'string' }],
  preconditions: ['The unit lead has been briefed.'],
  prerequisites: [],
  executionSteps: [{ order: 1, method: 'Review the current distribution.' }],
  expectedOutput: [{ name: 'outcome', type: 'string' }],
  readiness: {
    runnable: true,
    blockers: [],
    executorClasses: ['human'],
    executorClassRestricted: true,
    trustLevel: 'approve',
    trustLevelNote: 'Trust level governs autonomy for a non-human executor.',
    requiredInputs: [{ name: 'departmentId', type: 'string', required: true, description: null }],
    optionalInputs: [],
    unverifiableInputs: [],
    preconditions: ['The unit lead has been briefed.'],
    preconditionsRequireAcknowledgement: true,
    preconditionNote: 'These preconditions cannot be verified from records.',
  },
  relatedKnowledge: { knowledgeAssets: [], memory: [] },
  relatedRecommendations: [],
  // One run, no outcome. This is the state the efficacy rule exists for.
  runs: 1,
  lastRun: '2026-08-01 09:00:00',
  outcomes: 0,
  outcomeStatus: 'Outcome evidence unavailable — efficacy not measurable.',
  efficacy: [],
  // One completed run, no outcome. The server refuses to score it and says why,
  // per execution — this is the shape the UI must render without a percentage.
  efficacyAnalysis: {
    status: 'INSUFFICIENT_EVIDENCE',
    message: 'Outcome evidence unavailable — efficacy not measurable.',
    explanation: 'No execution of this ESO carries the before-and-after evidence a score needs. 1 execution: outcome not yet recorded.',
    score: null,
    verdict: null,
    sampleSize: 0,
    executionsConsidered: 1,
    confidence: null,
    metric: null,
    contributions: [],
  },
  efficacyMessage: 'Outcome evidence unavailable — efficacy not measurable.',
  executionHistory: [{
    id: 'x-1', decisionId: 'd-1', status: 'completed', executedBy: 'ops@school',
    executorType: 'human', error: null, startedDate: '2026-08-01 09:00:00',
    completedDate: '2026-08-02 09:00:00', createdDate: '2026-08-01 09:00:00',
  }],
  outcomeHistory: [],
  evidence: [],
};

const esoCatalogue = {
  definitions: [runnableEso],
  totals: { definitions: 1, active: 1, withEfficacy: 0, executions: 1, measurableOutcomes: 0 },
};

describe('ESO Library', () => {
  it('shows an empty catalogue as an empty catalogue, with no placeholder definitions', async () => {
    mockApi({
      '/runnable-decisions': { decisions: [] },
      '/eso-definitions': tenant7.esoDefinitions,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() => expect(screen.getByText('ESO Library')).toBeTruthy());

    expect(tenant7.esoDefinitions.totals.definitions).toBe(0);

    // The names the previous build hardcoded. Their absence is the assertion.
    expect(screen.queryByText('Targeted fee reminder')).toBeNull();
    expect(screen.queryByText('Attendance intervention')).toBeNull();
    expect(screen.queryByText('ESO-FEE-REMIND')).toBeNull();

    expect(screen.getByText(/an executable object definition for this organization/)).toBeTruthy();
  });

  it('names the execution capability each detected action is waiting on', async () => {
    mockApi({
      '/runnable-decisions': { decisions: [] },
      '/eso-definitions': tenant7.esoDefinitions,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() =>
      expect(screen.getByText('What the organization has been advised to do')).toBeTruthy());

    const types = new Set(
      (tenant7.recommendations.recommendations as { esoType: string }[]).map((r) => r.esoType),
    );
    expect(types.size).toBeGreaterThan(0);

    // Each class is named by the demand summary, which is computed over EVERY
    // recommendation — not only the ones listed individually below it. The
    // question "which capabilities is this organization missing" has to be
    // answered over the whole set or it is not answered at all.
    for (const type of types) {
      expect(screen.getAllByText(type).length).toBeGreaterThan(0);
    }
  });

  /**
   * No recommendation in this fixture carries an esoId, and none may therefore
   * offer a Run button. A screen that shows one anyway is claiming the
   * organization can execute something it cannot.
   */
  it('offers no ESO action for a recommendation with no real binding', async () => {
    mockApi({
      '/runnable-decisions': { decisions: [] },
      '/eso-definitions': tenant7.esoDefinitions,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() =>
      expect(screen.getByText('What the organization has been advised to do')).toBeTruthy());

    expect(
      (tenant7.recommendations.recommendations as { esoId: string | null }[]).every((r) => r.esoId === null),
    ).toBe(true);
    expect(screen.queryByText('View ESO')).toBeNull();
    expect(screen.queryByText('Run ESO')).toBeNull();
  });

  /**
   * EFFICACY IS NOT COMPLETION. One completed run and no outcome must produce
   * the unmeasurable sentence and NO rate, score or percentage anywhere near it.
   */
  it('says efficacy is not measurable when runs exist but outcome evidence does not', async () => {
    mockApi({
      '/runnable-decisions': { decisions: [] },
      '/eso-definitions/7/eso-1': runnableEso,
      '/eso-definitions': esoCatalogue,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Has it worked before?')).toBeTruthy());

    expect(
      screen.getAllByText(/Outcome evidence unavailable — efficacy not measurable\./).length,
    ).toBeGreaterThan(0);

    // No invented figure IN THE TRACK-RECORD BLOCK. Scoped to that block on
    // purpose: recommendations elsewhere on the page legitimately quote
    // percentages from the organization's own records, and a page-wide ban on
    // digits would assert something this rule never claimed. What must not
    // exist is a rate standing where efficacy would go.
    const track = screen.getByText('Has it worked before?').closest('.eso-block') as HTMLElement;

    expect(within(track).queryByText(/\d+(\.\d+)?\s*%/)).toBeNull();
    expect(within(track).getByText(/no\s+success rate is shown/)).toBeTruthy();
  });

  /**
   * The run panel is the only place an execution can start, and it must ask for
   * the things the server enforces — an approved decision above all. With none
   * available it says so rather than offering a button that cannot succeed.
   */
  it('refuses to offer a run when no approved decision is waiting', async () => {
    mockApi({
      '/runnable-decisions': { decisions: [] },
      '/eso-definitions/7/eso-1': runnableEso,
      '/eso-definitions': esoCatalogue,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Run this ESO')).toBeTruthy());

    expect(screen.getByText(/an approved decision waiting to be executed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Run ESO/ })).toBeNull();
  });

  /**
   * The decision picker exists because the previous build asked for a decision
   * UUID in a text box, which nobody outside the repository can supply.
   */
  it('offers the approved decisions a run can be started against', async () => {
    mockApi({
      '/runnable-decisions': {
        decisions: [{
          id: 'd-9',
          title: 'Reinstate the fee reminder cadence',
          rationale: 'Approved after reviewing the ledger.',
          category: 'intervene',
          priority: 'high',
          recommendationId: 'r-9',
          boundEsoId: 'eso-1',
          approvedBy: 'head@school',
          approvedDate: '2026-08-20 09:00:00',
          hasMeasurementPlan: true,
          measurementPlan: { id: 'p-1', baselineMetric: 'collection rate', measurementWindowDays: 14 },
        }],
      },
      '/eso-definitions/7/eso-1': runnableEso,
      '/eso-definitions': esoCatalogue,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() => expect(screen.getByText('Run this ESO')).toBeTruthy());

    expect(screen.getByText(/Reinstate the fee reminder cadence/)).toBeTruthy();
    // The plan already exists, so the screen must not ask for one again.
    expect(screen.queryByText(/What will this run be judged on/)).toBeNull();
    // A declared input and a declared precondition are both demanded.
    expect(screen.getAllByText(/departmentId/).length).toBeGreaterThan(0);
    expect(screen.getByText(/I confirm the preconditions/)).toBeTruthy();
  });
});
