import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

/* ==========================================================================
 *  THE DEPARTMENT INTELLIGENCE SCREEN, AS THE SERVER COMPOSES IT
 *
 *  Every figure on this screen arrives derived. The client computes nothing —
 *  not the score, not the confidence, not a rank, not a projection — because
 *  each of those is derived from organization-wide aggregates a browser would
 *  need every department's records to reproduce, and a second implementation
 *  of "this unit's completion rate" is a second definition of it.
 *
 *  TWO THINGS THIS CONTRACT ENCODES, AND THE UI MUST HONOUR:
 *
 *  1. `null` NEVER MEANS ZERO. A measure whose `value` is null is accompanied
 *     by a `reason` or `hint` sentence saying what is missing, and the UI
 *     renders that sentence in place of the number. Rendering 0, "—" or "N/A"
 *     for a null is the defect this whole contract exists to prevent: a unit
 *     with no open work and a unit whose work is not recorded look identical
 *     as a zero, and only one of them is good news.
 *
 *  2. HEALTH AND CONFIDENCE ARE DIFFERENT NUMBERS. Health is a verdict on
 *     performance computed from measurable dimensions only. Confidence is how
 *     much of the model could be measured at all. Missing data lowers
 *     confidence; it never lowers health. They must never be blended, summed,
 *     or shown as one figure.
 * ========================================================================== */

/** How a numeric field should be read. The UI formats; it never converts. */
export type MeasureFormat = 'count' | 'rate' | 'percent' | 'decimal' | 'days' | 'score';

export type Tone = 'good' | 'warn' | 'crit' | 'neutral';

/** Which attribution basis produced a figure. See DepartmentWorkAttribution. */
export type AttributionBasis = 'label' | 'owner';

/**
 * The organization this unit belongs to.
 *
 * NO LONGER RENDERED ON THIS SCREEN. The band that showed it was removed — it
 * repeated the organization's name, tags and score above every department and
 * pushed the verdict below the fold. The one figure worth comparing, the
 * organization's average health, is still on the page in Contribution, beside
 * this unit's own score where the comparison is the point.
 *
 * Kept on the contract because it is cheap, correct, and the natural context for
 * any other consumer of this endpoint; removing it would be churn, not cleanup.
 */
export interface OrganizationContext {
  id: string;
  name: string | null;
  code: string | null;
  industry: string | null;
  /** The mean health of every department this model can score. */
  score: number | null;
  scoreBasis: string;
  departments: number;
}

export interface DepartmentHeader {
  id: string;
  name: string;
  /** Null unless the tenant's register maps a code column. Never a slice of the name. */
  code: string | null;
  description: string | null;
  headcount: number;
  /** 0–1. Null where the organization has no recorded headcount to divide by. */
  workforceSharePct: number | null;
  organization: OrganizationContext;
  datasetsConnected: number;
  attribution: {
    basis: AttributionBasis;
    label: string | null;
    rosterMatched: number;
    rosterSize: number;
  } | null;
}

export interface Health {
  /** Null when nothing this model reads is recorded — the band is then 'undetermined'. */
  score: number | null;
  band: 'healthy' | 'good' | 'watch' | 'critical' | 'undetermined';
  label: string;
  /** Null until two snapshots exist. Never 0 as a stand-in for "no history". */
  deltaSinceRefresh: number | null;
  previousScore: number | null;
  previousDate: string | null;
  reason: string;
  rule: string;
}

export interface Confidence {
  /** Weighted: the share of the model's total weight that could be evaluated. */
  pct: number | null;
  measurableDimensions: number;
  totalDimensions: number;
  band: 'high' | 'medium' | 'low' | 'none';
  caption: string;
}

export interface SinceRefresh {
  supported: boolean;
  delta: number | null;
  previousScore: number | null;
  previousDate: string | null;
  changes: Array<{ label: string; detail: string; direction: 'up' | 'down' | 'flat' }>;
  /** Present when unsupported: why there is nothing to compare against yet. */
  reason: string | null;
}

export interface Tile {
  key: string;
  label: string;
  value: number | null;
  format: MeasureFormat;
  hint: string | null;
  tone: Tone;
  /** Non-null exactly when `value` is null. Render this instead of the number. */
  reason: string | null;
}

export interface Measure {
  key: string;
  label: string;
  value: number | null;
  format: MeasureFormat;
  /** The supporting sentence when measured; the reason it is missing when not. */
  hint: string;
  measurable: boolean;
  /** The import dataset the figure was read from, for the provenance line. */
  source: string | null;
}

export interface StateTask {
  title: string;
  status: 'done' | 'todo';
  meta: string;
}

export interface DepartmentState {
  summary: string;
  narrative: Array<{ kind: 'observation' | 'risk' | 'opportunity' | 'trend'; text: string }>;
  tasks: StateTask[];
}

export interface ActivityWeek {
  /** The period's start — a Monday for weeks, a YYYY-MM for months. */
  weekStart: string;
  received: number;
  /**
   * NULL, NOT 0, where closure is not recorded on this attribution basis. A zero
   * line along the bottom of the chart would read as "this unit finished
   * nothing", which is not what a missing column means.
   */
  resolved: number | null;
}

export interface Activity {
  supported: boolean;
  /**
   * Which chart the data supports. Owner-attributed work carries both
   * timestamps and draws received against resolved by week; work attributed by
   * the name the export states carries a monthly volume only.
   */
  granularity: 'week' | 'month' | null;
  weeks: ActivityWeek[];
  received?: number;
  resolved?: number | null;
  projection: {
    weeklyGap: number;
    /** Null when the backlog is shrinking — there is no doubling time. */
    backlogDoubleWeeks: number | null;
    note: string;
  } | null;
  source: string | null;
  sourceFiles?: string[];
  /** The server's own caption for this series, where the basis needs one. */
  note?: string | null;
  reason: string | null;
}

export interface PersonRow {
  id: string;
  name: string | null;
  email: string | null;
  /** Null where the roster records none. Never the string "Unassigned". */
  role: string | null;
  externalRef: string | null;
  /** False when no import names this person: their figures are unmeasured, not zero. */
  linked: boolean;
  records: number | null;
  handled: number | null;
  open: number | null;
  completed: number | null;
  /** 0–1. Days credited over days recorded; see `presenceMethod`. */
  presenceRate: number | null;
  presenceDays: number | null;
  reason: string | null;
}

export interface People {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  from: number;
  to: number;
  items: PersonRow[];
  linkedTotal: number;
  workLabel: string | null;
  presenceLabel: string | null;
  presenceMethod: string | null;
  sort: string;
  /** Why no per-person verdict is published. Rendered as the list's footnote. */
  verdictNote: string;
}

export interface Contribution {
  workforceSharePct: number | null;
  recordSharePct: number | null;
  recordShareReason: string | null;
  rank: number | null;
  rankOf: number | null;
  organizationAverage: number | null;
  difference: number | null;
  activityRank: number | null;
  activityOf: number | null;
  sizeRank: number | null;
  sizeOf: number | null;
  note: string;
}

export interface CapabilityRow {
  name: string;
  category: string | null;
  criticality: string | null;
  state: string | null;
  /** 0–`levelOf` on the assessment model's own scale. Null when never assessed. */
  level: number | null;
  levelOf: number;
  assessedDate: string | null;
  confidence: number | null;
  /** Written by a demo seeder rather than observed here. Labelled, never hidden. */
  seeded: boolean;
  reason: string | null;
}

export interface Capabilities {
  supported: boolean;
  expected: number;
  assessed: number;
  coveragePct: number | null;
  items: CapabilityRow[];
  seededCount: number;
  caption: string | null;
  tone: Tone;
  note: string | null;
  reason: string | null;
}

export interface Signal {
  id: string;
  title: string;
  detail: string | null;
  severity: string;
  status: string;
  open: boolean;
  raisedAt: string | null;
  updatedAt: string | null;
  confidence: number | null;
  evidenceCount: number;
  recommendedAction: string | null;
  source: string;
  seeded: boolean;
}

export interface CrossUnitFlow {
  supported: boolean;
  items: unknown[];
  reason: string;
  fixLabel: string;
  fixRoute: string;
  requires: string;
}

export interface BlindSpot {
  key: string;
  dimension: string;
  reason: string;
  /** The dimension's weight in the model, where it has one. */
  weight: number | null;
  fixLabel: string;
  fixRoute: string;
  /** Always false. Present so the panel can state the rule from the data. */
  scoredAsZero: boolean;
}

export interface ScoreExplain {
  components: Array<{
    key: string;
    label: string;
    basis: string;
    attribution: AttributionBasis | null;
    valuePct: number;
    /** The dimension's weight in the whole model. */
    rawWeight: number;
    /** Its share of the SURVIVING weight — the one the points are built from. */
    weight: number;
    points: number;
  }>;
  excluded: Array<{ key: string; label: string; rawWeight: number; reason: string }>;
  total: number | null;
  totalWeight: number;
  modelWeight: number;
  note: string;
}

export interface Recommendation {
  title: string;
  body: string;
  target: string;
  confidence: 'moderate' | 'low' | 'very low';
  confidenceReason: string;
  sufficiencyGate: {
    answered: number;
    total: number;
    questions: Array<{ question: string; answered: boolean }>;
  };
  /** UNDETERMINED is a result, not a failure to produce one. */
  rootCause: 'DETERMINED' | 'UNDETERMINED';
  rootCauseMissing: string;
  alternative: string | null;
  blindSpotsRemaining: number;
}

export interface DepartmentIntelligence {
  department: DepartmentHeader;
  health: Health;
  confidence: Confidence;
  sinceRefresh: SinceRefresh;
  tiles: Tile[];
  state: DepartmentState;
  performance: Measure[];
  workload: Measure[];
  activity: Activity;
  people: People;
  contribution: Contribution;
  capabilities: Capabilities;
  signals: Signal[];
  flow: CrossUnitFlow;
  blindSpots: BlindSpot[];
  scoreExplain: ScoreExplain;
  recommendation: Recommendation;
  sources: Array<{ kind: string; label: string; records: number; files: string[] }>;
}

export const api = {
  /**
   * GET /api/v1/departments/{tenantId}/{id}/intelligence
   *
   * The whole screen in one request. `page`/`pageSize` cut the ROSTER only —
   * every other section is complete in every response, so paging a 770-person
   * unit never re-fetches its verdict.
   *
   * `fresh` bypasses the server's aggregate caches for a deliberate refresh. It
   * is not the default: those caches are keyed on a fingerprint of the source
   * rows, so an import invalidates them immediately and a reader never sees
   * stale work.
   */
  get: (
    tenantId: string,
    departmentId: string,
    options: { page?: number; pageSize?: number; fresh?: boolean } = {},
  ): Promise<DepartmentIntelligence> => {
    const tenant = getAuthTenantId() || tenantId;
    const params = new URLSearchParams();

    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.fresh) params.set('fresh', '1');

    const query = params.toString();

    return request(
      `/departments/${tenant}/${departmentId}/intelligence${query ? `?${query}` : ''}`,
      // A deliberate refresh must not be served from the client's own GET cache
      // either, or the button appears to do nothing.
      options.fresh ? { cacheTtlMs: 0 } : {},
    ) as Promise<DepartmentIntelligence>;
  },
};
