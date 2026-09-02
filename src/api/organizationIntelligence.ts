import { request } from './client.js';

/**
 * Organization intelligence — the deterministic engine behind the Analytics screens.
 *
 * ONE MODULE PER QUESTION, mirroring the endpoints. No screen composes intelligence
 * from several general-purpose endpoints, because that is how two screens end up
 * showing different numbers for the same organization: the composition happens once,
 * on the server, in dependency order.
 *
 * NOTHING HERE COMPUTES. Not a percentage, not a ranking, not a confidence. Every
 * figure these types describe arrives derived, with its provenance and its
 * confidence attached, and the screens render what they are given. A frontend that
 * recomputes a rate is a second definition of that rate.
 *
 * NULL IS A VALUE. `number | null` appears throughout on purpose: null means the
 * organization has no input for that figure, and the components in ui/layers.tsx
 * render it as "never measured" rather than as zero. Any code that coalesces one of
 * these to 0 is converting "nobody looked" into "the answer is none".
 */

/* ─────────────────────────── shared shapes ─────────────────────────── */

export interface ProvenanceSource {
  table: string;
  filter: Record<string, unknown>;
  rows: number;
}

export interface Provenance {
  computation: string;
  sources: ProvenanceSource[];
  totalRows: number;
}

export interface ConfidenceComponent {
  key: string;
  weight: number;
  /** null when the input for this component does not exist for this organization. */
  value: number | null;
  basis: string;
}

export interface ConfidenceValue {
  /** null is UNDETERMINED, never zero. */
  value: number | null;
  band: 'high' | 'moderate' | 'low' | 'very low' | 'undetermined';
  components: ConfidenceComponent[];
  /** Components whose input was missing, so their weight was redistributed. */
  unmeasured: string[];
}

export interface EvidenceRef {
  what: string;
  count: number;
  table?: string;
}

/** Metadata every endpoint returns, so panels can be checked for agreement. */
export interface IntelligenceMeta {
  tenantId: string;
  /** Fingerprint of the source data the response was computed from. */
  dataVersion: string;
  computedAt: string;
  computeMs: number;
}

export interface Derivation {
  method: string;
  llm: string;
  scope: string;
  liveness: string;
}

export interface ExecutiveInterpretation {
  status: 'available' | 'unavailable';
  reason?: string;
  detail?: string | null;
  model?: string;
  dataVersion: string;
  generatedAt: string;
  executive_summary: string;
  organizational_state: {
    overall_assessment: string;
    strengths: string[];
    weaknesses: string[];
    confidence: number | null;
  };
  critical_findings: {
    title: string;
    observed_fact: string;
    inference: string;
    why_it_matters: string;
    evidence: string[];
    confidence: number | null;
    severity: string;
    impact: string;
  }[];
  root_causes: {
    cause: string;
    affected_area: string;
    observed_fact: string;
    inference: string;
    evidence: string[];
    confidence: number | null;
  }[];
  blind_spots: string[];
  risks: string[];
  opportunities: string[];
  recommendations: {
    title: string;
    priority: 'critical' | 'high' | 'medium' | 'low' | string;
    observed_fact: string;
    problem: string;
    action: string;
    why: string;
    how: string;
    evidence: string[];
    expected_benefit: string;
    expected_impact: string;
    effort: string;
    time_horizon: string;
    confidence: number | null;
  }[];
  next_steps: string[];
  guardrails: Record<string, string>;
}

/* ─────────────────────────── state ─────────────────────────── */

export interface StateDimension {
  key: string;
  label: string;
  movement: 'Perceive' | 'Understand' | 'Act' | 'Learn';
  weight: number;
  /** null means the dimension had no measurable input at all. */
  score: number | null;
  band: string;
  stage: 'absent' | 'emerging' | 'developing' | 'established' | 'compounding' | 'undetermined';
  factors: ConfidenceComponent[];
  unmeasured: string[];
  why: string;
  /** Set when this dimension having no input blocks the loop downstream of it. */
  blocking: string | null;
}

export interface Trend {
  key: string;
  area: string;
  metric: 'volume' | 'closureRate' | 'measure';
  label: string;
  unit: string;
  direction: 'rising' | 'falling' | 'flat';
  slope: number;
  /** t-statistic. |t| >= 2 is what promotes a slope out of `flat`. */
  significance: number;
  periods: number;
  periodLabels: string[];
  series: (number | null)[];
  observedMin: number | null;
  observedMax: number | null;
  fitQuality: number | null;
  fittedFirst: number;
  fittedLast: number;
  changePct: number | null;
  risingMeans: string;
  provenance: Provenance;
}

export interface OrganizationalState extends IntelligenceMeta {
  state: {
    overall: {
      score: number | null;
      band: string;
      stage: string;
      weightMeasured: number;
      weightUnmeasured: number;
      dimensionsMeasured: number;
      dimensionsUnmeasured: number;
      why: string;
    };
    dimensions: StateDimension[];
    byMovement: { movement: string; score: number | null; dimensions: string[]; unmeasured: number }[];
    strengths: StateDimension[];
    weaknesses: StateDimension[];
    unmeasured: StateDimension[];
    headline: string[];
    method: Record<string, string>;
  };
  totals: { operationalRecords: number; datasets: number; loopRecords: number };
  movement: { moving: Trend[]; method: Record<string, string> };
  consequence: {
    criticalGaps: number;
    openRisks: number;
    unownedRisks: number;
    firstAction: { id: string; recommendation: string; why: string; nextAction: string } | null;
  };
}

/* ─────────────────────────── knowledge ─────────────────────────── */

export interface KnowledgePattern {
  value: string;
  records: number;
  closed: number;
  /** Distinct calendar months the value appears in — recurrence, not volume. */
  periods: number;
  firstAt: string | null;
  lastAt: string | null;
  meanMetric: number | null;
  owners: number;
}

export interface KnowledgeDomain {
  key: string;
  domain: string;
  source: 'operational_records' | 'mental_models';
  /** The classifier column the domain is described along; null when none qualified. */
  axis: string | null;
  axisLabel: string | null;
  records: number;
  patterns: number;
  patternDetail: KnowledgePattern[];
  unsupportedValues: number;
  reinforcement: number;
  reinforcementBasis: string;
  coverage: number | null;
  concentration: number | null;
  topPattern: string | null;
  firstAt: string | null;
  lastAt: string | null;
  measure: {
    unit: string | null;
    count: number;
    coverage: number | null;
    mean: number | null;
    min: number | null;
    max: number | null;
    stdDev: number | null;
    negatives: number;
    median: number | null;
    p95: number | null;
  } | null;
  confidence: ConfidenceValue;
  fragile: boolean;
  fragileReasons: string[];
  provenance: Provenance;
}

export interface BlindSpot {
  kind: 'never_recorded' | 'no_variance' | 'mostly_unrecorded' | 'no_conclusion';
  area: string;
  field: string;
  title: string;
  detail: string;
  records: number;
  share: number;
}

export interface KnowledgeIntelligence extends IntelligenceMeta {
  state: {
    domains: number;
    domainsMeasured: number;
    wellEarned: number;
    fragile: number;
    patterns: number;
    reinforcement: number;
    meanConfidence: number | null;
    strongestDomain: string | null;
    mostExposedDomain: string | null;
  };
  domains: KnowledgeDomain[];
  evidence: {
    signals: number;
    evidence: number;
    signalsCovered: number;
    signalsUncovered: number;
    coverage: number | null;
    meanConfidence: number | null;
    perSignal: number | null;
    undated: number;
    lastAt: string | null;
    confidenceBands: Record<string, number>;
    provenance: Provenance;
  };
  blindSpots: BlindSpot[];
  learnNext: {
    domain: string;
    key: string;
    exposure: number;
    records: number;
    confidence: number | null;
    reason: string;
    weakestComponent: { key: string; value: number | null; basis: string } | null;
  }[];
  definitions: Record<string, string>;
  trends: Trend[];
  concentrations: { area: string; field: string; value: string; records: number; of: number; share: number; title: string; detail: string }[];
  method: Record<string, string>;
  derivation: Derivation;
  interpretation: ExecutiveInterpretation;
}

/* ─────────────────────────── decisions and risk ─────────────────────────── */

export interface Risk {
  id: string;
  title: string;
  area: string;
  detail: string;
  generator: string;
  rootCauseFamily: string;
  likelihood: number | null;
  likelihoodBand: number | null;
  likelihoodBasis: string;
  impact: number | null;
  impactBand: number | null;
  /** How impact was arrived at. `magnitude_proxy` is explicitly NOT a cost estimate. */
  impactKind: 'magnitude_proxy' | 'structural' | 'assessed';
  impactBasis: string;
  severity: number | null;
  severitySource: 'computed' | 'as stored';
  state: string;
  /** false means the risk was derived on read and has no register entry to own. */
  registered: boolean;
  owner: string | null;
  evidence: EvidenceRef[];
  affectedRecords?: number;
  confidence: ConfidenceValue;
  recommendedAction: string;
  provenance: Provenance;
}

export interface QuadrantPointData {
  category: string;
  recommendations: number;
  accepted: number;
  evidenced?: number;
  outcomes?: number;
  successes?: number;
  acceptance: number | null;
  evidenceSupport?: number | null;
  accuracy?: number | null;
  meanConfidence?: number | null;
}

export interface DecisionIntelligenceData extends IntelligenceMeta {
  state: {
    decisions: number;
    pipeline: { pending: number; approved: number; rejected: number };
    acceptanceRate: number | null;
    rejectionRate: number | null;
    recommendations: number;
    decisionCoverage: number | null;
    meanConfidence: number | null;
    /** Rows written by a seeder rather than decided by a person. */
    syntheticDecisions: number;
    provenanceNote: string | null;
  };
  latency: { measurable: boolean; pairs: number; meanHours: number | null; minHours: number | null; maxHours: number | null; why: string; provenance: Provenance };
  accuracy: {
    measurable: boolean;
    value: number | null;
    outcomes: number;
    successes: number;
    failures?: number;
    /** Named tables whose absence makes this unmeasurable. */
    gaps: string[];
    why: string;
    howToFix?: string;
    confidence: ConfidenceValue;
    provenance: Provenance;
  };
  quality: {
    withoutRecommendation: number;
    withoutRationale: number;
    belowConfidenceFloor: number;
    confidenceFloor: number;
    unevidenced: { total: number; evidenced?: number; unevidenced: number; share: number | null };
  };
  byExecutor: Record<string, number>;
  categoryByExecutor: Record<string, Record<string, number>>;
  byCategory: { category: string; recommendations: number; meanConfidence: number | null; highPriority: number }[];
  acceptanceVsEvidence: { measurable: boolean; points: QuadrantPointData[]; xLabel: string; yLabel: string; hotCorner: string; why: string; provenance: Provenance };
  /**
   * Only populated when outcomes exist. When `measurable` is false the labels and
   * provenance are absent — there is nothing to plot and nothing to trace — so both
   * are optional rather than being sent as empty strings a chart would render.
   */
  acceptanceVsAccuracy: {
    measurable: boolean;
    points: QuadrantPointData[];
    xLabel?: string;
    yLabel?: string;
    hotCorner?: string;
    why: string;
    gaps?: string[];
    provenance?: Provenance;
  };
  openBeyond: { open: number; meanDays: number | null; maxDays: number | null };
  rootCause: {
    source: 'hypotheses' | 'derived_from_risks';
    distribution: { family: string; count: number }[];
    why: string;
    provenance: Provenance;
  };
  confidenceBands: { band: string; count: number }[];
  risks: {
    open: number;
    mitigated: number;
    registered: number;
    derived: number;
    unowned: number;
    maxSeverity: number | null;
    matrix: {
      cells: { likelihood: number; impact: number; count: number; maxSeverity: number | null; risks: { id: string; title: string; severity: number | null }[] }[];
      unplaceable: { id: string; title: string }[];
    };
    register: Risk[];
    method: Record<string, string>;
  };
  derivation: Derivation;
  interpretation: ExecutiveInterpretation;
}

/* ─────────────────────────── gaps and recommendations ─────────────────────────── */

export interface Gap {
  id: string;
  kind: string;
  area: string;
  title: string;
  detail: string;
  whyItMatters: string;
  /** What would have to become true, in records rather than intentions. */
  closedWhen: string;
  reach: number;
  reachBasis: string;
  consequence: number;
  severity: number;
  band: 'critical' | 'high' | 'medium' | 'low';
  evidence: EvidenceRef[];
  confidence: ConfidenceValue;
  provenance: Provenance;
}

export interface Benefit {
  category: string;
  /** Never a bare figure: how well the claim is supported is part of the claim. */
  label: 'Observed' | 'Estimated' | 'Projected' | 'Unknown';
  statement: string;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  why: string;
  affectedRecords?: number;
}

export interface Recommendation {
  id: string;
  rank: number;
  source: 'gap' | 'risk' | 'knowledge';
  sourceId: string;
  sourceKind: string | null;
  recommendation: string;
  area: string;
  why: string;
  finding: string;
  evidence: EvidenceRef[];
  confidence: ConfidenceValue;
  severity: number;
  /** How readily the finding can be closed. Part of the priority formula. */
  tractability: number;
  priorityScore: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'blocking' | 'rising' | 'steady';
  benefit: Benefit;
  effort: { measurable: boolean; unit?: string; value?: number; basis: string };
  /** Which of the four execution capabilities the action needs. */
  esoType: 'Assessment' | 'Learning' | 'Workflow' | 'Communication';
  /**
   * The executable object this action is bound to, or null.
   *
   * A binding exists only where an ESO in this organization's catalogue names
   * this recommendation's gap kind in its own `gap_types`. Nothing is inferred
   * from wording, so a null here means no ESO claims this finding — and
   * `esoNote` says which of the two reasons applies.
   */
  esoId: string | null;
  esoCode?: string | null;
  esoName?: string | null;
  /** False for a matched ESO that is withdrawn: viewable, but not runnable. */
  esoRunnable?: boolean;
  esoNote: string;
  nextAction: string;
  dependencies: { recommendationId: string; because: string }[];
  provenance: Provenance;
}

export interface GapsResponse extends IntelligenceMeta {
  gaps: Gap[];
  total: number;
  critical: number;
  high: number;
  byArea: Record<string, number>;
  method: Record<string, string>;
  derivation: Derivation;
}

export interface RecommendationsResponse extends IntelligenceMeta {
  recommendations: Recommendation[];
  total: number;
  critical: number;
  firstAction: { id: string; recommendation: string; why: string; nextAction: string } | null;
  method: Record<string, string>;
  derivation: Derivation;
  interpretation: ExecutiveInterpretation;
}

/* ─────────────────────────── the client ─────────────────────────── */

const base = (tenantId: string) => `/organization-intelligence/${encodeURIComponent(tenantId)}`;

/**
 * `fresh` bypasses the cached entry for the current data version.
 *
 * Rarely correct to pass. The server keys its cache on a fingerprint of the source
 * rows, so any change to the organization's data already invalidates it — passing
 * fresh on every read just recomputes the same answer.
 */
const query = (fresh?: boolean) => (fresh ? '?fresh=1' : '');

export const organizationIntelligenceApi = {
  getState: (tenantId: string, fresh?: boolean): Promise<OrganizationalState> =>
    request(`${base(tenantId)}/state${query(fresh)}`),

  getKnowledge: (tenantId: string, fresh?: boolean): Promise<KnowledgeIntelligence> =>
    request(`${base(tenantId)}/knowledge${query(fresh)}`),

  getDecisions: (tenantId: string, fresh?: boolean): Promise<DecisionIntelligenceData> =>
    request(`${base(tenantId)}/decisions${query(fresh)}`),

  getRisks: (tenantId: string, fresh?: boolean) =>
    request(`${base(tenantId)}/risks${query(fresh)}`),

  getCapability: (tenantId: string, fresh?: boolean) =>
    request(`${base(tenantId)}/capability${query(fresh)}`),

  getGaps: (tenantId: string, fresh?: boolean): Promise<GapsResponse> =>
    request(`${base(tenantId)}/gaps${query(fresh)}`),

  getRecommendations: (tenantId: string, fresh?: boolean): Promise<RecommendationsResponse> =>
    request(`${base(tenantId)}/recommendations${query(fresh)}`),

  /** What the intelligence is computed from — the audit surface. */
  getProfile: (tenantId: string, fresh?: boolean) =>
    request(`${base(tenantId)}/profile${query(fresh)}`),
};
