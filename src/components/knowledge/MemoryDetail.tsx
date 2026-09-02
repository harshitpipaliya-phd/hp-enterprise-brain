import type { MemoryDetailData } from '../../api/organizationalMemory';
import { NotMeasurable, Panel, shortDate } from '../intelligence/parts';
import { ConfidenceBadge, MagnitudeBadge, ProvenanceBadge } from './badges';
import { RelationshipList } from './KnowledgeDetail';

/* ==========================================================================
 *  THE LEARNING CHAIN
 *
 *      WHAT HAPPENED → EVIDENCE → WHAT WE BELIEVED → DECISION
 *          → OUTCOME → WHAT WE LEARNED → HOW IT IS REUSED
 *
 *  Rendered as one vertical spine so the causality is visible at a glance
 *  rather than assembled by the reader out of scattered panels.
 *
 *  EVERY STEP IS ALLOWED TO SAY IT IS EMPTY. A step with nothing behind it
 *  keeps its place in the spine and states what is missing. Dropping it would
 *  close the gap visually and tell the reader the chain was complete.
 * ========================================================================== */

function Step({
  index,
  kind,
  title,
  children,
}: {
  index: number;
  kind: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="chain__step" data-kind={kind}>
      <div className="chain__rail" aria-hidden="true">
        <span className="chain__dot">{index}</span>
      </div>
      <div className="chain__body">
        <h4 className="chain__t">{title}</h4>
        {children}
      </div>
    </li>
  );
}

export interface MemoryDetailActions {
  onDecision?: (id: string) => void;
  onEvidence?: (id: string) => void;
  onExecution?: (id: string) => void;
  onOpenMemory?: (id: string) => void;
}

export function MemoryDetail({
  memory,
  actions = {},
}: {
  memory: MemoryDetailData;
  actions?: MemoryDetailActions;
}) {
  const { outcome, decision, evidence, executions } = memory;

  return (
    <div className="mem-detail">
      <div className="kb-detail__grades">
        <ConfidenceBadge confidence={memory.confidence} />
        <ProvenanceBadge provenance={memory.provenance} />
        {memory.domain && <span className="kb-tag">{memory.domain}</span>}
        {memory.reusable && <span className="kb-tag">reusable</span>}
        <span className="kb-none">{shortDate(memory.createdDate) ?? 'undated'}</span>
      </div>

      <ol className="chain">
        <Step index={1} kind="context" title="What happened">
          {decision.present && decision.rationale ? (
            <p>{decision.rationale}</p>
          ) : (
            <p className="kb-none">
              No situation description is stored on this learning. What survives is the decision that followed
              and the outcome it produced.
            </p>
          )}
        </Step>

        <Step index={2} kind="evidence" title="Evidence">
          {evidence.supported ? (
            <ul className="ev-list">
              {evidence.items.map((e) => (
                <li key={e.id} className="ev">
                  <div className="ev__h">
                    <span className="ev__src">{e.source}</span>
                    <ConfidenceBadge confidence={e.confidence} />
                  </div>
                  {e.statement && <p className="ev__s">{e.statement}</p>}
                  <div className="ev__m">
                    {e.type && <span>{e.type}</span>}
                    {e.derivedFrom && <span>derived from {e.derivedFrom}</span>}
                    {e.observedDate && <span>observed {shortDate(e.observedDate)}</span>}
                    <ProvenanceBadge provenance={e.provenance} />
                    {actions.onEvidence && (
                      <button type="button" className="kb-link" onClick={() => actions.onEvidence?.(e.id)}>
                        View evidence
                      </button>
                    )}
                  </div>
                  {e.method && <p className="kb-basis">{e.method}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <NotMeasurable
              what="Evidence"
              reason={evidence.reason ?? 'No evidence is attached to this memory.'}
            />
          )}
        </Step>

        <Step index={3} kind="belief" title="What we believed">
          {decision.present && decision.explanation ? (
            <p>{decision.explanation}</p>
          ) : (
            <p className="kb-none">
              No separate reasoning is recorded. The rationale above is the only statement of what the
              organization believed at the time.
            </p>
          )}
        </Step>

        <Step index={4} kind="decision" title="Decision and action">
          {decision.present ? (
            <>
              <p>{decision.rationale ?? 'Recorded with no rationale.'}</p>
              <div className="chain__m">
                <span className="kb-tag">{decision.status}</span>
                {decision.decidedBy && <span>decided by {decision.decidedBy}</span>}
                <ConfidenceBadge confidence={decision.confidence} />
                {actions.onDecision && (
                  <button type="button" className="kb-link" onClick={() => actions.onDecision?.(decision.id)}>
                    View decision
                  </button>
                )}
              </div>

              {executions.length > 0 ? (
                <ul className="ex-list">
                  {executions.map((x) => (
                    <li key={x.id} className="ex">
                      <span className="ex__n">{x.esoName ?? 'Executable action'}</span>
                      <span className="kb-tag">{x.status}</span>
                      {x.note && <p className="ex__note">{x.note}</p>}
                      {x.error && <p className="ex__err">{x.error}</p>}
                      <span className="chain__m">
                        {x.executorType && <span>{x.executorType}</span>}
                        {x.completedDate && <span>completed {shortDate(x.completedDate)}</span>}
                        {actions.onExecution && x.esoId && (
                          <button type="button" className="kb-link" onClick={() => actions.onExecution?.(x.esoId!)}>
                            View action
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="kb-none">
                  No executable action is recorded against this decision, so what was actually carried out is
                  not on file.
                </p>
              )}
            </>
          ) : (
            <p className="kb-none">{decision.reason}</p>
          )}
        </Step>

        <Step index={5} kind="outcome" title="Outcome">
          {outcome.present ? (
            <>
              <MagnitudeBadge magnitude={outcome.magnitude} result={outcome.result} />
              <p className="kb-basis">{outcome.magnitude.detail}</p>
              {outcome.feedback && <p>{outcome.feedback}</p>}
              {outcome.magnitude.state !== 'UNDETERMINED' && outcome.magnitude.baseline !== null && (
                <div className="chain__m">
                  <span>
                    baseline {outcome.magnitude.baseline}
                    {outcome.magnitude.unit ? ` ${outcome.magnitude.unit}` : ''}
                  </span>
                  {outcome.magnitude.observed !== null && (
                    <span>
                      observed {outcome.magnitude.observed}
                      {outcome.magnitude.unit ? ` ${outcome.magnitude.unit}` : ''}
                    </span>
                  )}
                </div>
              )}
              <div className="chain__m">
                <ConfidenceBadge confidence={outcome.confidence} />
              </div>
            </>
          ) : (
            <p className="kb-none">{outcome.reason}</p>
          )}
        </Step>

        <Step index={6} kind="learning" title="What we learned">
          <p className="mem-lesson">{memory.lesson || 'No lesson text was recorded against this learning.'}</p>
          <p className="kb-basis">{memory.confidence.basis}</p>
        </Step>

        <Step index={7} kind="reuse" title="How this learning is being reused">
          {/*
            THE ONE STEP THAT MUST NOT BE INVENTED.

            No column links a later decision back to the learning that informed
            it, so "influenced 4 later decisions" would be a number with no
            source. What the data can show is the same pattern being reached
            again — that is stated, and the missing link is named beside it.
          */}
          <p>{memory.influenced.observedReuseDetail}</p>
          <NotMeasurable what="Downstream influence" reason={memory.influenced.reason} />
          <p className="kb-basis">{memory.influenced.unlock}</p>
        </Step>
      </ol>

      <Panel title="Previous similar memories" sub="the same conclusion, reached separately">
        <RelationshipList
          items={memory.similarMemories.map((m) => ({
            id: m.id,
            name: m.lesson ? m.lesson.slice(0, 120) : m.title,
            sub: `${m.relation} · ${shortDate(m.createdDate) ?? 'undated'}`,
          }))}
          emptyReason="This organization has not reached this conclusion more than once."
          onSelect={actions.onOpenMemory}
        />
      </Panel>
    </div>
  );
}
