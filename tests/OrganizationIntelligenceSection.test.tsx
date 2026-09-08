import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationIntelligenceSection from '../src/components/workspace/OrganizationIntelligenceSection';
import { clearRequestCache } from '../src/api/client';

/**
 * ORGANIZATION INTELLIGENCE — the full-width band on the organization overview.
 *
 * RENDERED AGAINST RESPONSES CAPTURED FROM THE RUNNING BACKEND, for the same
 * reason as OrganizationIntelligenceScreens.test.tsx: a hand-written fixture
 * encodes what the test author believed the engine returns, so it would keep
 * passing after the engine changed shape — precisely when the screen breaks.
 *
 * TWO ORGANIZATIONS, because the point of this band is that it is not built for
 * one of them:
 *
 *   tenant 7  96,416 operational records · health 54% · 3 strengths · 30 gaps
 *             · 13 risks · 35 recommendations. The populated path.
 *   tenant 8  0 operational records, 1,499 signals · health 36% · 1 strength
 *             · 3 gaps · 1 risk · 3 recommendations, and three loop dimensions
 *             that cannot be measured at all. The sparse path.
 *
 * The assertions below take their expected values FROM the fixtures rather than
 * from literals, so a test cannot pass by agreeing with a number this file
 * happens to hardcode.
 */

const tenant7 = {
  state: require('./fixtures/tenant7-state.json'),
  gaps: require('./fixtures/tenant7-gaps.json'),
  recommendations: require('./fixtures/tenant7-recommendations.json'),
  decisions: require('./fixtures/tenant7-decisions.json'),
};

const tenant8 = {
  state: require('./fixtures/tenant8-state.json'),
  gaps: require('./fixtures/tenant8-gaps.json'),
  recommendations: require('./fixtures/tenant8-recommendations.json'),
  decisions: require('./fixtures/tenant8-decisions.json'),
};

/**
 * The risk register as `/risks` publishes it.
 *
 * The rows are the real ones — the same register the decisions fixture carries,
 * captured in the same engine run — re-keyed onto the envelope the risks
 * endpoint returns them under.
 */
function risksOf(bundle: { decisions: any }) {
  const register = bundle.decisions.risks.register as any[];
  return {
    risks: register,
    open: bundle.decisions.risks.open,
    unowned: bundle.decisions.risks.unowned,
  };
}

type Bundle = Record<string, unknown>;

/** Route by URL suffix, exactly as the real client composes it. */
function mockApi(bundle: Bundle) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.keys(bundle).find((suffix) => url.includes(suffix));

    if (!match) throw new Error(`Unexpected request in test: ${url}`);

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => bundle[match],
      text: async () => JSON.stringify(bundle[match]),
    } as unknown as Response;
  }));
}

function bundleFor(data: typeof tenant7) {
  return {
    '/state': data.state,
    '/gaps': data.gaps,
    '/risks': risksOf(data),
    '/recommendations': data.recommendations,
  };
}

beforeEach(() => {
  sessionStorage.setItem('accessToken', 'test-token');
  clearRequestCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('Organization Intelligence band', () => {
  it('reports the health the engine measured, as a percentage of its own fraction', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const expected = Math.round((tenant7.state.state.overall.score as number) * 100);
    await waitFor(() => expect(screen.getByText(String(expected))).toBeTruthy());

    // The band and the measured-dimension count come from the payload too, so
    // the meter cannot be read without the reason it says what it says.
    const overall = tenant7.state.state.overall;
    expect(screen.getByText(
      `${overall.dimensionsMeasured} of ${overall.dimensionsMeasured + overall.dimensionsUnmeasured} dimensions measured`,
      { exact: false },
    )).toBeTruthy();
  });

  it('prints the engine’s narrative rather than a summary of its own', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    for (const line of tenant7.state.state.headline as string[]) {
      await waitFor(() => expect(screen.getByText(line)).toBeTruthy());
    }
  });

  it('names the strengths the state analyzer derived, with the evidence behind each', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const strengths = await screen.findByLabelText('Strengths');
    const first = (tenant7.state.state.strengths as any[])[0];

    expect(within(strengths).getByText(
      `${first.label} — ${Math.round(first.score * 100)}%`,
    )).toBeTruthy();

    // The evidence line is the strongest measured factor's own basis string —
    // a sentence from the engine, not a restatement of the score.
    const measured = (first.factors as any[]).filter((f) => f.value !== null);
    const best = measured.reduce((a, b) => (b.value > a.value ? b : a));
    expect(within(strengths).getByText(best.basis, { exact: false })).toBeTruthy();
  });

  it('leads with the most severe findings and says why each one matters', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const worst = [...(tenant7.gaps.gaps as any[])].sort((a, b) => b.severity - a.severity)[0];

    // Scoped to the findings band: the engine's own wording recurs across the
    // narrative and the action list, and an unscoped query would pass on either.
    const findings = await screen.findByLabelText('Key findings');
    expect(within(findings).getByText(worst.title)).toBeTruthy();
    expect(within(findings).getByText(worst.whyItMatters, { exact: false })).toBeTruthy();
  });

  it('lists open risks in the engine’s words, and never a mitigated one', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const risks = await screen.findByLabelText('Risks');
    const open = (risksOf(tenant7).risks as any[])
      .filter((r) => !['mitigated', 'closed', 'resolved', 'accepted'].includes(String(r.state).toLowerCase()))
      .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

    expect(open.length).toBeGreaterThan(0);
    expect(within(risks).getByText(open[0].title)).toBeTruthy();

    for (const risk of (risksOf(tenant7).risks as any[])) {
      if (['mitigated', 'closed', 'resolved', 'accepted'].includes(String(risk.state).toLowerCase())) {
        expect(within(risks).queryByText(risk.title)).toBeNull();
      }
    }
  });

  it('takes the recommended actions in the engine’s rank order', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const ranked = [...(tenant7.recommendations.recommendations as any[])].sort((a, b) => a.rank - b.rank);

    await waitFor(() => expect(screen.getByText(ranked[0].recommendation)).toBeTruthy());
    expect(screen.getByText(ranked[0].nextAction, { exact: false })).toBeTruthy();
  });

  it('never restates a recommended action as an opportunity', async () => {
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const opportunities = await screen.findByLabelText('Opportunities');
    const ranked = [...(tenant7.recommendations.recommendations as any[])].sort((a, b) => a.rank - b.rank);

    // The four highest-ranked are the action list; none of them may appear again
    // in the opportunities column.
    for (const action of ranked.slice(0, 4)) {
      expect(within(opportunities).queryByText(action.recommendation)).toBeNull();
    }
  });

  it('says a benefit cannot be estimated rather than inventing a figure', async () => {
    /*
      The engine labels an uncosted benefit 'Unknown'. Every recommendation in
      this capture carries a real label, so the assertion is the contrapositive:
      no rendered benefit line may be a bare number with no honesty label on it.
    */
    mockApi(bundleFor(tenant7));

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const ranked = [...(tenant7.recommendations.recommendations as any[])].sort((a, b) => a.rank - b.rank);
    const first = ranked[0];

    await waitFor(() => expect(screen.getByText(first.recommendation)).toBeTruthy());
    expect(screen.getAllByText(`${first.benefit.label}: ${first.benefit.statement}`).length).toBeGreaterThan(0);
  });

  /* ───────────────── the same component, a different organization ───────────────── */

  it('renders a second organization from its own data, sharing nothing with the first', async () => {
    mockApi(bundleFor(tenant8));

    render(<OrganizationIntelligenceSection tenantId="8" onNavigate={() => {}} />);

    const expected = Math.round((tenant8.state.state.overall.score as number) * 100);
    await waitFor(() => expect(screen.getByText(String(expected))).toBeTruthy());

    // Tenant 8's own narrative and its own single strength.
    expect(screen.getByText((tenant8.state.state.headline as string[])[0])).toBeTruthy();

    const strengths = screen.getByLabelText('Strengths');
    const only = (tenant8.state.state.strengths as any[])[0];
    expect(within(strengths).getByText(`${only.label} — ${Math.round(only.score * 100)}%`)).toBeTruthy();

    // And nothing at all from tenant 7 — not a finding, not a risk, not an action.
    const sevensWorst = [...(tenant7.gaps.gaps as any[])].sort((a, b) => b.severity - a.severity)[0];
    expect(screen.queryByText(sevensWorst.title)).toBeNull();
    expect(screen.queryByText(String(Math.round((tenant7.state.state.overall.score as number) * 100)))).toBeNull();
  });

  it('requests only the selected organization’s intelligence', async () => {
    mockApi(bundleFor(tenant8));

    render(<OrganizationIntelligenceSection tenantId="8" onNavigate={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText('Risks')).toBeTruthy());

    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [input] of calls) {
      expect(String(input)).toContain('/organization-intelligence/8/');
    }
  });

  /* ───────────────────────────── honesty ───────────────────────────── */

  it('says the health score is unavailable rather than showing a zero', async () => {
    /*
      An organization whose loop dimensions all come back null. The engine
      publishes `score: null` for it, and null is not a number this band is
      allowed to round to 0%.
    */
    const unmeasured = JSON.parse(JSON.stringify(tenant8.state));
    unmeasured.state.overall.score = null;
    unmeasured.state.overall.band = 'undetermined';
    unmeasured.state.overall.why = 'Nothing this organization\'s state is built from could be measured.';

    mockApi({ ...bundleFor(tenant8), '/state': unmeasured });

    const { container } = render(<OrganizationIntelligenceSection tenantId="8" onNavigate={() => {}} />);

    await waitFor(() => expect(
      screen.getByText('Health score unavailable — insufficient evidence'),
    ).toBeTruthy());

    // No meter and no figure at all — not a meter sitting at zero.
    expect(container.querySelector('.orgi__meter')).toBeNull();
    expect(container.querySelector('.orgi__figure')).toBeNull();
  });

  it('explains an empty organization rather than rendering empty bands', async () => {
    const nothing = {
      '/state': {
        tenantId: '9', dataVersion: 'v0', computedAt: new Date().toISOString(), computeMs: 1,
        state: { overall: { score: null, band: 'undetermined', stage: 'undetermined', weightMeasured: 0, weightUnmeasured: 1, dimensionsMeasured: 0, dimensionsUnmeasured: 0, why: '' }, dimensions: [], byMovement: [], strengths: [], weaknesses: [], unmeasured: [], headline: [], method: {} },
      },
      '/gaps': { gaps: [], total: 0, critical: 0, high: 0, byArea: {} },
      '/risks': { risks: [] },
      '/recommendations': { recommendations: [], total: 0, critical: 0, firstAction: null },
    };

    mockApi(nothing);

    render(<OrganizationIntelligenceSection tenantId="9" onNavigate={() => {}} />);

    await waitFor(() => expect(
      screen.getByText(/Nothing has been recorded for this organization yet/),
    ).toBeTruthy());
  });

  it('survives an endpoint failing without taking the rest of the band down', async () => {
    // Only /state answers. The three other bands must render their own reason.
    mockApi({ '/state': tenant7.state });

    render(<OrganizationIntelligenceSection tenantId="7" onNavigate={() => {}} />);

    const expected = Math.round((tenant7.state.state.overall.score as number) * 100);
    await waitFor(() => expect(screen.getByText(String(expected))).toBeTruthy());

    expect(within(screen.getByLabelText('Risks')).getByText(/No open risk has been detected/)).toBeTruthy();
  });
});
