import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, Boxes, CheckCircle2, ClipboardList, Eye, FileText, GitBranch,
  ListChecks, PlayCircle, RefreshCw, ShieldCheck, Target,
} from 'lucide-react';
import { esoApi } from '../../api/eso';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type { Recommendation, RecommendationsResponse } from '../../api/organizationIntelligence';
import { Panel, ConsequenceEmpty, Button, Spinner, ErrorState } from '../../ui';
import { IntelligenceHeader, count } from './intelligenceUi';
import './OrganizationIntelligence.css';
// intel-form-grid and intel-inline-list live here, not in the globally loaded
// refine.css. Without this import the run form rendered unstyled whenever this
// lazy route was opened before any screen that does import it.
import './IntelligenceSuite.css';
import './EsoLibrary.css';

/**
 * THE ESO LIBRARY — what this organization can actually execute.
 *
 * The screen answers seven questions in this order, and the order is the
 * product: what is this ESO, when should I use it, what does it do, what does
 * it need, has it worked before, what evidence supports that, and can I run it.
 *
 * TWO RULES GOVERN EVERY FIGURE HERE.
 *
 * 1. COMPLETION IS NOT SUCCESS. An execution that reached 'completed' says the
 *    action was taken. It says nothing about whether the organization is better
 *    off. Where runs exist but no outcome or efficacy record does, this screen
 *    prints one sentence — "Outcome evidence unavailable — efficacy not yet
 *    measurable." — and prints no rate, no score and no trend beside it. A
 *    success percentage computed from completion counts would be the single
 *    most damaging number this product could show, because it would look
 *    exactly like a real one.
 *
 * 2. NOTHING IS SHOWN THAT THE SERVER DID NOT SEND. Every list, count and
 *    binding on this screen comes from hpbrain_ rows for the current tenant. An
 *    empty section says it is empty and says what that means. The screen this
 *    replaces shipped two hardcoded ESO definitions and a hardcoded efficacy
 *    record, which is why the rule is written down here.
 *
 * RUNNING IS REAL, AND THAT IS WHY IT ASKS FOR SO MUCH. Starting an execution
 * requires an approved decision, a measurement plan that pre-dates the run
 * (Invariant 4), every input the ESO declares, and an explicit confirmation of
 * the preconditions it names. The run panel below collects exactly those and
 * nothing else, and the server checks all of them again — see EsoPreflight.
 */

// Must match App\Domain\Eso\EsoEfficacy::UNMEASURABLE_MESSAGE exactly. The same
// condition described two different ways reads as two different findings.
const UNMEASURABLE = 'Outcome evidence unavailable — efficacy not measurable.';

interface EfficacyRecord {
  id: string;
  gapType: string | null;
  population: string | null;
  efficacyScore: number | null;
  sampleSize: number | null;
  computedDate: string | null;
}

interface Blocker {
  code: string;
  message: string;
}

interface InputSpec {
  name: string;
  type: string | null;
  required: boolean;
  description: string | null;
}

interface Readiness {
  runnable: boolean;
  blockers: Blocker[];
  executorClasses: string[];
  executorClassRestricted: boolean;
  trustLevel: string | null;
  trustLevelNote: string;
  requiredInputs: InputSpec[];
  optionalInputs: InputSpec[];
  unverifiableInputs: string[];
  preconditions: string[];
  preconditionsRequireAcknowledgement: boolean;
  preconditionNote: string;
}

interface ExecutionRecord {
  id: string;
  decisionId: string | null;
  status: string;
  executedBy: string | null;
  executorType: string | null;
  error: string | null;
  startedDate: string | null;
  completedDate: string | null;
  createdDate: string | null;
}

interface OutcomeRecord {
  id: string;
  executionId: string;
  result: string;
  metrics: unknown;
  feedback: string | null;
  confidence: number | null;
  createdDate: string | null;
}

interface EvidenceRecord {
  id: string;
  executionId: string;
  evidenceType: string | null;
  source: string | null;
  confidence: number | null;
  status: string | null;
  linkedDate: string | null;
}

interface EfficacyContribution {
  executionId: string;
  decisionId: string | null;
  status: string;
  executedBy: string | null;
  completedDate: string | null;
  counted: boolean;
  score: number | null;
  verdict: string | null;
  metric: string | null;
  baseline: number | null;
  target: number | null;
  actual: number | null;
  unit: string | null;
  outcomeResult: string | null;
  outcomeConfidence: number | null;
  outcomeId: string | null;
  reason: string | null;
}

/**
 * The server's answer to "did this work", with its workings.
 *
 * `score` is null in every state except MEASURABLE. That is load-bearing: a 0
 * means "measured, and it went the wrong way", which is the opposite finding
 * from "we cannot tell", and the UI must never render one as the other.
 */
interface EfficacyAnalysis {
  status: 'NOT_MEASURABLE' | 'INSUFFICIENT_EVIDENCE' | 'MEASURABLE';
  message: string | null;
  explanation: string;
  score: number | null;
  verdict: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  sampleSize: number;
  executionsConsidered: number;
  confidence: number | null;
  metric: string | null;
  contributions: EfficacyContribution[];
}

interface LoopNode {
  kind: string;
  label: string;
  id: string | null;
  present: boolean;
  detail: string;
}

interface EsoDefinition {
  id: string;
  esoCode: string;
  name: string;
  purpose: string | null;
  objective: string | null;
  category: string | null;
  status: string;
  version: number;
  owner: string | null;
  permissions?: {
    allowedExecutorClasses?: string[];
    trustLevel?: string | null;
    constraintsPolicies?: unknown;
  };
  trustLevel: string | null;
  allowedExecutorClasses: string[];
  gapTypes: string[];
  whenToUse: unknown;
  inputs: unknown;
  preconditions: unknown;
  prerequisites: unknown;
  executionSteps: unknown;
  expectedOutput: unknown;
  readiness: Readiness;
  relatedKnowledge?: {
    knowledgeAssets?: { id: string; title: string; category?: string; status?: string | null }[];
    memory?: { id: string; pattern: string; description?: string | null; domain?: string | null }[];
  };
  relatedRecommendations?: { id: string; title: string; category: string; priority: string; status: string }[];
  runs: number;
  lastRun: string | null;
  outcomes: number;
  outcomeStatus: string;
  efficacy: EfficacyRecord[];
  efficacyAnalysis?: EfficacyAnalysis;
  efficacyMessage: string | null;
  intelligenceLoop?: { nodes: LoopNode[]; complete: boolean; note: string };
  executionHistory?: ExecutionRecord[];
  outcomeHistory?: OutcomeRecord[];
  evidence?: EvidenceRecord[];
}

interface EsoCatalogue {
  definitions: EsoDefinition[];
  totals: {
    definitions: number;
    active: number;
    withEfficacy: number;
    executions: number;
    measurableOutcomes?: number;
  };
}

interface RunnableDecision {
  id: string;
  title: string;
  rationale: string | null;
  category: string | null;
  priority: string | null;
  recommendationId: string | null;
  boundEsoId: string | null;
  approvedBy: string;
  approvedDate: string | null;
  hasMeasurementPlan: boolean;
  measurementPlan: { id: string; baselineMetric: string; measurementWindowDays: number | null } | null;
}

/* ─────────────────────────── rendering helpers ─────────────────────────── */

/**
 * A free-JSON column rendered as lines.
 *
 * These columns hold whatever their author wrote — a list of strings, a list of
 * step objects, an object of key/value pairs. Rendering has to survive all of
 * them, because throwing here blanks a whole screen over one row written by an
 * earlier build.
 */
function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>;
        for (const key of ['description', 'text', 'statement', 'condition', 'method', 'label', 'name']) {
          const candidate = row[key];
          if (typeof candidate === 'string' && candidate.trim() !== '') {
            const artifact = row.expectedArtifact;
            return typeof artifact === 'string' && artifact.trim() !== '' ? `${candidate} → ${artifact}` : candidate;
          }
        }
      }
      return JSON.stringify(entry);
    }).filter((line) => line.trim() !== '');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

function FieldList({ value, empty = 'Not declared.', ordered }: { value: unknown; empty?: string; ordered?: boolean }) {
  const rows = asList(value);
  if (rows.length === 0) return <p className="eso-run__hint">{empty}</p>;
  if (ordered) return <ol className="eso-steps">{rows.map((row, i) => <li key={`${row}-${i}`}>{row}</li>)}</ol>;
  return <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
    {rows.map((row, i) => <li key={`${row}-${i}`}>{row}</li>)}
  </ul>;
}

function Block({ title, icon, span, children }: { title: string; icon?: ReactNode; span?: boolean; children: ReactNode }) {
  return (
    <div className={`eso-block${span ? ' eso-block--span' : ''}`}>
      <div className="eso-block__label">{icon}{title}</div>
      <div className="eso-block__body">{children}</div>
    </div>
  );
}

const day = (value: string | null | undefined): string => (value ? String(value).slice(0, 10) : 'unknown date');

function statusChip(status: string): string {
  const normalized = status.toLowerCase();
  if (['completed', 'success', 'active', 'published', 'approved', 'released'].includes(normalized)) return 'oi-chip oi-chip--ok';
  if (['failed', 'rolled_back'].includes(normalized)) return 'oi-chip oi-chip--crit';
  if (['running', 'queued'].includes(normalized)) return 'oi-chip oi-chip--info';
  return 'oi-chip oi-chip--warn';
}

/* ─────────────────────────── screen ─────────────────────────── */

/**
 * @param focusEsoId The ESO a recommendation asked to open, from App. Selected
 *        instead of the first entry, but only if it is genuinely in this
 *        tenant's catalogue — an id that does not resolve falls back rather
 *        than leaving an empty detail pane with no explanation.
 */
export default function EsoLibraryScreen({ tenantId, focusEsoId }: { tenantId: string; focusEsoId?: string | null }) {
  const [catalogue, setCatalogue] = useState<EsoCatalogue | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [decisions, setDecisions] = useState<RunnableDecision[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EsoDefinition | null>(null);
  const [runForm, setRunForm] = useState<Record<string, string>>({});
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runBlockers, setRunBlockers] = useState<Blocker[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cat, recs, runnable] = await Promise.all([
        esoApi.definitions(tenantId) as Promise<EsoCatalogue>,
        organizationIntelligenceApi.getRecommendations(tenantId),
        esoApi.runnableDecisions(tenantId) as Promise<{ decisions: RunnableDecision[] }>,
      ]);
      setCatalogue(cat);
      setRecommendations(recs);
      setDecisions(runnable?.decisions ?? []);
      const focused = focusEsoId && cat.definitions.some((d) => d.id === focusEsoId) ? focusEsoId : null;
      setSelectedId((current) => focused ?? current ?? cat.definitions[0]?.id ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the ESO catalogue.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, focusEsoId]);

  useEffect(() => { void load(); }, [load]);

  // The detail read is separate from the catalogue read because it carries the
  // history, evidence and outcome joins, which are per-ESO and would make the
  // list request quadratic in the size of the catalogue.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setRunBlockers([]);
    setAcknowledged(false);
    setRunInputs({});

    esoApi.definition(tenantId, selectedId)
      .then((value) => { if (!cancelled) setDetail(value as EsoDefinition); })
      .catch((e: any) => { if (!cancelled) setActionError(e?.message ?? 'Unable to load ESO detail.'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });

    return () => { cancelled = true; };
  }, [tenantId, selectedId]);

  /** Recommendations the model bound to a real ESO, grouped by that ESO. */
  const matchedRecommendations = useMemo(() => {
    const byEso = new Map<string, Recommendation[]>();
    for (const rec of recommendations?.recommendations ?? []) {
      if (!rec.esoId) continue;
      byEso.set(rec.esoId, [...(byEso.get(rec.esoId) ?? []), rec]);
    }
    return byEso;
  }, [recommendations]);

  const selected = detail ?? catalogue?.definitions.find((d) => d.id === selectedId) ?? null;
  const readiness = selected?.readiness ?? null;

  // A decision already bound to this ESO by a recommendation is offered first:
  // the pairing was made by the model, not by whoever happens to be reading.
  const decisionsForSelected = useMemo(() => {
    if (!selected) return decisions;
    const bound = decisions.filter((d) => d.boundEsoId === selected.id);
    const rest = decisions.filter((d) => d.boundEsoId !== selected.id);
    return [...bound, ...rest];
  }, [decisions, selected]);

  const chosenDecision = decisionsForSelected.find((d) => d.id === runForm.decisionId) ?? null;

  const runEso = async () => {
    if (!selected) return;

    const decision = chosenDecision;

    if (!decision) {
      setActionError('Choose the approved decision this run carries out.');
      return;
    }

    // Invariant 4. A plan must exist and pre-date the run, so where the decision
    // has none we create one FIRST and in its own request — never inline with
    // the execution, which would make the plan and the run simultaneous and the
    // ordering check meaningless.
    const baselineMetric = (runForm.baselineMetric ?? '').trim();

    if (!decision.hasMeasurementPlan && baselineMetric === '') {
      setActionError('This decision has no measurement plan. Name the metric this run will be judged on before it starts.');
      return;
    }

    setRunning(true);
    setActionError(null);
    setActionMessage(null);
    setRunBlockers([]);

    try {
      if (!decision.hasMeasurementPlan) {
        await esoApi.createMeasurementPlan({
          decisionId: decision.id,
          baselineMetric,
          measurementWindowDays: runForm.measurementWindowDays ? Number(runForm.measurementWindowDays) : 14,
        });
      }

      const execution = await esoApi.create({
        decisionId: decision.id,
        esoDefinitionId: selected.id,
        executorType: 'human',
        inputs: runInputs,
        preconditionsAcknowledged: acknowledged,
      });

      setActionMessage(
        `Execution started for ${selected.name}. It is recorded as running and is not yet an outcome — complete it in the Execution Center, then record what actually happened.`,
      );
      setRunForm({});
      setRunInputs({});
      setAcknowledged(false);
      await load();
      // Re-read the detail so the new run appears in the history immediately.
      setDetail(await esoApi.definition(tenantId, selected.id) as EsoDefinition);
      void execution;
    } catch (e: any) {
      // The server sends structured blockers for a preflight refusal. Showing
      // them verbatim is the point: the reader learns which condition failed,
      // not that "something went wrong".
      const blockers = e?.responseJson?.blockers;
      if (Array.isArray(blockers) && blockers.length > 0) {
        setRunBlockers(blockers as Blocker[]);
        setActionError('This ESO cannot be run yet.');
      } else {
        setActionError(e?.responseJson?.reason ?? e?.message ?? 'Unable to run this ESO.');
      }
    } finally {
      setRunning(false);
    }
  };

  if (loading && !catalogue) {
    return <div className="oi-page"><Spinner label="Loading the ESO catalogue" /></div>;
  }

  if (error && !catalogue) {
    return <div className="oi-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  }

  if (!catalogue) return null;

  const { definitions, totals } = catalogue;

  return (
    <div className="oi-page">
      <IntelligenceHeader
        title="ESO Library"
        icon={<Boxes />}
        question="What can this organization actually execute? Every capability below is a defined, runnable object — not advice."
        meta={recommendations ?? null}
        actions={(
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} /> Reload
          </Button>
        )}
      />

      {(error || actionError || actionMessage) && (
        <div className={`u-alert ${actionError || error ? 'u-alert-danger' : 'u-alert-success'}`} style={{ marginBottom: 14 }}>
          <div className="u-alert-body">{actionError || error || actionMessage}</div>
        </div>
      )}

      <div className="intel-stat-grid" style={{ marginBottom: 16 }}>
        <article className="intel-kpi">
          <span className="intel-kpi-label">Defined capabilities</span>
          <div className="intel-kpi-value">{count(totals.definitions)}</div>
        </article>
        <article className="intel-kpi">
          <span className="intel-kpi-label">In service</span>
          <div className="intel-kpi-value">{count(totals.active)}</div>
        </article>
        <article className="intel-kpi">
          <span className="intel-kpi-label">Executions recorded</span>
          <div className="intel-kpi-value">{count(totals.executions)}</div>
        </article>
        <article className="intel-kpi">
          {/* Deliberately NOT a success rate. This counts outcomes that were
              actually recorded; it makes no claim about whether they were good. */}
          <span className="intel-kpi-label">Measured outcomes</span>
          <div className="intel-kpi-value">{count(totals.measurableOutcomes ?? 0)}</div>
        </article>
      </div>

      <div className="eso-layout">
        <Panel
          title="Capabilities"
          hint={`${totals.definitions} defined`}
          footnote="An ESO that is not in service is still listed. Knowing a capability exists but has been withdrawn is a finding of its own."
        >
          {definitions.length === 0 ? (
            <ConsequenceEmpty
              missing="an executable object definition for this organization"
              produces="Recommendations can still be read, but none of them can be turned into a measured execution until at least one ESO is authored."
            />
          ) : (
            <div className="eso-list">
              {definitions.map((d) => {
                const matches = matchedRecommendations.get(d.id) ?? [];
                const blocked = d.readiness ? !d.readiness.runnable : false;

                return (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    aria-current={d.id === selectedId}
                    className={[
                      'eso-card',
                      d.id === selectedId ? 'eso-card--selected' : '',
                      blocked ? 'eso-card--blocked' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="eso-card__top">
                      <h4 className="eso-card__name">{d.name}</h4>
                      <span className="eso-card__code">{d.esoCode}</span>
                    </div>
                    <p className="eso-card__purpose">{d.purpose || d.objective || 'No purpose recorded on this definition.'}</p>
                    <div className="eso-card__meta">
                      <span className={statusChip(d.status)}>{d.status}</span>
                      <span className="oi-chip oi-chip--mono">{d.runs} run{d.runs === 1 ? '' : 's'}</span>
                      {matches.length > 0 && <span className="oi-chip oi-chip--info">{matches.length} recommendation{matches.length === 1 ? '' : 's'}</span>}
                      {blocked && <span className="oi-chip oi-chip--warn">not runnable</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="ESO detail" hint={selected ? selected.esoCode : 'select a capability'}>
          {detailLoading && !selected ? (
            <Spinner label="Loading ESO detail" />
          ) : !selected ? (
            <ConsequenceEmpty
              missing="a selected ESO"
              produces="Choose a capability on the left to see what it does, what it needs, and whether it has ever worked."
            />
          ) : (
            <>
              <div className="eso-detail__head">
                <div>
                  <h3 className="eso-detail__title">{selected.name}</h3>
                  <p className="eso-detail__purpose">{selected.purpose || selected.objective || 'No purpose is recorded on this definition.'}</p>
                </div>
                <div className="oi-chips">
                  <span className={statusChip(selected.status)}>{selected.status}</span>
                  <span className="oi-chip oi-chip--mono">v{selected.version}</span>
                  {selected.category && <span className="oi-chip">{selected.category}</span>}
                </div>
              </div>

              {readiness && !readiness.runnable && (
                <div className="eso-blockers">
                  <p className="eso-blockers__title">This capability cannot be run</p>
                  <ul>{readiness.blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
                </div>
              )}

              <div className="eso-grid">
                <Block title="When to use it" icon={<Target size={12} />}>
                  <FieldList value={selected.whenToUse} empty="No usage context is declared on this ESO." />
                  {selected.gapTypes.length > 0 && (
                    <p style={{ marginTop: 8 }}>
                      Closes findings of type: {selected.gapTypes.join(', ')}.
                    </p>
                  )}
                </Block>

                <Block title="What it does" icon={<ListChecks size={12} />}>
                  <FieldList value={selected.executionSteps} ordered empty="No procedure steps are declared on this ESO." />
                </Block>

                <Block title="What it needs" icon={<ClipboardList size={12} />}>
                  {readiness && readiness.requiredInputs.length === 0 && readiness.unverifiableInputs.length === 0
                    ? <p>This ESO declares no inputs.</p>
                    : (
                      <>
                        {readiness && readiness.requiredInputs.length > 0 && (
                          <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                            {readiness.requiredInputs.map((i) => (
                              <li key={i.name}><strong>{i.name}</strong>{i.type ? ` (${i.type})` : ''} — required{i.description ? `. ${i.description}` : ''}</li>
                            ))}
                          </ul>
                        )}
                        {readiness && readiness.optionalInputs.length > 0 && (
                          <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                            {readiness.optionalInputs.map((i) => <li key={i.name}>{i.name} — optional</li>)}
                          </ul>
                        )}
                        {readiness && readiness.unverifiableInputs.length > 0 && (
                          <>
                            <p style={{ marginTop: 6 }}>Described but not machine-checkable, so the system cannot confirm these are present:</p>
                            <FieldList value={readiness.unverifiableInputs} />
                          </>
                        )}
                      </>
                    )}
                </Block>

                <Block title="Preconditions" icon={<AlertTriangle size={12} />}>
                  <FieldList value={readiness?.preconditions ?? selected.preconditions} empty="This ESO declares no preconditions." />
                  {readiness?.preconditionsRequireAcknowledgement && (
                    <p className="eso-run__hint" style={{ marginTop: 6 }}>{readiness.preconditionNote}</p>
                  )}
                </Block>

                <Block title="Who may run it" icon={<ShieldCheck size={12} />}>
                  <dl className="eso-facts">
                    <dt>Owner</dt>
                    <dd>{selected.owner || 'not recorded'}</dd>
                    <dt>Executor</dt>
                    <dd>{readiness?.executorClassRestricted ? readiness.executorClasses.join(', ') : 'no restriction declared'}</dd>
                    <dt>Trust level</dt>
                    <dd>{selected.trustLevel || 'not set'}</dd>
                  </dl>
                  <p className="eso-run__hint" style={{ marginTop: 6 }}>
                    Execution is restricted to a named person in this version. Autonomous execution is governed but not enabled.
                  </p>
                </Block>

                <Block title="What it produces" icon={<FileText size={12} />}>
                  <FieldList value={selected.expectedOutput} empty="No outputs are declared on this ESO." />
                </Block>

                {/* ── has it worked before? ── */}
                <Block title="Has it worked before?" icon={<CheckCircle2 size={12} />} span>
                  <EfficacyPanel analysis={selected.efficacyAnalysis} runs={selected.runs} stored={selected.efficacy} />
                </Block>

                {/* ── the loop this capability sits in ── */}
                <Block title="Intelligence loop" icon={<GitBranch size={12} />} span>
                  <LoopChain loop={selected.intelligenceLoop} />
                </Block>

                {/* ── the evidence behind it ── */}
                <Block title="Evidence cited by its runs" icon={<FileText size={12} />} span>
                  {(selected.evidence ?? []).length === 0 ? (
                    <p>
                      No evidence has been linked to any execution of this ESO. Evidence is attached when a run is started, and
                      nothing is inferred here from records that merely look related.
                    </p>
                  ) : (
                    <div className="eso-rows">
                      {(selected.evidence ?? []).map((e) => (
                        <div className="eso-row" key={`${e.executionId}-${e.id}`}>
                          <span className="oi-chip">{e.evidenceType ?? 'evidence'}</span>
                          <span>{e.source ?? 'source not recorded'}</span>
                          <span className="eso-row__mono">
                            {e.confidence === null ? 'confidence not recorded' : `confidence ${e.confidence.toFixed(2)}`}
                          </span>
                          <span className="eso-row__when">linked {day(e.linkedDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Block>

                {/* ── related intelligence ── */}
                <Block title="Signals and recommendations" icon={<GitBranch size={12} />}>
                  {(selected.relatedRecommendations ?? []).length === 0 ? (
                    <p>No stored recommendation names this ESO.</p>
                  ) : (
                    <div className="eso-rows">
                      {(selected.relatedRecommendations ?? []).map((r) => (
                        <div className="eso-row" key={r.id}>
                          <span className={statusChip(r.status)}>{r.status}</span>
                          <span>{r.title}</span>
                          <span className="eso-row__when">{r.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Block>

                <Block title="Knowledge and memory" icon={<Boxes size={12} />}>
                  {((selected.relatedKnowledge?.knowledgeAssets ?? []).length + (selected.relatedKnowledge?.memory ?? []).length) === 0 ? (
                    <p>Nothing in the Knowledge Library or organizational memory refers to this capability yet.</p>
                  ) : (
                    <>
                      {(selected.relatedKnowledge?.knowledgeAssets ?? []).length > 0 && (
                        <>
                          <p style={{ fontWeight: 600 }}>Knowledge Library</p>
                          <FieldList value={(selected.relatedKnowledge?.knowledgeAssets ?? []).map((k) => k.title)} />
                        </>
                      )}
                      {(selected.relatedKnowledge?.memory ?? []).length > 0 && (
                        <>
                          <p style={{ fontWeight: 600, marginTop: 8 }}>Learned in memory</p>
                          <FieldList value={(selected.relatedKnowledge?.memory ?? []).map((m) => m.pattern)} />
                        </>
                      )}
                    </>
                  )}
                </Block>

                {/* ── history ── */}
                <Block title="Execution history" icon={<PlayCircle size={12} />} span>
                  {(selected.executionHistory ?? []).length === 0 ? (
                    <p>No execution of this ESO has been recorded.</p>
                  ) : (
                    <div className="eso-rows">
                      {(selected.executionHistory ?? []).map((x) => (
                        <div className="eso-row" key={x.id}>
                          <span className={statusChip(x.status)}>{x.status.replace(/_/g, ' ')}</span>
                          <span>{x.executedBy || 'executor not recorded'}</span>
                          {x.error && <span className="eso-row__mono">{x.error}</span>}
                          <span className="eso-row__when">started {day(x.startedDate ?? x.createdDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Block>

                <Block title="Outcome history" icon={<Target size={12} />} span>
                  {(selected.outcomeHistory ?? []).length === 0 ? (
                    selected.runs > 0
                      ? <div className="eso-unmeasurable"><strong>{UNMEASURABLE}</strong></div>
                      : <p>No outcome has been recorded, because this ESO has not been run.</p>
                  ) : (
                    <div className="eso-rows">
                      {(selected.outcomeHistory ?? []).map((o) => (
                        <div className="eso-row" key={o.id}>
                          <span className={statusChip(o.result)}>{o.result}</span>
                          <span>{o.feedback ?? 'no written feedback'}</span>
                          <span className="eso-row__mono">
                            {o.confidence === null ? 'confidence not recorded' : `confidence ${o.confidence.toFixed(2)}`}
                          </span>
                          <span className="eso-row__when">{day(o.createdDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Block>

                {/* ── can I run it? ── */}
                <Block title="Run this ESO" icon={<PlayCircle size={12} />} span>
                  <RunPanel
                    definition={selected}
                    readiness={readiness}
                    decisions={decisionsForSelected}
                    chosenDecision={chosenDecision}
                    form={runForm}
                    inputs={runInputs}
                    acknowledged={acknowledged}
                    busy={running}
                    blockers={runBlockers}
                    onForm={(patch) => setRunForm((f) => ({ ...f, ...patch }))}
                    onInput={(patch) => setRunInputs((i) => ({ ...i, ...patch }))}
                    onAcknowledge={setAcknowledged}
                    onRun={() => void runEso()}
                  />
                </Block>
              </div>
            </>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel
          title="What the organization has been advised to do"
          hint="recommendations from organizational intelligence"
          footnote="View ESO and Run ESO appear only where a recommendation is bound to a real executable object in this catalogue. A binding exists when an ESO declares that finding in its own gap types — nothing is matched by wording."
        >
          <RecommendationDemand
            recommendations={recommendations?.recommendations ?? []}
            definitions={definitions}
            onView={(esoId) => {
              setSelectedId(esoId);
              setActionMessage(null);
              setActionError(null);
              if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── efficacy ─────────────────────────── */

const VERDICT_WORD: Record<string, string> = {
  SUCCESS: 'Reached the agreed target',
  PARTIAL: 'Moved part of the way',
  FAILED: 'Did not improve the measured condition',
};

/**
 * Did this ESO actually work — and if we cannot say, why not.
 *
 * THE THREE STATES ARE NOT DEGREES OF THE SAME THING.
 *
 *   NOT_MEASURABLE       nothing has run; there is nothing to judge.
 *   INSUFFICIENT_EVIDENCE  runs happened, but no before-and-after reading
 *                        exists; a percentage here would be invented.
 *   MEASURABLE           a real reading exists — including a measured 0, which
 *                        means the intervention did not help.
 *
 * A measured 0 and an unmeasurable ESO must never look alike on screen, so the
 * unmeasurable states render a sentence and no figure at all, while a measured
 * failure renders the figure and names it a failure. Collapsing the two is the
 * exact mistake this panel exists to prevent.
 */
function EfficacyPanel({ analysis, runs, stored }: {
  analysis: EfficacyAnalysis | undefined;
  runs: number;
  stored: EfficacyRecord[];
}) {
  if (!analysis) {
    return <p>{runs === 0 ? 'This ESO has never been run, so there is nothing to judge it on yet.' : UNMEASURABLE}</p>;
  }

  if (analysis.status !== 'MEASURABLE') {
    return (
      <div className="eso-unmeasurable">
        <strong>
          {analysis.status === 'NOT_MEASURABLE'
            ? 'Never executed — nothing to measure yet.'
            : UNMEASURABLE}
        </strong>
        <p style={{ margin: '6px 0 0' }}>{analysis.explanation}</p>
        {analysis.executionsConsidered > 0 && (
          <p style={{ margin: '6px 0 0' }}>
            Completing an execution records that the action was taken. It is not evidence that the organization improved, so no
            success rate is shown — none can honestly be computed.
          </p>
        )}
      </div>
    );
  }

  const pct = Math.round((analysis.score ?? 0) * 100);
  const tone = analysis.verdict === 'SUCCESS' ? 'ok' : analysis.verdict === 'PARTIAL' ? 'warn' : 'crit';

  return (
    <>
      <div className="eso-efficacy">
        <div className="eso-efficacy__score">
          <span className={`eso-efficacy__value eso-efficacy__value--${tone}`}>{pct}%</span>
          <span className="eso-efficacy__caption">of the agreed distance travelled</span>
        </div>
        <div className="eso-efficacy__facts">
          <span className={`oi-chip oi-chip--${tone}`}>{VERDICT_WORD[analysis.verdict ?? ''] ?? analysis.verdict}</span>
          <span className="oi-chip oi-chip--mono">
            {analysis.sampleSize} of {analysis.executionsConsidered} execution{analysis.executionsConsidered === 1 ? '' : 's'} contributed
          </span>
          <span className="oi-chip oi-chip--mono">
            {/* Read from the outcomes, never derived from sample size. */}
            {analysis.confidence === null ? 'confidence not recorded' : `recorded confidence ${analysis.confidence.toFixed(2)}`}
          </span>
        </div>
      </div>

      <p style={{ marginTop: 10 }}>{analysis.explanation}</p>

      <div className="eso-rows" style={{ marginTop: 10 }}>
        {analysis.contributions.map((c) => (
          <div className="eso-row" key={c.executionId}>
            {c.counted ? (
              <>
                <span className={`oi-chip oi-chip--${c.verdict === 'SUCCESS' ? 'ok' : c.verdict === 'PARTIAL' ? 'warn' : 'crit'}`}>
                  {c.verdict}
                </span>
                <span>
                  {c.metric}: {c.baseline} → <strong style={{ color: 'var(--content-primary)' }}>{c.actual}</strong> (target {c.target}
                  {c.unit ? ` ${c.unit}` : ''})
                </span>
              </>
            ) : (
              <>
                <span className="oi-chip oi-chip--warn">not counted</span>
                <span>{c.reason}</span>
              </>
            )}
            <span className="eso-row__when">{day(c.completedDate)}</span>
          </div>
        ))}
      </div>

      {stored.length > 0 && (
        <p className="eso-run__hint" style={{ marginTop: 8 }}>
          {stored.length} stored efficacy snapshot{stored.length === 1 ? '' : 's'}, most recently {day(stored[0].computedDate)}.
        </p>
      )}
    </>
  );
}

/* ─────────────────────────── the loop ─────────────────────────── */

/**
 * Signal → recommendation → ESO → decision → execution → evidence → outcome →
 * efficacy → learning, as the organization has actually walked it.
 *
 * An absent node is drawn dimmed with the reason it is absent, never omitted. A
 * chain that silently closes up would tell a reader the loop completed when the
 * truth is that it stopped — and where it stopped is the most useful thing on
 * this screen.
 */
function LoopChain({ loop }: { loop?: { nodes: LoopNode[]; complete: boolean; note: string } }) {
  if (!loop) return <p>The loop for this capability has not been read.</p>;

  return (
    <>
      <ol className="eso-loop">
        {loop.nodes.map((node) => (
          <li className={`eso-loop__node${node.present ? '' : ' eso-loop__node--absent'}`} key={node.kind}>
            <span className="eso-loop__label">{node.label}</span>
            <span className="eso-loop__detail">{node.detail}</span>
            {/* An id is shown only where a row exists, so nothing on screen
                points at an entity the organization does not have. */}
            {node.present && node.id && <span className="eso-loop__id">{node.id.slice(0, 8)}</span>}
          </li>
        ))}
      </ol>
      <p className="eso-run__hint" style={{ marginTop: 8 }}>
        {loop.complete
          ? 'This loop is closed: the execution produced an outcome, and the organization wrote a learning back from it.'
          : loop.note}
      </p>
    </>
  );
}

/* ─────────────────────────── run panel ─────────────────────────── */

/**
 * Everything a run needs, collected in one place, in the order the server
 * checks it.
 *
 * WHY A DECISION PICKER AND NOT A TEXT BOX. An execution must name an approved
 * decision, because Invariant 4 exists to stop actions being taken and judged
 * by the same person after the fact. The previous version of this screen asked
 * for that decision as a hand-typed UUID, which meant the requirement that
 * makes execution trustworthy was also the requirement that made it
 * unusable — nobody outside the repository knows a decision id. The list here
 * is real approved decisions this tenant has not yet executed.
 */
function RunPanel({
  definition, readiness, decisions, chosenDecision, form, inputs, acknowledged, busy, blockers,
  onForm, onInput, onAcknowledge, onRun,
}: {
  definition: EsoDefinition;
  readiness: Readiness | null;
  decisions: RunnableDecision[];
  chosenDecision: RunnableDecision | null;
  form: Record<string, string>;
  inputs: Record<string, string>;
  acknowledged: boolean;
  busy: boolean;
  blockers: Blocker[];
  onForm: (patch: Record<string, string>) => void;
  onInput: (patch: Record<string, string>) => void;
  onAcknowledge: (value: boolean) => void;
  onRun: () => void;
}) {
  if (readiness && !readiness.runnable) {
    return (
      <p>
        This ESO is not runnable in its current state, so no run can be started against it. The reasons are listed at the top of
        this panel.
      </p>
    );
  }

  if (decisions.length === 0) {
    return (
      <ConsequenceEmpty
        missing="an approved decision waiting to be executed"
        produces="An ESO runs against a decision the organization has approved. Until one is approved and unexecuted, there is nothing for this capability to carry out."
      />
    );
  }

  const requiredInputs = readiness?.requiredInputs ?? [];
  const optionalInputs = readiness?.optionalInputs ?? [];
  const needsAcknowledgement = readiness?.preconditionsRequireAcknowledgement ?? false;
  const needsPlan = chosenDecision !== null && !chosenDecision.hasMeasurementPlan;

  const missingInput = requiredInputs.some((spec) => (inputs[spec.name] ?? '').trim() === '');
  const canRun = chosenDecision !== null
    && !missingInput
    && (!needsAcknowledgement || acknowledged)
    && (!needsPlan || (form.baselineMetric ?? '').trim() !== '');

  return (
    <div className="eso-run">
      {blockers.length > 0 && (
        <div className="eso-blockers">
          <p className="eso-blockers__title">The run was refused</p>
          <ul>{blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
        </div>
      )}

      <label className="eso-run__field">
        <span>Which approved decision does this run carry out?</span>
        <select value={form.decisionId ?? ''} onChange={(e) => onForm({ decisionId: e.target.value })} disabled={busy}>
          <option value="">Choose an approved decision…</option>
          {decisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
              {d.boundEsoId === definition.id ? ' — already bound to this ESO' : ''}
              {d.hasMeasurementPlan ? ' · plan ready' : ' · needs a measurement plan'}
            </option>
          ))}
        </select>
        <p className="eso-run__hint">
          Approved by {chosenDecision ? chosenDecision.approvedBy : 'the decision owner'}
          {chosenDecision?.approvedDate ? ` on ${day(chosenDecision.approvedDate)}` : ''}. Decisions already executed are not listed.
        </p>
      </label>

      {needsPlan && (
        <>
          <label className="eso-run__field">
            <span>What will this run be judged on?</span>
            <input
              value={form.baselineMetric ?? ''}
              placeholder="e.g. collection rate"
              onChange={(e) => onForm({ baselineMetric: e.target.value })}
              disabled={busy}
            />
            <p className="eso-run__hint">
              A measurement plan must exist before the run starts. An action nobody agreed how to measure can only ever be judged
              afterwards, by whoever ran it, against a standard they choose then.
            </p>
          </label>
          <label className="eso-run__field">
            <span>Measurement window (days)</span>
            <input
              type="number"
              min="1"
              value={form.measurementWindowDays ?? '14'}
              onChange={(e) => onForm({ measurementWindowDays: e.target.value })}
              disabled={busy}
            />
          </label>
        </>
      )}

      {chosenDecision?.measurementPlan && (
        <p className="eso-run__hint" style={{ marginBottom: 10 }}>
          Measured on <strong>{chosenDecision.measurementPlan.baselineMetric}</strong>
          {chosenDecision.measurementPlan.measurementWindowDays
            ? ` over ${chosenDecision.measurementPlan.measurementWindowDays} days`
            : ''}, from the plan already agreed for this decision.
        </p>
      )}

      {requiredInputs.map((spec) => (
        <label className="eso-run__field" key={spec.name}>
          <span>{spec.name}{spec.type ? ` (${spec.type})` : ''} — required</span>
          <input
            value={inputs[spec.name] ?? ''}
            onChange={(e) => onInput({ [spec.name]: e.target.value })}
            disabled={busy}
          />
          {spec.description && <p className="eso-run__hint">{spec.description}</p>}
        </label>
      ))}

      {optionalInputs.map((spec) => (
        <label className="eso-run__field" key={spec.name}>
          <span>{spec.name}{spec.type ? ` (${spec.type})` : ''} — optional</span>
          <input
            value={inputs[spec.name] ?? ''}
            onChange={(e) => onInput({ [spec.name]: e.target.value })}
            disabled={busy}
          />
        </label>
      ))}

      {needsAcknowledgement && (
        <label className="eso-run__ack">
          <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} disabled={busy} />
          <span>
            I confirm the preconditions listed above are met. These describe the world outside this system and cannot be checked
            from its records, so this confirmation is stored against the execution with your name on it.
          </span>
        </label>
      )}

      <div className="eso-run__actions">
        <Button variant="primary" onClick={onRun} disabled={busy || !canRun}>
          <PlayCircle size={14} /> {busy ? 'Starting…' : 'Run ESO'}
        </Button>
        {!canRun && (
          <span className="eso-run__hint" style={{ margin: 0 }}>
            {chosenDecision === null
              ? 'Choose the decision this run carries out.'
              : missingInput
                ? 'Fill in every required input.'
                : needsPlan && (form.baselineMetric ?? '').trim() === ''
                  ? 'Name the metric this run will be judged on.'
                  : 'Confirm the preconditions before starting.'}
          </span>
        )}
      </div>

      <p className="eso-run__hint" style={{ marginTop: 10 }}>
        Starting a run records it as running against this decision. It does not mark the work done and it does not record an
        outcome — both are separate, deliberate steps.
      </p>
    </div>
  );
}

/* ─────────────────────────── demand ─────────────────────────── */

/**
 * What the organization has been advised to do, and whether it can actually do
 * any of it.
 *
 * [View ESO] appears only when the recommendation carries a binding to an ESO
 * that is in this tenant's catalogue. [Run ESO] additionally requires that ESO
 * to be runnable. Where there is no binding, the recommendation's own note says
 * why — an empty catalogue and a catalogue where nothing claims this finding
 * are different problems with different fixes.
 */
function RecommendationDemand({
  recommendations, definitions, onView,
}: {
  recommendations: Recommendation[];
  definitions: EsoDefinition[];
  onView: (esoId: string) => void;
}) {
  const byId = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions]);

  /**
   * Demand for execution capability, by class.
   *
   * The counted question is the one a reader of this screen actually has: of
   * the actions asking for a Workflow, how many can this organization run? A
   * class where `bound` is 0 and `actions` is 14 is the clearest statement the
   * product can make that a capability is missing, and it is computed over
   * every recommendation rather than the visible page of them.
   */
  const demand = useMemo(() => {
    const byType = new Map<string, { actions: number; bound: number; runnable: number }>();

    for (const rec of recommendations) {
      const row = byType.get(rec.esoType) ?? { actions: 0, bound: 0, runnable: 0 };
      row.actions += 1;
      if (rec.esoId) {
        row.bound += 1;
        if (byId.get(rec.esoId)?.readiness?.runnable) row.runnable += 1;
      }
      byType.set(rec.esoType, row);
    }

    return Array.from(byType.entries()).sort((a, b) => b[1].actions - a[1].actions);
  }, [recommendations, byId]);

  if (recommendations.length === 0) {
    return (
      <ConsequenceEmpty
        missing="a detected recommendation needing execution"
        produces="Nothing is currently waiting on an executable capability."
      />
    );
  }

  return (
    <>
    <div className="eso-grid" style={{ marginBottom: 12 }}>
      {demand.map(([type, row]) => (
        <div className="eso-block" key={type}>
          <div className="eso-block__label">{type}</div>
          <div className="eso-block__body">
            <strong style={{ color: 'var(--content-primary)' }}>{row.actions}</strong> action{row.actions === 1 ? '' : 's'} need{row.actions === 1 ? 's' : ''} this capability.{' '}
            {row.bound === 0
              ? 'None is bound to an executable object, so none can be run from here.'
              : `${row.runnable} of ${row.bound} bound action${row.bound === 1 ? '' : 's'} can be run now.`}
          </div>
        </div>
      ))}
    </div>

    <div className="eso-rows">
      {recommendations.slice(0, 12).map((rec) => {
        const definition = rec.esoId ? byId.get(rec.esoId) ?? null : null;
        const runnable = definition?.readiness?.runnable ?? false;

        return (
          <div className="eso-row" key={rec.id} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              <span className={`oi-chip oi-chip--${rec.priority === 'critical' ? 'crit' : rec.priority === 'high' ? 'warn' : 'info'}`}>
                {rec.priority}
              </span>
              <strong style={{ color: 'var(--content-primary)' }}>{rec.recommendation}</strong>
              <span className="eso-row__when">needs {rec.esoType}</span>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: 'var(--content-tertiary)' }}>{rec.esoNote}</p>

            {definition && (
              <div className="intel-inline-actions">
                <button type="button" onClick={() => onView(definition.id)}>
                  <Eye size={13} /> View ESO
                </button>
                <button type="button" onClick={() => onView(definition.id)} disabled={!runnable}>
                  <PlayCircle size={13} /> {runnable ? 'Run ESO' : 'Not runnable'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
