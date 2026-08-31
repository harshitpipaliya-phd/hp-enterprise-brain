import { request } from './client.js';

/**
 * Derived operational intelligence — aggregates over the organization's own
 * imported records.
 *
 * EVERY FIELD THAT CAN BE UNMEASURABLE IS TYPED AS SUCH. `number | null` beside
 * a `supported: boolean` and a `reason: string | null` is not defensive typing;
 * it is the contract. The backend never sends 0 to mean "we could not work this
 * out", so the client must never render 0 for it either — the compiler is what
 * stops the two from drifting apart.
 */

/** A measure that may not be derivable from what the organization connected. */
export interface Measurable {
  supported: boolean;
  reason: string | null;
}

export interface Distribution {
  name: string;
  records: number;
  share: number | null;
}

export interface TrendPoint {
  period: string;
  records: number;
}

export interface Momentum {
  supported: boolean;
  reason?: string | null;
  change: number | null;
  direction: 'rising' | 'falling' | 'steady' | null;
  recentMonthlyAverage?: number;
  priorMonthlyAverage?: number;
}

export interface Concentration {
  supported: boolean;
  index: number | null;
  members: number;
  topShare: number | null;
  topMember?: string;
  band: string | null;
}

export interface ScoreDimension {
  key: string;
  label: string;
  weight: number;
  supported: boolean;
  score: number | null;
  band: string | null;
  statement: string;
  /** Present only on unsupported dimensions. */
  reason?: string;
  nextStep?: string;
  formula?: string;
  inputs?: Record<string, unknown>;
}

export interface Scorecard {
  tenantId: string;
  overall: number | null;
  band: string | null;
  measuredDimensions: number;
  unmeasuredDimensions: number;
  coverageOfModel: number | null;
  dimensions: ScoreDimension[];
  unmeasured: ScoreDimension[];
  strengths: Array<{ dimension: string; score: number; statement: string }>;
  risks: Array<{ dimension: string; score: number; severity: string; statement: string }>;
  opportunities: Array<{ dimension: string; reason: string; unlocks: string; weightIfMeasured: number }>;
  recommendedFocus: { type: string; dimension: string; score: number | null; why: string } | null;
  method: Record<string, string>;
}

export interface Insight {
  key: string;
  severity: 'high' | 'medium' | 'low';
  weight: number;
  title: string;
  whatHappened: string;
  whyItMatters: string | null;
  whatIsAtRisk: string | null;
  investigate: string | null;
  improve: string | null;
}

export interface LifecycleStage {
  key: string;
  label: string;
  count: number;
  state: 'flowing' | 'ready' | 'waiting' | 'dormant';
  message: string;
}

export interface HeadlineTile {
  value: number | null;
  label: string;
  detail: string;
  band?: string | null;
  unit?: string;
}

export interface OperationsOverview {
  tenantId: string;
  dataVersion: string;
  computedAt: string;
  computeMs: number;
  stale: { isStale: boolean; reason: string } | null;
  available: boolean;
  reason: string | null;
  headline: Record<string, HeadlineTile>;
  scorecard: Scorecard;
  insights: Insight[];
  lifecycle: LifecycleStage[];
  execution: Measurable & {
    completed: number;
    inProgress: number;
    open: number;
    cancelled: number;
    backlog: number;
    classified: number;
    completionRate: number | null;
    backlogRate: number | null;
    cancellationRate: number | null;
    contributingDatasets: string[];
  };
  service: Measurable & {
    subjects: number;
    repeatedSubjects: number;
    repeatRate: number | null;
    highestRepeatDataset: { dataset: string; repeatRate: number; subjects: number; repeated: number } | null;
  };
  responsiveness: Measurable & {
    measured: number;
    averageHours: number | null;
    withinDayRate: number | null;
    byDataset: Array<{ dataset: string; measured: number; averageHours: number; withinDayRate: number | null }>;
  };
  rankings: {
    datasets: Distribution[];
    departments: Distribution[];
    categories: Distribution[];
    zones: Distribution[];
    concentration: Record<string, Concentration> & { method?: string };
  };
  support: Record<string, unknown>;
  trend: {
    supported: boolean;
    reason: string | null;
    points: TrendPoint[];
    momentum: Momentum;
    busiestMonth: { period: string; records: number } | null;
  };
  derivation: Record<string, string>;
}

export interface DatasetIntelligence {
  dataset: string;
  label: string;
  records: number;
  share: number | null;
  earliest: string | null;
  latest: string | null;
  lastIngestedAt: string | null;
  spanDays: number | null;
  fields: Record<string, boolean>;
  execution: Measurable & {
    completed: number;
    inProgress: number;
    open: number;
    cancelled: number;
    classified: number;
    unclassified: number;
    classifiedShare: number | null;
    completionRate: number | null;
    openRate: number | null;
    cancellationRate: number | null;
    backlog: number | null;
    statuses: Distribution[];
  };
  turnaround: Measurable & {
    measured: number;
    coverage?: number | null;
    averageHours: number | null;
    fastestHours?: number;
    slowestHours?: number;
    withinDayRate: number | null;
  };
  recurrence: Measurable & {
    subjects: number;
    repeated?: number;
    repeatRate: number | null;
    worstSubjectAppearances?: number;
    recordsPerSubject?: number | null;
  };
  categories: Distribution[];
  categoryConcentration: Concentration;
  zones: Distribution[];
  actors: { distinct: number; recordsPerActor: number | null };
  subjects: { distinct: number };
  trend: TrendPoint[];
  momentum: Momentum;
}

export interface DepartmentActivity {
  label: string;
  records: number;
  share: number | null;
  datasets: number;
  primaryDataset: string;
  datasetBreakdown: Distribution[];
  completed: number;
  cancelled: number;
  backlog: number;
  classified: number;
  completionRate: number | null;
  cancellationRate: number | null;
  completionSupported: boolean;
  averageTurnaroundHours: number | null;
  turnaroundMeasured: number;
  trend: TrendPoint[];
  momentum: Momentum;
  rank: number;
  of: number;
  relative:
    | { supported: false; reason: string }
    | { supported: true; pointsVsAverage: number; organizationAverage: number; statement: string };
}

export interface SignalDetail {
  id: string;
  ruleKey: string;
  title: string;
  classification: string;
  severity: string;
  priority: string;
  status: string;
  resolved: boolean;
  confidence: number | null;
  evidenceCount: number;
  grounded: boolean;
  caseCount: number;
  departmentId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  ageDays: number | null;
  measurements: Array<{ key: string; label: string; value: string | number; format: string }>;
  scope: Array<{ group: string; name: string; count: number | null }>;
}

export interface LoopMetrics {
  tenantId: string;
  signals: {
    supported: boolean;
    reason: string | null;
    total: number;
    open?: number;
    resolved?: number;
    highSeverityOpen?: number;
    grounded?: number;
    ungrounded?: number;
    underInvestigation?: number;
    resolutionRate?: number | null;
    groundedRate?: number | null;
    averageConfidence?: number | null;
    bySeverity?: Array<{ name: string; label: string; count: number; share: number | null }>;
    byClassification?: Array<{ name: string; label: string; count: number; share: number | null }>;
    byStatus?: Array<{ name: string; label: string; count: number; share: number | null }>;
    distinctRules?: number;
    signals?: SignalDetail[];
    recent?: SignalDetail[];
  };
  evidence: {
    supported: boolean;
    reason: string | null;
    total: number;
    signalsCovered?: number;
    perSignalAverage?: number | null;
    bestSupportedSignal?: { signalId: string; evidenceCount: number } | null;
    averageConfidence?: number | null;
    newestAt?: string | null;
    oldestAt?: string | null;
    freshnessDays?: number | null;
    byType?: Array<{ name: string; label: string; count: number; share: number | null }>;
    bySource?: Array<{ name: string; label: string; count: number; share: number | null }>;
    byStatus?: Array<{ name: string; label: string; count: number; share: number | null }>;
    perSignal?: Record<string, number>;
    evidence?: Array<Record<string, unknown>>;
    recent?: Array<Record<string, unknown>>;
  };
  cases: {
    supported: boolean;
    reason: string | null;
    total: number;
    open?: number;
    closed?: number;
    withHypothesis?: number;
    withResolvedCause?: number;
    awaitingHypothesis?: number;
    averageAgeDays?: number | null;
    oldestOpenDays?: number | null;
    byStatus?: Array<{ name: string; label: string; count: number; share: number | null }>;
    bySeverity?: Array<{ name: string; label: string; count: number; share: number | null }>;
    cases?: Array<Record<string, unknown>>;
  };
  stages: LifecycleStage[];
  derivation: Record<string, string>;
}

export const operationsApi = {
  getOverview: (tenantId: string): Promise<OperationsOverview> =>
    request(`/operations/${tenantId}/overview`) as Promise<OperationsOverview>,

  getScorecard: (tenantId: string): Promise<Scorecard> =>
    request(`/operations/${tenantId}/scorecard`) as Promise<Scorecard>,

  getDatasets: (tenantId: string) => request(`/operations/${tenantId}/datasets`),

  getDepartments: (tenantId: string): Promise<{
    tenantId: string;
    supported: boolean;
    reason: string | null;
    departments: DepartmentActivity[];
    organizationAverageCompletionRate: number | null;
    concentration: Concentration | null;
  }> => request(`/operations/${tenantId}/departments`) as any,

  getTrends: (tenantId: string) => request(`/operations/${tenantId}/trends`),

  getLoop: (tenantId: string): Promise<LoopMetrics> =>
    request(`/operations/${tenantId}/loop`) as Promise<LoopMetrics>,
};

/* ─────────────────────────── shared formatters ───────────────────────────
   Kept beside the types rather than in each screen, because "how do we render
   a measure that could not be measured" is a product decision and it must be
   the same answer everywhere. A screen that renders 0 while its neighbour
   renders "Not measurable" is the exact confusion this whole layer exists to
   remove. */

/** The one sentence a screen shows in place of a number it does not have. */
export const NOT_MEASURABLE = 'Not measurable from connected sources';

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_MEASURABLE;
  return `${(value * 100).toFixed(digits)}%`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_MEASURABLE;
  return value.toLocaleString();
}

export function hours(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_MEASURABLE;
  if (value < 48) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} d`;
}

export function bandTone(band: string | null | undefined): 'good' | 'warn' | 'crit' | 'state' {
  switch (band) {
    case 'excellent':
    case 'healthy':
      return 'good';
    case 'watch':
      return 'warn';
    case 'needs attention':
      return 'crit';
    default:
      return 'state';
  }
}

export function scoreTone(score: number | null | undefined): 'good' | 'warn' | 'crit' | 'state' {
  if (score === null || score === undefined) return 'state';
  if (score >= 70) return 'good';
  if (score >= 55) return 'warn';
  return 'crit';
}

/** Month key `2026-08` → `Aug 26`, for axis labels that have to fit. */
export function monthLabel(period: string): string {
  const [year, month] = period.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const index = Number(month) - 1;
  return `${names[index] ?? month} ${year?.slice(2) ?? ''}`;
}
