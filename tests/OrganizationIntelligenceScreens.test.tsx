import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import MentalModelBrowser from '../src/components/workspace/MentalModelBrowser';
import DecisionIntelligence from '../src/components/workspace/DecisionIntelligence';
import ExecutiveDashboard from '../src/components/workspace/ExecutiveDashboard';
import EsoLibraryScreen from '../src/components/workspace/EsoLibraryScreen';

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

describe('ESO Library', () => {
  it('shows an empty catalogue as an empty catalogue, with no placeholder definitions', async () => {
    mockApi({
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
      '/eso-definitions': tenant7.esoDefinitions,
      '/recommendations': tenant7.recommendations,
    });

    render(<EsoLibraryScreen tenantId="7" />);

    await waitFor(() =>
      expect(screen.getByText('What the organization needs to be able to run')).toBeTruthy());

    const types = new Set(
      (tenant7.recommendations.recommendations as { esoType: string }[]).map((r) => r.esoType),
    );
    expect(types.size).toBeGreaterThan(0);

    for (const type of types) {
      expect(screen.getAllByText(type).length).toBeGreaterThan(0);
    }
  });
});
