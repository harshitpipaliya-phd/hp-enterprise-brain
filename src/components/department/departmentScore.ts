/**
 * DEPARTMENT INTELLIGENCE — ONE SCORE, DERIVED IN ONE PLACE.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS FILE EXISTS TO FIX
 *
 * The Departments screen published a score for every unit. Read down the cards
 * on Fiber Valley and every unstaffed department said exactly the same thing:
 *
 *     Cable Pulling      50 / 100   Watch
 *     CST                50 / 100   Watch
 *     Help Desk          50 / 100   Watch
 *     Management         50 / 100   Watch
 *
 * Not a placeholder, and not random — an ARITHMETIC ARTEFACT. The old model
 * averaged four components, of which only two could ever be measured for a unit
 * with nobody in it:
 *
 *     staffing = 0    because no one is assigned
 *     risk     = 100  because no open signal references a unit nobody works in
 *     ────────────────
 *     mean     = 50   published as "Watch"
 *
 * The mean of "there is nothing here" and "nothing is wrong here" is not a
 * health grade. It is the number you get when you average an absence with an
 * absence and forget which is which.
 *
 * The same model had a mirror defect at the other end. Staffing scored headcount
 * against the median unit — `clamp((headcount / median) * 60)` — so a department
 * 1.7x the median hit the 100 clamp, and CST · FVCPL was labelled
 * "100 / 100 Excellent" for the sole reason that it is large. Being big is not
 * being healthy; it is often the opposite, and the old model could not tell.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE THREE RULES THAT REPLACE IT
 *
 * 1. AN UNSTAFFED UNIT IS NOT SCORED AT ALL.
 *    Everything a department score measures — how its people are recorded, what
 *    they can do, what has been raised about their work — is undefined when
 *    there is no team. "No people assigned" is the finding. A number here would
 *    be a worse answer than no number.
 *
 * 2. A DIMENSION WITH NO INPUT LEAVES THE COMPOSITE; IT NEVER ENTERS AS A ZERO.
 *    "This organization has never recorded a capability assessment" and "this
 *    department assesses badly" are opposite findings. Averaging the first in as
 *    a 0 reports every department of a young organization as failing. Weight is
 *    redistributed across what remains — the same rule the Organization
 *    Intelligence engine already applies to its loop dimensions.
 *
 * 3. TOO LITTLE LEFT MEANS NO COMPOSITE.
 *    One measurable dimension is not an intelligence score. An organization
 *    where only record completeness can be measured would otherwise publish
 *    "Department Intelligence 100%" on the strength of everyone having a job
 *    title. Below MIN_SCORED_DIMENSIONS the composite is null and the UI says
 *    what is missing, by name.
 *
 * SIZE IS NOT A DIMENSION. It is reported — headcount, rank, share, median —
 * in the comparison block, as facts. It is never scored.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * UNIVERSAL BY CONSTRUCTION
 *
 * Nothing here knows an industry, a tenant or an organization. Every dimension
 * reads counts the server publishes for any tenant, and each is gated on a
 * `support` flag saying whether that organization records data of the kind at
 * all. A school, a telecom operator and a government body differ only in which
 * dimensions survive the gate.
 */

/* ========================================================================== */
/*  INPUTS — exactly what GET /departments/{tenant}/intelligence publishes     */
/* ========================================================================== */

export interface DepartmentMetrics {
  people: number;
  /*
    NULL MEANS THE PROBE COULD NOT RUN, and it is not the same as 0.

    MEASURED ON LIVE DATA. Fiber Valley's roster maps no `position` field, so
    the server cannot count who has a role recorded. Publishing 0 there — which
    the first version did — marked all five of its departments down for a column
    the source system does not have. A null probe is dropped from the average;
    a 0 is a real finding about the department.
  */
  peopleWithRole: number | null;
  peopleWithContact: number | null;
  peopleWithReference: number | null;

  capabilityAssessedPeople: number;
  capabilityCount: number;
  capabilityAverageLevel: number | null;

  signalsTotal: number;
  signalsOpen: number;
  signalsOpenHigh: number;
  signalsResolved: number;

  evidenceCount: number;

  casesTotal: number;
  casesOpen: number;

  decisionCount: number;
  decisionsApproved: number;
  decisionsWithOutcome: number;

  activityTotal: number;
  activityRecent: number;

  /*
    WHAT THE UNIT ACTUALLY DID — from the imported operational records.

    NULL MEANS THE ORGANIZATION'S IMPORTS DO NOT NAME AN OWNING UNIT, which is
    the same distinction every other field here draws and for the same reason. A
    department with `operationalRecords: 0` on an organization whose imports DO
    name units is a real finding — that unit records no work. One with `null` is
    a statement about the data, and the dimensions that read it are dropped.

    This is the dimension that changes what a department score means. Everything
    above measures how well the organization RECORDS a unit; these measure what
    the unit DELIVERED. On an operating business that is the more important half,
    and until the source's own department label reached an indexed column it
    could not be read at all.
  */
  operationalRecords: number | null;
  operationalCompleted: number | null;
  operationalCancelled: number | null;
  operationalBacklog: number | null;
  /** Null below the floor at which a published percentage is meaningful. */
  operationalCompletionRate: number | null;
  /** This unit's share of all attributed operational work. */
  operationalShare: number | null;
  operationalDatasets: number | null;
}

/**
 * Whether the ORGANIZATION records each family of data at all.
 *
 * This is the difference between a finding and a blind spot, and it cannot be
 * recovered from the counts: a department with `signalsTotal: 0` is either
 * clean or unmonitored, and only the tenant-wide flag says which.
 */
export interface DepartmentSupport {
  capability: boolean;
  signals: boolean;
  evidence: boolean;
  cases: boolean;
  decisions: boolean;
  activity: boolean;
  /** Whether this organization's imported records name an owning unit at all. */
  operational: boolean;
}

export const EMPTY_METRICS: DepartmentMetrics = {
  people: 0,
  peopleWithRole: null,
  peopleWithContact: null,
  peopleWithReference: null,
  capabilityAssessedPeople: 0,
  capabilityCount: 0,
  capabilityAverageLevel: null,
  signalsTotal: 0,
  signalsOpen: 0,
  signalsOpenHigh: 0,
  signalsResolved: 0,
  evidenceCount: 0,
  casesTotal: 0,
  casesOpen: 0,
  decisionCount: 0,
  decisionsApproved: 0,
  decisionsWithOutcome: 0,
  activityTotal: 0,
  activityRecent: 0,
  operationalRecords: null,
  operationalCompleted: null,
  operationalCancelled: null,
  operationalBacklog: null,
  operationalCompletionRate: null,
  operationalShare: null,
  operationalDatasets: null,
};

export const NO_SUPPORT: DepartmentSupport = {
  capability: false,
  signals: false,
  evidence: false,
  cases: false,
  decisions: false,
  activity: false,
  operational: false,
};

/* ========================================================================== */
/*  STATUS BANDS — configurable, with one definition for the whole product     */
/* ========================================================================== */

export type ScoreStatus = 'excellent' | 'healthy' | 'watch' | 'attention';

export interface ScoreThresholds {
  excellent: number;
  healthy: number;
  watch: number;
}

/**
 * The bands, in one place so a card, a detail page and a comparison row cannot
 * disagree about what 74% is called.
 *
 * Overridable — every function that reads them takes them as an argument — so an
 * organization that wants a stricter definition of "healthy" changes this object
 * rather than four call sites.
 */
export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  excellent: 90,
  healthy: 75,
  watch: 60,
};

export function scoreStatus(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): ScoreStatus {
  if (score >= thresholds.excellent) return 'excellent';
  if (score >= thresholds.healthy) return 'healthy';
  if (score >= thresholds.watch) return 'watch';
  return 'attention';
}

export function statusLabel(status: ScoreStatus): string {
  switch (status) {
    case 'excellent': return 'Excellent';
    case 'healthy': return 'Healthy';
    case 'watch': return 'Watch';
    default: return 'Needs attention';
  }
}

/**
 * Below this many measurable dimensions, no composite is published.
 *
 * Two rather than one, and the difference is not pedantry: record completeness
 * is measurable for every staffed department on every tenant, so a floor of one
 * would publish a confident percentage for an organization about which the only
 * known fact is that its staff have job titles recorded.
 */
export const MIN_SCORED_DIMENSIONS = 2;

/* ========================================================================== */
/*  DIMENSIONS                                                                */
/* ========================================================================== */

export interface Dimension {
  key: string;
  label: string;
  /** 0–100, or null when this organization cannot measure it at all. */
  score: number | null;
  weight: number;
  /** The sentence that makes the number checkable against the source data. */
  basis: string;
  /**
   * `observed` — measured from something recorded about this department.
   * `absence` — true because nothing was found, on a tenant that does look.
   *
   * Carried separately because an absence is weaker evidence than an
   * observation, and because averaging absences is what produced the 50.
   */
  kind: 'observed' | 'absence';
}

export interface DepartmentScore {
  /** 0–100, or null when too little is measurable to publish one honestly. */
  score: number | null;
  status: ScoreStatus | null;
  label: string | null;
  /** Present only when `score` is null: what is missing, in one sentence. */
  unscoredReason: string | null;
  /** Every dimension, including the ones that could not be measured. */
  dimensions: Dimension[];
  /** The dimensions that carried the composite. */
  measured: Dimension[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/**
 * Every dimension the model can express, measured or not.
 *
 * A dimension is returned even when its score is null — the detail page lists
 * what could NOT be measured and why, which is the part that tells an
 * organization how to make its own intelligence better.
 */
export function departmentDimensions(
  metrics: DepartmentMetrics,
  support: DepartmentSupport,
): Dimension[] {
  const people = Math.max(0, metrics.people);

  /* ------------------------------------------------------ record completeness
     Measurable for every staffed department on every tenant, because it needs
     nothing but the roster. NOT a judgement on the people: it measures the
     organization's RECORD of them. A team whose staff have no job title cannot
     be reasoned about, whatever those staff actually do. */
  const probes = [
    { label: 'a role', have: metrics.peopleWithRole },
    { label: 'contact details', have: metrics.peopleWithContact },
    { label: 'a reference', have: metrics.peopleWithReference },
  ].filter((p): p is { label: string; have: number } => p.have !== null && p.have !== undefined);

  const completenessRatio = people > 0 && probes.length > 0
    ? probes.reduce((sum, p) => sum + Math.min(1, p.have / people), 0) / probes.length
    : null;

  const weakest = [...probes].sort((a, b) => a.have - b.have)[0];

  const completeness: Dimension = {
    key: 'completeness',
    label: 'Record completeness',
    weight: 1,
    kind: 'observed',
    score: completenessRatio === null ? null : clamp(completenessRatio * 100),
    basis: people === 0
      ? 'No one is assigned to this unit, so there is no record to measure.'
      : weakest
        ? `${weakest.have.toLocaleString()} of ${people.toLocaleString()} ${plural(people, 'person', 'people')} ${plural(weakest.have, 'has', 'have')} ${weakest.label} recorded.`
        : 'This organization’s roster carries none of the fields completeness is measured from, so there is nothing to score.',
  };

  /* -------------------------------------------------------------- capability
     Two questions in one number: HOW MANY of the team have been assessed, and
     HOW WELL they assess. Coverage weighs more than depth because an unassessed
     team is a bigger gap than a competent one scoring slightly low. */
  const assessed = Math.min(metrics.capabilityAssessedPeople, people || metrics.capabilityAssessedPeople);
  const coverage = people > 0 ? Math.min(1, assessed / people) : null;
  const depth = metrics.capabilityAverageLevel === null ? null : Math.min(1, metrics.capabilityAverageLevel / 5);

  const capability: Dimension = {
    key: 'capability',
    label: 'Capability coverage',
    weight: 1.25,
    kind: 'observed',
    score: !support.capability || coverage === null
      ? null
      : depth === null
        ? clamp(coverage * 100)
        : clamp((coverage * 0.6 + depth * 0.4) * 100),
    basis: !support.capability
      ? 'This organization has not recorded any capability assessment, so capability cannot be measured for any department.'
      : coverage === null
        ? 'No one is assigned to this unit, so capability coverage has no denominator.'
        : assessed === 0
          ? `None of the ${people.toLocaleString()} ${plural(people, 'person', 'people')} here has been assessed, while other departments have been.`
          : `${assessed.toLocaleString()} of ${people.toLocaleString()} assessed across ${metrics.capabilityCount.toLocaleString()} ${plural(metrics.capabilityCount, 'capability', 'capabilities')}`
            + (metrics.capabilityAverageLevel !== null ? `, averaging ${metrics.capabilityAverageLevel.toFixed(1)} of 5.` : '.'),
  };

  /* ----------------------------------------------------------- signal health
     The one dimension that can legitimately be an ABSENCE. "No signal has been
     raised against this unit" is a fact established by looking, on a tenant
     whose signals do carry departments — so it scores well and is marked
     `absence` so the composite knows it is the weaker kind of evidence. */
  const hasSignals = metrics.signalsTotal > 0;
  const resolvedRatio = hasSignals ? metrics.signalsResolved / metrics.signalsTotal : null;

  const signal: Dimension = {
    key: 'signal',
    label: 'Signal health',
    weight: 1.25,
    kind: hasSignals ? 'observed' : 'absence',
    score: !support.signals
      ? null
      : hasSignals
        // Severity is subtracted rather than folded into the ratio: two open
        // criticals in a unit that resolved ninety other signals is still a
        // problem, and a ratio alone would hide it.
        ? clamp((resolvedRatio as number) * 100 - metrics.signalsOpenHigh * 12)
        : 100,
    basis: !support.signals
      ? 'This organization does not attribute signals to departments, so signal health cannot be measured.'
      : !hasSignals
        ? 'No signal has been raised against this unit, on an organization that does attribute signals to departments.'
        : `${metrics.signalsResolved.toLocaleString()} of ${metrics.signalsTotal.toLocaleString()} ${plural(metrics.signalsTotal, 'signal', 'signals')} resolved`
          + (metrics.signalsOpenHigh > 0
            ? `, with ${metrics.signalsOpenHigh.toLocaleString()} high-severity still open.`
            : '.'),
  };

  /* -------------------------------------------------------- evidence strength
     Whether this unit's signals are GROUNDED. A signal with no supporting
     record is an assertion; one carrying evidence can be checked. Measurable
     only where there are signals to ground. */
  const grounded = hasSignals ? Math.min(1, metrics.evidenceCount / metrics.signalsTotal) : null;

  const evidence: Dimension = {
    key: 'evidence',
    label: 'Evidence strength',
    weight: 0.75,
    kind: 'observed',
    score: !support.evidence || grounded === null ? null : clamp(grounded * 100),
    basis: !support.evidence
      ? 'No evidence has been recorded anywhere in this organization, so grounding cannot be measured.'
      : grounded === null
        ? 'No signal has been raised against this unit, so there is nothing for evidence to support.'
        : `${metrics.evidenceCount.toLocaleString()} supporting ${plural(metrics.evidenceCount, 'record', 'records')} behind ${metrics.signalsTotal.toLocaleString()} ${plural(metrics.signalsTotal, 'signal', 'signals')}.`,
  };

  /* -------------------------------------------------------- decision quality
     Over DECIDED decisions only. A proposal still in flight is not evidence
     either way, and counting it as unapproved would penalise a department for
     having work in progress. */
  const decided = metrics.decisionsWithOutcome;
  const approvalRatio = decided > 0 ? metrics.decisionsApproved / decided : null;

  const decision: Dimension = {
    key: 'decision',
    label: 'Decision quality',
    weight: 0.75,
    kind: 'observed',
    score: !support.decisions || approvalRatio === null ? null : clamp(approvalRatio * 100),
    basis: !support.decisions
      ? 'This organization has not recorded any decision, so decision quality cannot be measured.'
      : approvalRatio === null
        ? 'No decision belonging to this unit has reached an outcome yet.'
        : `${metrics.decisionsApproved.toLocaleString()} of ${decided.toLocaleString()} decided ${plural(decided, 'decision was', 'decisions were')} approved.`,
  };

  /* ------------------------------------------------------------- execution
     WHAT THE UNIT DELIVERED, not how well it is described.

     Completion against the unit's own recorded work, from the source system's
     own status words. This is the only dimension in the model that measures
     output rather than record quality, which is why it carries the heaviest
     weight: an organization would rather know that a unit closes 62% of its
     jobs than that its staff all have email addresses recorded.

     THREE SEPARATE REASONS IT CAN BE NULL, and they are different findings:
       - the organization's imports name no owning unit at all
       - they do, and this unit is named by none of them
       - it is named by too few for a percentage to mean anything
     Each says so in `basis`, and none of them scores zero. */
  const opRecords = metrics.operationalRecords;
  const opRate = metrics.operationalCompletionRate;

  const execution: Dimension = {
    key: 'execution',
    label: 'Execution health',
    weight: 1.5,
    kind: 'observed',
    score: !support.operational || opRate === null ? null : clamp(opRate * 100),
    basis: !support.operational
      ? 'This organization’s imported records do not name an owning unit, so delivered work cannot be attributed to a department.'
      : opRecords === null || opRecords === 0
        ? 'No imported record names this unit, so it has no recorded work to measure.'
        : opRate === null
          ? `Only ${opRecords.toLocaleString()} ${plural(opRecords, 'record', 'records')} with a resolvable status — too few for a completion percentage.`
          : `${(metrics.operationalCompleted ?? 0).toLocaleString()} of ${opRecords.toLocaleString()} recorded ${plural(opRecords, 'item', 'items')} completed`
            + (metrics.operationalCancelled ? `, ${metrics.operationalCancelled.toLocaleString()} cancelled.` : '.'),
  };

  /* ------------------------------------------------------------ backlog
     How much of the unit's recorded work is still in flight.

     SEPARATE FROM EXECUTION, because completion and backlog stop being two
     views of one number as soon as cancellations exist: a unit that completes
     70% and cancels 25% has a 5% backlog, and reporting that as "30%
     incomplete" would describe abandoned work as pending work. */
  const opBacklog = metrics.operationalBacklog;
  const backlogBase = opRecords ?? 0;
  const backlogRatio = support.operational && opBacklog !== null && backlogBase >= 30
    ? Math.min(1, opBacklog / backlogBase)
    : null;

  const backlog: Dimension = {
    key: 'backlog',
    label: 'Workload health',
    weight: 1,
    kind: 'observed',
    score: backlogRatio === null ? null : clamp((1 - backlogRatio) * 100),
    basis: !support.operational
      ? 'This organization’s imported records do not name an owning unit, so open workload cannot be attributed.'
      : backlogRatio === null
        ? 'This unit has too little recorded work for an open-workload figure to mean anything.'
        : `${(opBacklog ?? 0).toLocaleString()} of ${backlogBase.toLocaleString()} recorded ${plural(backlogBase, 'item is', 'items are')} still open or in progress.`,
  };

  return [completeness, capability, signal, evidence, decision, execution, backlog];
}

/**
 * The composite, or an honest refusal to publish one.
 *
 * Weighted mean over the measurable dimensions, with the missing ones' weight
 * redistributed rather than counted as zero. Returns `score: null` — never a
 * stand-in number — whenever the three rules at the top of this file are not
 * satisfied, and says which one stopped it.
 */
export function departmentScore(
  metrics: DepartmentMetrics,
  support: DepartmentSupport,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS,
): DepartmentScore {
  const dimensions = departmentDimensions(metrics, support);
  const measured = dimensions.filter((d) => d.score !== null);

  const unscored = (reason: string): DepartmentScore => ({
    score: null, status: null, label: null, unscoredReason: reason, dimensions, measured,
  });

  /*
    RULE 1 — a unit with neither people nor recorded work is not scored.

    NARROWED, DELIBERATELY. The original rule was "no people, no score", and it
    was right for a model in which every dimension measured how a unit's ROSTER
    is recorded: with nobody assigned, all of them are undefined and the
    composite was the meaningless mean of two absences.

    Execution health is not about the roster. A unit that closed nine thousand
    jobs has been measured, whatever its headcount says — and on this data
    headcount and recorded work diverge routinely, because the ERP assigns staff
    to some units and books work against others. Refusing to score a unit with
    nine thousand records because its establishment is empty would throw away the
    strongest measurement in the model to enforce a rule written before that
    measurement existed.

    So the gate is now "nothing measurable at all", which is what it was always
    trying to express.
  */
  const hasRecordedWork = (metrics.operationalRecords ?? 0) > 0;

  if (metrics.people <= 0 && !hasRecordedWork) {
    return unscored('No people are assigned to this unit and no imported record names it, so there is nothing to measure.');
  }

  /* RULE 3 — too little measurable to publish a composite. */
  if (measured.length < MIN_SCORED_DIMENSIONS) {
    const missing = dimensions
      .filter((d) => d.score === null)
      .map((d) => d.label.toLowerCase());

    return unscored(
      measured.length === 0
        ? 'Nothing about this unit can be measured yet.'
        : `Only ${measured[0].label.toLowerCase()} can be measured here — ${missing.join(', ')} ${plural(missing.length, 'is', 'are')} not recorded for this organization.`,
    );
  }

  /*
    RULE 2 — weighted mean over what survived, weights redistributed.

    Redistribution is what `sum(weight * score) / sum(weight)` does implicitly:
    the divisor is the surviving weight, not the original total, so a missing
    dimension neither drags the result down nor silently caps it.
  */
  const totalWeight = measured.reduce((sum, d) => sum + d.weight, 0);
  const weighted = measured.reduce((sum, d) => sum + d.weight * (d.score as number), 0);
  const score = clamp(weighted / totalWeight);
  const status = scoreStatus(score, thresholds);

  return {
    score,
    status,
    label: statusLabel(status),
    unscoredReason: null,
    dimensions,
    measured,
  };
}

/* ========================================================================== */
/*  INSIGHTS — strengths, risks and focus areas, from the same numbers         */
/* ========================================================================== */

export interface Insight {
  title: string;
  detail: string;
}

export interface DepartmentInsights {
  strengths: Insight[];
  risks: Insight[];
  focus: Insight[];
  /** True when nothing could be said honestly; the UI shows one line instead. */
  empty: boolean;
}

/**
 * What the numbers actually say, in sentences.
 *
 * EVERY LINE IS DERIVED. Nothing here is a template with an organization's name
 * dropped into it, and nothing fires without the data behind it — which is why
 * a department can legitimately produce no insights at all, and why `empty` is
 * part of the contract rather than something the UI has to infer from three
 * empty arrays.
 */
export function departmentInsights(
  metrics: DepartmentMetrics,
  support: DepartmentSupport,
  scored: DepartmentScore,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS,
): DepartmentInsights {
  const strengths: Insight[] = [];
  const risks: Insight[] = [];
  const focus: Insight[] = [];
  const people = metrics.people;

  const recordedWork = metrics.operationalRecords ?? 0;

  if (people === 0) {
    /*
      AN EMPTY ESTABLISHMENT AND NO RECORDED WORK IS ONE FINDING. AN EMPTY
      ESTABLISHMENT WITH NINE THOUSAND RECORDS IS A DIFFERENT ONE, and the
      earlier version could only say the first: it returned here unconditionally,
      so a unit that plainly does the work of the organization was reported as
      having nothing measurable about it.

      The second case is the more interesting finding, because it says the
      headcount and the work are booked against different units — which is a
      real data problem worth surfacing, and not the same as "this unit does
      nothing".
    */
    risks.push({
      title: 'No one is assigned to this unit',
      detail: recordedWork > 0
        ? `The unit holds no people in the connected HR system, yet ${recordedWork.toLocaleString()} imported ${plural(recordedWork, 'record names', 'records name')} it as the owner of work. Staffing and delivery are being booked against different units.`
        : 'The unit exists in the connected source system but holds no people, so nothing about its work can be measured. Either its staff are recorded against another unit, or the assignment was never made.',
    });
    focus.push({
      title: recordedWork > 0 ? 'Reconcile the roster with the work' : 'Assign people, or retire the unit',
      detail: recordedWork > 0
        ? 'The operational measures below are real and attributed by the source system. Everything that depends on headcount stays unmeasurable until people are recorded against this unit.'
        : 'Until someone is recorded here, this department cannot contribute to organizational intelligence and will stay unscored.',
    });

    // Fall through rather than return: the operational findings below do not
    // depend on headcount, and this unit may have plenty of them.
  }

  const byKey = new Map(scored.dimensions.map((d) => [d.key, d]));
  const dim = (key: string) => byKey.get(key);

  /* -------------------------------------------------------------- strengths */

  for (const d of scored.measured) {
    if ((d.score as number) >= thresholds.excellent && d.kind === 'observed') {
      strengths.push({ title: d.label, detail: d.basis });
    }
  }

  if (support.signals && metrics.signalsTotal > 0 && metrics.signalsOpen === 0) {
    strengths.push({
      title: 'Every signal raised here has been closed',
      detail: `All ${metrics.signalsTotal.toLocaleString()} ${plural(metrics.signalsTotal, 'signal', 'signals')} recorded against this unit have been resolved, closed or dismissed.`,
    });
  }

  if (support.activity && metrics.activityRecent > 0) {
    strengths.push({
      title: 'The record is current',
      detail: `${metrics.activityRecent.toLocaleString()} recorded ${plural(metrics.activityRecent, 'event', 'events')} in the last 30 days, out of ${metrics.activityTotal.toLocaleString()} in total.`,
    });
  }

  /* ------------------------------------------------------------------ risks */

  if (metrics.signalsOpenHigh > 0) {
    risks.push({
      title: `${metrics.signalsOpenHigh.toLocaleString()} high-severity ${plural(metrics.signalsOpenHigh, 'signal', 'signals')} still open`,
      detail: 'Unaddressed and attributed to this department. These carry the most weight against its signal health.',
    });
  } else if (metrics.signalsOpen > 0) {
    risks.push({
      title: `${metrics.signalsOpen.toLocaleString()} open ${plural(metrics.signalsOpen, 'signal', 'signals')}`,
      detail: `Raised against this unit and not yet resolved, out of ${metrics.signalsTotal.toLocaleString()} recorded in total.`,
    });
  }

  if (metrics.casesOpen > 0) {
    risks.push({
      title: `${metrics.casesOpen.toLocaleString()} active ${plural(metrics.casesOpen, 'investigation', 'investigations')}`,
      detail: 'Open cases reaching this department through the signals they were opened on.',
    });
  }

  const completeness = dim('completeness');
  if (people > 0 && completeness?.score !== null && completeness !== undefined && (completeness.score as number) < thresholds.watch) {
    const recorded = [metrics.peopleWithRole, metrics.peopleWithContact, metrics.peopleWithReference]
      .filter((v): v is number => v !== null && v !== undefined);
    const gap = people - (recorded.length > 0 ? Math.min(...recorded) : people);
    risks.push({
      title: 'People here are incompletely recorded',
      detail: `${gap.toLocaleString()} of ${people.toLocaleString()} ${plural(people, 'person is', 'people are')} missing at least one core field. Incomplete records limit every other measure that depends on them.`,
    });
  }

  if (people > 0 && support.capability && metrics.capabilityAssessedPeople === 0) {
    risks.push({
      title: 'No one here has been assessed for capability',
      detail: `Other departments in this organization have capability assessments recorded; none of the ${people.toLocaleString()} ${plural(people, 'person', 'people')} in this unit does. Its strengths and gaps cannot be compared with theirs.`,
    });
  }

  if (support.activity && metrics.activityTotal > 0 && metrics.activityRecent === 0) {
    risks.push({
      title: 'Nothing recorded here in the last 30 days',
      detail: `${metrics.activityTotal.toLocaleString()} ${plural(metrics.activityTotal, 'event is', 'events are')} recorded against this unit, but none of them recently. Its intelligence rests on older data than the rest of the organization's.`,
    });
  }

  /* ------------------------------------------------- delivered work findings
     The measures that describe what the unit DID rather than how it is
     recorded. Each fires only on a real threshold crossing, so a unit whose
     delivery is unremarkable produces none of them. */

  if (support.operational && recordedWork > 0) {
    const share = metrics.operationalShare;
    const rate = metrics.operationalCompletionRate;
    const openWork = metrics.operationalBacklog ?? 0;

    if (share !== null && share >= 0.35) {
      risks.push({
        title: `This unit carries ${(share * 100).toFixed(1)}% of the organization's recorded work`,
        detail: `${recordedWork.toLocaleString()} of every attributed record belongs to this unit. A disruption here affects most of what the organization does, and organization-wide averages largely describe this unit rather than the rest.`,
      });
    }

    if (rate !== null && rate >= 0.9) {
      strengths.push({
        title: 'Recorded work is closed out',
        detail: `${(metrics.operationalCompleted ?? 0).toLocaleString()} of ${recordedWork.toLocaleString()} recorded items have reached a completed state — ${(rate * 100).toFixed(1)}%.`,
      });
    }

    if (rate !== null && rate < 0.6) {
      risks.push({
        title: `Only ${(rate * 100).toFixed(1)}% of this unit's recorded work is complete`,
        detail: `${openWork.toLocaleString()} ${plural(openWork, 'item is', 'items are')} still open or in progress`
          + (metrics.operationalCancelled ? `, and ${metrics.operationalCancelled.toLocaleString()} ended cancelled.` : '.'),
      });
    }

    if ((metrics.operationalCancelled ?? 0) > 0 && recordedWork > 0) {
      const cancelRate = (metrics.operationalCancelled as number) / recordedWork;

      if (cancelRate >= 0.2) {
        risks.push({
          title: `${(cancelRate * 100).toFixed(1)}% of this unit's work ends cancelled`,
          detail: `${(metrics.operationalCancelled as number).toLocaleString()} of ${recordedWork.toLocaleString()} records reached a cancelled, rejected or failed state. That is capacity spent on work that produced nothing.`,
        });
      }
    }

    if ((metrics.operationalDatasets ?? 0) > 1) {
      strengths.push({
        title: 'Work is recorded across several workflows',
        detail: `${(metrics.operationalDatasets as number).toLocaleString()} distinct imported datasets name this unit, so its intelligence rests on more than one kind of record.`,
      });
    }
  }

  /* ------------------------------------------------------------ focus areas */

  for (const d of scored.measured) {
    if ((d.score as number) < thresholds.watch) {
      focus.push({ title: `Improve ${d.label.toLowerCase()}`, detail: d.basis });
    }
  }

  // What cannot be measured at all is the most actionable thing on the page:
  // it names the data the organization has not started collecting.
  const unmeasurable = scored.dimensions.filter((d) => d.score === null);
  if (unmeasurable.length > 0 && scored.score !== null) {
    focus.push({
      title: `${unmeasurable.length} ${plural(unmeasurable.length, 'dimension is', 'dimensions are')} not measurable yet`,
      detail: `${unmeasurable.map((d) => d.label).join(', ')} — recording this data would make the score above cover more of what this department does.`,
    });
  }

  return {
    strengths,
    risks,
    focus,
    empty: strengths.length === 0 && risks.length === 0 && focus.length === 0,
  };
}

/* ========================================================================== */
/*  COMPARISON — where this unit sits among its peers                          */
/* ========================================================================== */

export interface DepartmentPosition {
  /** Mean of every department that could be scored. Null when fewer than two. */
  organizationAverage: number | null;
  rank: number | null;
  scoredPeers: number;
  /** Percentage points above or below the organization average. */
  delta: number | null;
  /** Departments the organization holds that could not be scored at all. */
  unscored: number;
}

/**
 * This department against the others, computed from the scores actually
 * published — never from the whole department list.
 *
 * A unit that could not be scored is EXCLUDED from the average rather than
 * entering it as a zero, for the same reason an unmeasurable dimension leaves
 * the composite. Including six unscored units would drag an organization
 * average down to something no department recognises, and "#2 of 13" would be a
 * ranking against units that were never in the race.
 */
export function departmentPosition(
  scores: Map<string, number | null>,
  departmentId: string,
): DepartmentPosition {
  const values: number[] = [];
  let unscored = 0;

  for (const value of scores.values()) {
    if (value === null) unscored += 1;
    else values.push(value);
  }

  const own = scores.get(departmentId);

  if (own === null || own === undefined || values.length < 2) {
    return {
      organizationAverage: values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null,
      rank: null,
      scoredPeers: values.length,
      delta: null,
      unscored,
    };
  }

  const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return {
    organizationAverage: average,
    rank: values.filter((v) => v > own).length + 1,
    scoredPeers: values.length,
    delta: own - average,
    unscored,
  };
}
