import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

/* ==========================================================================
 *  THE PERSON PROFILE, AS THE SERVER COMPOSES IT
 *
 *  GET /people/{tenantId}/{id}/intelligence — one call, the whole screen.
 *
 *  Mirrors PersonIntelligenceService. Every figure arrives derived: the client
 *  formats and lays out, and computes nothing. A second implementation of
 *  "this person's standing" in the browser would be a second definition of it,
 *  and the two would drift the first time a weight changed.
 *
 *  THE FOUR RULES THIS CONTRACT ENCODES:
 *
 *  1. TWO SCORES, NEVER MIXED. `standing` is a verdict computed from the
 *     dimensions that could be measured. `confidence` is how much of the model
 *     was measurable at all. Missing data lowers confidence and never lowers
 *     standing, so they must never be blended or shown as one figure.
 *
 *  2. UNDETERMINED IS A VALUE. It arrives as the literal string, typed as such
 *     below so the compiler forces every reader to handle it before touching a
 *     number. It is rendered as the word, plus what is missing, plus the action
 *     that would unlock it — never as 0, "—", or a hidden row.
 *
 *  3. VOLUME IS FACT, NOT RANK. `contribution.handledTotal` is displayed
 *     because it is true. While `person.roleAssigned` is false it reaches the
 *     standing only through week-to-week consistency, never as a ranking —
 *     there is no role requirement to rank it against, so a ranking would be
 *     a comparison to a baseline nobody set.
 *
 *  4. CONTRADICTIONS ARE DATA-QUALITY FINDINGS. `consistency.mismatches` is a
 *     disagreement between two imported datasets, carrying its own
 *     `likelyCause`. It is never presented as a finding about the person.
 * ========================================================================== */

/** The literal the server sends when a dimension has no basis to be computed. */
export const UNDETERMINED = 'UNDETERMINED';
export type Undetermined = typeof UNDETERMINED;

export type StandingBand = 'steady' | 'watch' | 'support' | 'undetermined';
export type Direction = 'up' | 'down' | 'flat';
export type AbsencePattern = 'none' | 'clustered' | 'recurring_weekday';
export type Trajectory = 'improving' | 'declining' | 'stable';
export type RootCause = 'DETERMINED' | 'UNDETERMINED';

export interface PersonIdentity {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  /** The person's role, or null. Null is why `roleAssigned` is false. */
  role: string | null;
  /** Gates two of the seven dimensions: role-relative scoring and vsRole. */
  roleAssigned: boolean;
  departmentId: number | null;
  departmentName: string | null;
  departmentCode: string | null;
  orgName: string | null;
  recordCreated: string | null;
  recordCount: number;
}

/**
 * The verdict.
 *
 * `score` is null exactly when `band` is 'undetermined' — nothing this person
 * is measured on is on file. The two travel together so the UI cannot render a
 * band without a score or a score without a band.
 */
export interface Standing {
  band: StandingBand;
  score: number | null;
  deltaSinceRefresh: number | null;
  /** One plain sentence naming what the band was built from. Always present. */
  reason: string;
}

export interface Confidence {
  pct: number | null;
  measurableDimensions: number;
  totalDimensions: number;
  /** Which dimensions could not be measured, in config order. */
  undetermined: string[];
}

export interface SinceRefreshChange {
  label: string;
  detail: string;
  direction: Direction;
}

/**
 * `supported` is false on the first measured refresh: there is no earlier
 * snapshot to diff against, which is a different statement from "nothing
 * changed" and carries its own `reason`.
 */
export interface SinceRefresh {
  supported: boolean;
  changes: SinceRefreshChange[];
  reason: string | null;
}

export interface Contribution {
  handledTotal: number;
  handled30d: number;
  /** Eight ISO weeks, oldest first. Counts of records handled by this person. */
  weeklyTrend: number[];
  /** This person's share of their department's handled volume, same window. */
  teamSharePct: number | null;
  /** Top decile of the department by volume. Shown as load, never as merit. */
  highLoad: boolean;
  supervisedCount: number;
}

export interface Presence {
  /** Null when no attendance records exist in the window — not zero percent. */
  attendancePct: number | null;
  streakDays: number;
  absencePattern: AbsencePattern;
  /** Set only when absencePattern is 'recurring_weekday'. */
  recurringDay: string | null;
  avgHours: number | null;
  weeklyHours: number[];
  /** Above the configured threshold for the configured run of weeks. */
  longHoursFlag: boolean;
  longHoursWeeks: number;
}

export interface Mismatches {
  count: number;
  windowDays: number;
  sampleDates: string[];
  /** Framed as an import or device problem, because that is what it is. */
  likelyCause: string;
}

export interface ClearedCheck {
  rule: string;
  detail: string;
}

export interface Consistency {
  mismatches: Mismatches;
  cleared: ClearedCheck[];
}

export interface Kasba {
  knowledge: number | null;
  ability: number | null;
  skill: number | null;
  behaviour: number | null;
  attitude: number | null;
}

export interface VsTeam {
  value: number;
  teamAvg: number | null;
}

export interface VsRole {
  value: number | null;
  required: number;
}

export interface Capability {
  name: string | null;
  score: number | null;
  of: number;
  kasba: Kasba;
  assessedAt: string | null;
  vsTeam: VsTeam | null;
  /** UNDETERMINED while no role is assigned or no requirement is on file. */
  vsRole: VsRole | Undetermined;
  /** UNDETERMINED with a single assessment — one point is not a direction. */
  trajectory: Trajectory | Undetermined;
  /** The action that would make the missing part measurable, when there is one. */
  unlock: string | null;
}

export interface LoopCounts {
  signals: number;
  cases: number;
  decisions: number;
  executions: number;
}

export interface RecordsSummaryRow {
  type: string;
  count: number;
  from: string | null;
  to: string | null;
}

export interface RecordRow {
  id: string;
  date: string | null;
  type: string;
  recordKey: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  subCategory: string | null;
  /** Which attachment rule claimed this row, e.g. "Handled by". */
  matchedBy: string[];
  sourceFile: string | null;
  /** True when this row's date is one the datasets disagree about. */
  mismatch: boolean;
}

export interface RecordsPage {
  page: number;
  pageSize: number;
  total: number;
  items: RecordRow[];
}

export interface BlindSpot {
  dimension: string;
  reason: string;
  fixLabel: string;
  fixRoute: string;
}

export interface ScoreComponent {
  label: string;
  valuePct: number;
  weight: number;
  points: number;
  /** What the percentage was read from, in words. */
  basis: string;
}

export interface ScorePenalty {
  label: string;
  points: number;
}

export interface ScoreExplain {
  components: ScoreComponent[];
  penalty: ScorePenalty | null;
  total: number | null;
  note: string;
}

export interface Recommendation {
  title: string;
  body: string;
  confidence: number;
  rootCause: RootCause;
  meta: string | null;
  /**
   * Null when no plan flow can act on this recommendation. The UI hides the
   * button rather than rendering one that goes nowhere.
   */
  createPlanRoute: string | null;
}

export interface PersonIntelligence {
  person: PersonIdentity;
  standing: Standing;
  confidence: Confidence;
  sinceRefresh: SinceRefresh;
  contribution: Contribution;
  presence: Presence;
  consistency: Consistency;
  capability: Capability;
  loop: LoopCounts;
  recordsSummary: RecordsSummaryRow[];
  recordsPage: RecordsPage;
  blindSpots: BlindSpot[];
  scoreExplain: ScoreExplain;
  recommendation: Recommendation;
}

/** Narrowing helper, so callers never compare a union against a bare string. */
export function isUndetermined<T>(value: T | Undetermined): value is Undetermined {
  return value === UNDETERMINED;
}

export const personIntelligenceApi = {
  /** GET /people/{tenantId}/{id}/intelligence — the whole Person Profile. */
  get: async (
    tenantId: string,
    personId: string,
    options: { page?: number; pageSize?: number } = {},
  ): Promise<PersonIntelligence> => {
    const tenant = getAuthTenantId() || tenantId;
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('page_size', String(options.pageSize));
    const qs = params.toString();

    return (await request(
      `/people/${encodeURIComponent(tenant)}/${encodeURIComponent(personId)}/intelligence${qs ? `?${qs}` : ''}`,
    )) as PersonIntelligence;
  },
};
