import { describe, expect, it } from 'vitest';
import {
  EMPTY_METRICS,
  NO_SUPPORT,
  DEFAULT_THRESHOLDS,
  departmentScore,
  departmentDimensions,
  departmentInsights,
  departmentPosition,
  scoreStatus,
  statusLabel,
  type DepartmentMetrics,
  type DepartmentSupport,
} from '../src/components/department/departmentScore';

const metrics = (over: Partial<DepartmentMetrics> = {}): DepartmentMetrics => ({ ...EMPTY_METRICS, ...over });
const support = (over: Partial<DepartmentSupport> = {}): DepartmentSupport => ({ ...NO_SUPPORT, ...over });

/**
 * A department that measures well on several dimensions — the baseline the
 * degenerate cases below are compared against.
 */
const healthy = () => metrics({
  people: 24,
  peopleWithRole: 24, peopleWithContact: 24, peopleWithReference: 24,
  capabilityAssessedPeople: 20, capabilityCount: 4, capabilityAverageLevel: 4,
  signalsTotal: 10, signalsResolved: 9, signalsOpen: 1, signalsOpenHigh: 0,
  evidenceCount: 12,
  decisionCount: 6, decisionsApproved: 5, decisionsWithOutcome: 6,
  activityTotal: 40, activityRecent: 12,
});

const fullSupport = () => support({
  capability: true, signals: true, evidence: true, cases: true, decisions: true, activity: true,
});

describe('the 50/100 defect', () => {
  /**
   * THE HEADLINE REGRESSION. Every unstaffed department on Fiber Valley scored
   * exactly 50 and was labelled "Watch", because the old model averaged
   * staffing 0 with risk 100. The mean of two absences is not a health grade.
   */
  it('does not score a department that has nobody in it', () => {
    const result = departmentScore(metrics({ people: 0 }), fullSupport());

    expect(result.score).toBeNull();
    expect(result.status).toBeNull();
    expect(result.unscoredReason).toMatch(/no people are assigned/i);
  });

  it('never produces 50 by averaging an empty unit against a clean one', () => {
    // The exact inputs that produced 50: nothing recorded, and no signal
    // against a unit nobody works in.
    const result = departmentScore(
      metrics({ people: 0, signalsTotal: 0 }),
      support({ signals: true }),
    );

    expect(result.score).not.toBe(50);
    expect(result.score).toBeNull();
  });

  /**
   * THE MIRROR DEFECT. CST · FVCPL read "100 / 100 Excellent" for the sole
   * reason that it holds 111 people against a median unit of ~24. Size is
   * reported as a fact elsewhere; it is not a dimension here.
   */
  it('does not reward a department for being large', () => {
    const small = departmentScore(healthy(), fullSupport());
    const huge = departmentScore(metrics({ ...healthy(), people: 768,
      peopleWithRole: 768, peopleWithContact: 768, peopleWithReference: 768,
      capabilityAssessedPeople: 640 }), fullSupport());

    // Same proportions, 32x the headcount, materially the same score.
    expect(Math.abs((huge.score as number) - (small.score as number))).toBeLessThanOrEqual(2);

    const dimensionKeys = small.dimensions.map((d) => d.key);
    expect(dimensionKeys).not.toContain('staffing');
    expect(dimensionKeys).not.toContain('size');
  });
});

describe('an absent dimension leaves the composite rather than scoring zero', () => {
  it('does not measure capability on an organization that records none', () => {
    const withoutCapability = departmentScore(
      metrics({ ...healthy(), capabilityAssessedPeople: 0, capabilityCount: 0, capabilityAverageLevel: null }),
      support({ signals: true, evidence: true, decisions: true }),
    );

    const capability = withoutCapability.dimensions.find((d) => d.key === 'capability');
    expect(capability?.score).toBeNull();
    expect(capability?.basis).toMatch(/has not recorded any capability assessment/i);
    expect(withoutCapability.measured.map((d) => d.key)).not.toContain('capability');
  });

  it('scores capability as a real gap when other departments have been assessed', () => {
    // Same zero count — but this organization DOES assess, so the zero is a
    // finding about this department rather than a blind spot.
    const result = departmentScore(
      metrics({ ...healthy(), capabilityAssessedPeople: 0, capabilityCount: 0, capabilityAverageLevel: null }),
      fullSupport(),
    );

    const capability = result.dimensions.find((d) => d.key === 'capability');
    expect(capability?.score).toBe(0);
    expect(capability?.basis).toMatch(/none of the 24 people here has been assessed/i);
  });

  it('redistributes weight instead of letting a missing dimension drag the mean down', () => {
    const all = departmentScore(healthy(), fullSupport());
    const fewer = departmentScore(healthy(), support({ capability: true, signals: true }));

    // Dropping two dimensions must not move the result toward zero — that is
    // exactly what averaging them in as zeros would have done.
    expect(fewer.score).toBeGreaterThan(60);
    expect(Math.abs((fewer.score as number) - (all.score as number))).toBeLessThan(25);
  });
});

describe('too little measurable means no score at all', () => {
  it('refuses to publish a composite built on record completeness alone', () => {
    // A young organization: a staffed unit, and nothing else recorded anywhere.
    const result = departmentScore(
      metrics({ people: 10, peopleWithRole: 10, peopleWithContact: 10, peopleWithReference: 10 }),
      NO_SUPPORT,
    );

    expect(result.measured).toHaveLength(1);
    expect(result.score).toBeNull();
    expect(result.unscoredReason).toMatch(/only record completeness can be measured/i);
  });

  it('publishes once a second dimension becomes measurable', () => {
    const result = departmentScore(
      metrics({ people: 10, peopleWithRole: 10, peopleWithContact: 10, peopleWithReference: 10,
                signalsTotal: 4, signalsResolved: 4 }),
      support({ signals: true }),
    );

    expect(result.measured.length).toBeGreaterThanOrEqual(2);
    expect(result.score).toBe(100);
    expect(result.label).toBe('Excellent');
  });
});

describe('dimension arithmetic', () => {
  it('weighs capability coverage above depth, and explains both', () => {
    const half = departmentDimensions(
      metrics({ people: 10, capabilityAssessedPeople: 5, capabilityCount: 2, capabilityAverageLevel: 5 }),
      fullSupport(),
    ).find((d) => d.key === 'capability');

    // coverage 0.5 * 0.6 + depth 1.0 * 0.4 = 0.7
    expect(half?.score).toBe(70);
    expect(half?.basis).toContain('5 of 10 assessed');
    expect(half?.basis).toContain('5.0 of 5');
  });

  it('subtracts open high-severity signals rather than hiding them in a ratio', () => {
    const clean = departmentDimensions(
      metrics({ people: 5, signalsTotal: 100, signalsResolved: 98, signalsOpen: 2, signalsOpenHigh: 0 }),
      fullSupport(),
    ).find((d) => d.key === 'signal');

    const withCriticals = departmentDimensions(
      metrics({ people: 5, signalsTotal: 100, signalsResolved: 98, signalsOpen: 2, signalsOpenHigh: 2 }),
      fullSupport(),
    ).find((d) => d.key === 'signal');

    expect(clean?.score).toBe(98);
    expect(withCriticals?.score).toBe(74);
    expect(withCriticals?.basis).toMatch(/2 high-severity still open/);
  });

  it('marks a clean unit as an absence rather than an observation', () => {
    const signal = departmentDimensions(metrics({ people: 5 }), support({ signals: true }))
      .find((d) => d.key === 'signal');

    expect(signal?.score).toBe(100);
    expect(signal?.kind).toBe('absence');
    expect(signal?.basis).toMatch(/no signal has been raised against this unit/i);
  });

  it('excludes decisions still in flight from the approval rate', () => {
    const decision = departmentDimensions(
      metrics({ people: 5, decisionCount: 10, decisionsApproved: 3, decisionsWithOutcome: 4 }),
      fullSupport(),
    ).find((d) => d.key === 'decision');

    // 3 of 4 decided, not 3 of 10 — a proposal in flight is not a rejection.
    expect(decision?.score).toBe(75);
    expect(decision?.basis).toContain('3 of 4');
  });

  /**
   * MEASURED ON LIVE DATA. Fiber Valley's roster maps no `position` field, so
   * the server cannot count who has a role recorded and sends null. Averaging
   * that null in as a 0 marked all five of its departments down for a column
   * the source system does not have.
   */
  it('drops a probe the source system cannot answer instead of scoring it zero', () => {
    const withRoleColumn = departmentDimensions(
      metrics({ people: 10, peopleWithRole: 10, peopleWithContact: 10, peopleWithReference: 10 }),
      NO_SUPPORT,
    ).find((d) => d.key === 'completeness');

    const withoutRoleColumn = departmentDimensions(
      metrics({ people: 10, peopleWithRole: null, peopleWithContact: 10, peopleWithReference: 10 }),
      NO_SUPPORT,
    ).find((d) => d.key === 'completeness');

    // Same roster, one fewer answerable probe — the score must not fall.
    expect(withRoleColumn?.score).toBe(100);
    expect(withoutRoleColumn?.score).toBe(100);
  });

  it('does not score completeness at all when the roster answers no probe', () => {
    const completeness = departmentDimensions(
      metrics({ people: 10, peopleWithRole: null, peopleWithContact: null, peopleWithReference: null }),
      NO_SUPPORT,
    ).find((d) => d.key === 'completeness');

    expect(completeness?.score).toBeNull();
    expect(completeness?.basis).toMatch(/carries none of the fields/i);
  });

  it('reports the weakest completeness probe, not the flattering one', () => {
    const completeness = departmentDimensions(
      metrics({ people: 10, peopleWithRole: 10, peopleWithContact: 2, peopleWithReference: 10 }),
      NO_SUPPORT,
    ).find((d) => d.key === 'completeness');

    expect(completeness?.basis).toContain('2 of 10');
    expect(completeness?.basis).toContain('contact details');
  });
});

describe('status bands', () => {
  it('names each band at its boundary', () => {
    expect(statusLabel(scoreStatus(90))).toBe('Excellent');
    expect(statusLabel(scoreStatus(89))).toBe('Healthy');
    expect(statusLabel(scoreStatus(75))).toBe('Healthy');
    expect(statusLabel(scoreStatus(74))).toBe('Watch');
    expect(statusLabel(scoreStatus(60))).toBe('Watch');
    expect(statusLabel(scoreStatus(59))).toBe('Needs attention');
  });

  it('honours a caller that redefines the bands', () => {
    const strict = { excellent: 95, healthy: 85, watch: 70 };
    expect(statusLabel(scoreStatus(90, strict))).toBe('Healthy');
    expect(statusLabel(scoreStatus(90, DEFAULT_THRESHOLDS))).toBe('Excellent');
  });
});

describe('insights', () => {
  it('says what is wrong with an empty unit instead of scoring it', () => {
    const scored = departmentScore(metrics({ people: 0 }), fullSupport());
    const insights = departmentInsights(metrics({ people: 0 }), fullSupport(), scored);

    expect(insights.empty).toBe(false);
    expect(insights.risks[0].title).toMatch(/no one is assigned/i);
    expect(insights.focus[0].title).toMatch(/assign people/i);
  });

  it('derives risks from the actual counts', () => {
    const m = metrics({ ...healthy(), signalsOpenHigh: 3, casesOpen: 2, activityRecent: 0 });
    const scored = departmentScore(m, fullSupport());
    const insights = departmentInsights(m, fullSupport(), scored);

    const titles = insights.risks.map((r) => r.title).join(' | ');
    expect(titles).toContain('3 high-severity signals still open');
    expect(titles).toContain('2 active investigations');
    expect(titles).toMatch(/nothing recorded here in the last 30 days/i);
  });

  it('names what cannot be measured as the most actionable focus area', () => {
    const m = metrics({ people: 12, peopleWithRole: 12, peopleWithContact: 12, peopleWithReference: 12,
                        signalsTotal: 3, signalsResolved: 3 });
    const s = support({ signals: true });
    const insights = departmentInsights(m, s, departmentScore(m, s));

    const focus = insights.focus.map((f) => f.title).join(' | ');
    expect(focus).toMatch(/dimensions are not measurable yet/i);
    expect(insights.focus.some((f) => f.detail.includes('Capability coverage'))).toBe(true);
  });

  it('reports no insight rather than an invented one when nothing stands out', () => {
    // Mid-range on everything measurable: nothing is excellent, nothing is
    // failing, and every dimension is measured — so there is genuinely nothing
    // to say.
    const m = metrics({ people: 10, peopleWithRole: 8, peopleWithContact: 8, peopleWithReference: 8,
                        capabilityAssessedPeople: 8, capabilityCount: 2, capabilityAverageLevel: 4,
                        signalsTotal: 10, signalsResolved: 8, signalsOpen: 2, signalsOpenHigh: 0,
                        evidenceCount: 8,
                        decisionCount: 4, decisionsApproved: 3, decisionsWithOutcome: 4,
                        activityTotal: 10, activityRecent: 4 });
    const insights = departmentInsights(m, fullSupport(), departmentScore(m, fullSupport()));

    // Two open signals is a real risk and IS reported; the point is that
    // nothing was manufactured beyond what the numbers support.
    expect(insights.risks.every((r) => /open signal/i.test(r.title) || /investigation/i.test(r.title))).toBe(true);
  });
});

describe('position among peers', () => {
  it('excludes unscored departments from the average and the ranking', () => {
    const scores = new Map<string, number | null>([
      ['a', 90], ['b', 80], ['c', 70],
      ['d', null], ['e', null], ['f', null],
    ]);

    const position = departmentPosition(scores, 'b');

    // (90 + 80 + 70) / 3 = 80 — the three unscored units do not drag it to 40.
    expect(position.organizationAverage).toBe(80);
    expect(position.rank).toBe(2);
    expect(position.scoredPeers).toBe(3);
    expect(position.delta).toBe(0);
    expect(position.unscored).toBe(3);
  });

  it('does not rank a department against fewer than two scored peers', () => {
    const position = departmentPosition(new Map([['a', 90], ['b', null]]), 'a');

    expect(position.rank).toBeNull();
    expect(position.delta).toBeNull();
    expect(position.organizationAverage).toBe(90);
  });

  it('reports the gap in percentage points, signed', () => {
    const scores = new Map<string, number | null>([['a', 95], ['b', 75], ['c', 70]]);
    expect(departmentPosition(scores, 'a').delta).toBe(15);
    expect(departmentPosition(scores, 'c').delta).toBe(-10);
  });
});
