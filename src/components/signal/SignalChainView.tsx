import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { Button } from '../../ui';
import { LoadingState, ErrorState } from '../shared/States';
import { api } from '../../api/intelligence';
import { Panel, SectionHeading, Pill, shortDate } from '../intelligence/parts';
import { SituationCard, HypothesisRow, EvidenceLink, RecommendationBlock, EsoRunPanel, OutcomeRecord, ConfidenceIndicator } from '../rcl';
import '../intelligence/intelligence.css';

/**
 * THE SIGNAL CHAIN VIEW.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY THIS SCREEN EXISTS
 *
 * Signals, Evidence, Deliberation and Execution Center each show their own
 * slice of the loop, fetched independently — nothing on any of those screens
 * answers "what happened to THIS signal". The API already carries the answer
 * (GET workspace/{tenantId}/signal/{signalId}/chain walks every table the
 * loop writes to, in stage order) — this screen is the first place that
 * request is actually called from a click rather than sitting unused.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * AN EMPTY STAGE IS A REAL ANSWER, NOT A LOADING STATE
 *
 * A signal with no case yet is not broken — it just hasn't been picked up.
 * Each stage below says plainly when it is empty and why that is expected at
 * this point in the loop, rather than collapsing every empty array into the
 * same blank space.
 */

interface Signal {
  id: string;
  tenantId: string;
  source: string;
  classification: string;
  priority: string;
  severity: string;
  confidence: number | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: string;
  createdDate: string;
}

interface Evidence {
  id: string;
  source: string;
  confidence: number;
  content: Record<string, unknown> | null;
  provenance: { ts?: string } | null;
  createdDate: string;
}

interface CaseRow {
  id: string;
  title: string;
  status: string;
  signalId: string;
  tenantId: string;
  createdDate: string;
}

interface Hypothesis {
  id: string;
  statement: string;
  rootCauseFamily: string;
  confidence: number | null;
  status: string;
}

interface ReasoningStep {
  id: string;
  stepOrder: number;
  description: string;
  confidenceScore: number | null;
  createdDate: string;
}

interface Recommendation {
  id: string;
  title: string;
  category: 'watch' | 'investigate' | 'intervene';
  confidence: number | null;
  status: string;
}

interface Decision {
  id: string;
  status: string;
  decidedBy: string;
  executorType: string;
  rationale: string;
  createdDate: string;
}

interface Execution {
  id: string;
  status: string;
  startedDate: string;
  completedDate: string | null;
  executedBy: string;
  executorType: string;
}

interface Outcome {
  id: string;
  result: string;
  confidence: number | null;
  metrics: Record<string, unknown>;
  evidenceIds: string[];
  feedback: string | null;
  createdDate: string;
}

interface Learning {
  id: string;
  pattern: string;
  description: string | null;
  confidence: number | null;
  reusable: boolean;
  createdDate: string;
}

interface SignalChain {
  signal: Signal;
  evidence: Evidence[];
  cases: CaseRow[];
  hypotheses: Hypothesis[];
  reasoning: ReasoningStep[];
  recommendations: Recommendation[];
  decisions: Decision[];
  executions: Execution[];
  outcomes: Outcome[];
  learnings: Learning[];
  loopClosed: boolean;
}

/** What this evidence says, read out of its content object. Content has no
 *  fixed shape across sources, so a `note`/`text`/`summary`/`description`
 *  field is preferred and the rest falls back to its own key: value pairs. */
function evidenceText(item: Evidence): string {
  const content = item.content ?? {};
  const preferred = (content as Record<string, unknown>).note
    ?? (content as Record<string, unknown>).text
    ?? (content as Record<string, unknown>).summary
    ?? (content as Record<string, unknown>).description;

  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  if (preferred !== undefined && preferred !== null && typeof preferred !== 'object') return String(preferred);

  const pairs = Object.entries(content)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${String(v)}`);

  return pairs.length > 0 ? pairs.join(' · ') : 'No readable detail was recorded with this evidence.';
}

const STAGE_LABELS: [keyof SignalChain, string][] = [
  ['outcomes', 'an outcome was measured'],
  ['executions', 'an execution was run'],
  ['decisions', 'a decision was recorded'],
  ['recommendations', 'a recommendation was generated'],
  ['reasoning', 'reasoning was applied'],
  ['hypotheses', 'a hypothesis was proposed'],
  ['cases', 'a case was opened'],
  ['evidence', 'evidence was collected'],
];

/** The furthest stage this chain has actually reached, for the summary line. */
function furthestStage(chain: SignalChain): string | null {
  for (const [key, label] of STAGE_LABELS) {
    const value = chain[key];
    if (Array.isArray(value) && value.length > 0) return label;
  }
  return null;
}

export default function SignalChainView({
  tenantId,
  signalId,
  onBack,
}: {
  tenantId: string;
  signalId: string;
  onBack?: () => void;
}) {
  const [chain, setChain] = useState<SignalChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.getSignalChain(tenantId, signalId);
      setChain(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [tenantId, signalId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !chain) return <LoadingState label="Tracing this signal's chain…" />;

  if (error && !chain) {
    return <ErrorState message={error} onRetry={load} title="Couldn't load this signal's chain" />;
  }

  if (!chain) return null;

  const { signal } = chain;
  const stage = furthestStage(chain);

  return (
    <div className="dv">
      <div className="dv-toolbar">
        {onBack && (
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={onBack}>
            Signals
          </Button>
        )}
        <div className="dv-toolbar__actions">
          <Button variant="primary" size="sm" loading={loading} icon={<RefreshCw size={14} aria-hidden="true" />} onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      <Panel title="Signal" sub={`Raised by ${signal.source} · ${shortDate(signal.createdDate)}`}>
        <div className="dv-row">
          <span className="dv-row__lab">
            {signal.classification}
            <span className="dv-why">
              {signal.relatedEntityType
                ? `Concerns ${signal.relatedEntityType}${signal.relatedEntityId ? ` ${signal.relatedEntityId}` : ''}`
                : 'No related entity recorded.'}
            </span>
          </span>
          <span className="dv-row__val" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pill tone={signal.severity === 'high' || signal.severity === 'critical' ? 'crit' : signal.severity === 'medium' ? 'warn' : 'neutral'}>
              {signal.severity}
            </Pill>
            <Pill tone="neutral">{signal.status}</Pill>
            <ConfidenceIndicator confidence={signal.confidence} />
          </span>
        </div>
      </Panel>

      <p className="dv-why" role="status" style={{ marginTop: 8 }}>
        {chain.loopClosed
          ? 'This loop has closed: an outcome was measured and a reusable learning was recorded from it.'
          : stage
            ? `This loop has not closed yet. The furthest it has reached: ${stage}.`
            : 'This loop has not started yet: no evidence, case or downstream stage has been recorded for this signal.'}
      </p>

      <SectionHeading title="Evidence" sub="what grounds this signal" />
      {chain.evidence.length === 0 ? (
        <div className="dv-empty"><b>No evidence has been collected for this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.evidence.map((e) => (
            <EvidenceLink key={e.id} evidence={{ id: e.id, source: e.source, confidence: e.confidence, provenanceTs: e.provenance?.ts ?? e.createdDate, content: evidenceText(e) }} />
          ))}
        </div>
      )}

      <SectionHeading title="Cases" sub="investigations opened for this signal" />
      {chain.cases.length === 0 ? (
        <div className="dv-empty"><b>No case has been opened for this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.cases.map((c) => (
            <SituationCard key={c.id} situation={c} />
          ))}
        </div>
      )}

      <SectionHeading title="Hypotheses" sub="candidate explanations under a case" />
      {chain.hypotheses.length === 0 ? (
        <div className="dv-empty"><b>{chain.cases.length === 0 ? 'No case exists yet to propose a hypothesis under.' : 'No hypothesis has been proposed for this case yet.'}</b></div>
      ) : (
        <div className="dv-stack">
          {chain.hypotheses.map((h) => (
            <HypothesisRow key={h.id} hypothesis={h} />
          ))}
        </div>
      )}

      <SectionHeading title="Reasoning" sub="the steps that led to a recommendation" />
      {chain.reasoning.length === 0 ? (
        <div className="dv-empty"><b>No reasoning has been recorded for this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.reasoning.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, backgroundColor: 'var(--surface-card)', padding: '10px 12px' }}>
              <div style={{ fontSize: 13, color: 'var(--content-primary)' }}>{r.description}</div>
              <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 4 }}>
                Step {r.stepOrder} · Confidence: {r.confidenceScore !== null && r.confidenceScore !== undefined ? `${(r.confidenceScore * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionHeading title="Recommendations" sub="proposed actions" />
      {chain.recommendations.length === 0 ? (
        <div className="dv-empty"><b>No recommendation has been generated for this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.recommendations.map((r) => (
            <RecommendationBlock key={r.id} recommendation={{ ...r, esoId: null }} />
          ))}
        </div>
      )}

      <SectionHeading title="Decisions" sub="human approval on a recommendation" />
      {chain.decisions.length === 0 ? (
        <div className="dv-empty"><b>No decision has been recorded for this signal's recommendations yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.decisions.map((d) => (
            <div key={d.id} style={{ border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--surface-card)', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pill tone={d.status === 'approved' ? 'good' : d.status === 'rejected' ? 'crit' : 'neutral'}>{d.status}</Pill>
                <span style={{ fontSize: 11, color: 'var(--content-tertiary)' }}>{d.executorType} · {shortDate(d.createdDate)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--content-secondary)', marginTop: 6 }}>{d.rationale}</div>
              <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 6 }}>Decided by {d.decidedBy}</div>
            </div>
          ))}
        </div>
      )}

      <SectionHeading title="Executions" sub="what was carried out" />
      {chain.executions.length === 0 ? (
        <div className="dv-empty"><b>Nothing has been executed for this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.executions.map((x) => (
            <EsoRunPanel key={x.id} run={{ ...x, measurementPlanId: null }} />
          ))}
        </div>
      )}

      <SectionHeading title="Outcomes" sub="the measured result" />
      {chain.outcomes.length === 0 ? (
        <div className="dv-empty"><b>No outcome has been measured for this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.outcomes.map((o) => (
            <OutcomeRecord key={o.id} outcome={o} />
          ))}
        </div>
      )}

      <SectionHeading title="Learnings" sub="what the organization keeps from this" />
      {chain.learnings.length === 0 ? (
        <div className="dv-empty"><b>Nothing has been extracted as a reusable learning from this signal yet.</b></div>
      ) : (
        <div className="dv-stack">
          {chain.learnings.map((l) => (
            <div key={l.id} style={{ border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--surface-card)', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: 'var(--content-primary)' }}>{l.pattern}</strong>
                <Pill tone={l.reusable ? 'good' : 'neutral'}>{l.reusable ? 'Reusable' : 'One-off'}</Pill>
              </div>
              {l.description && <div style={{ fontSize: 12, color: 'var(--content-secondary)', marginTop: 6 }}>{l.description}</div>}
              <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 6 }}>{shortDate(l.createdDate)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
