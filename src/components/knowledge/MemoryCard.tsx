import type { MemoryCardData } from '../../api/organizationalMemory';
import { shortDate } from '../intelligence/parts';
import { ConfidenceBadge, MagnitudeBadge, ProvenanceBadge } from './badges';

/* ==========================================================================
 *  ONE MEMORY IN THE FEED
 *
 *  The card is laid out as the loop runs — what happened, what was decided,
 *  what came of it, what we took away — so the shape of the chain is legible
 *  before the reader opens anything.
 *
 *  A BROKEN LINK IS DRAWN AS A BROKEN LINK. Where the outcome or the decision
 *  is missing, the step says what is absent instead of collapsing so the chain
 *  appears whole. The incomplete ones are the ones worth reading.
 * ========================================================================== */

export function MemoryCard({
  memory,
  onOpen,
  onDecision,
  onEvidence,
}: {
  memory: MemoryCardData;
  onOpen: () => void;
  onDecision?: (id: string) => void;
  onEvidence?: (id: string) => void;
}) {
  const { outcome, decision } = memory;

  return (
    <article className="mem-card">
      <header className="mem-card__head">
        <div>
          <h3 className="mem-card__t">
            <button type="button" onClick={onOpen}>
              {memory.title}
            </button>
          </h3>
          <div className="mem-card__sub">
            {memory.domain && <span className="kb-tag">{memory.domain}</span>}
            {memory.reusable && <span className="kb-tag">reusable</span>}
            <span className="kb-none">{shortDate(memory.createdDate) ?? 'undated'}</span>
          </div>
        </div>
        <ProvenanceBadge provenance={memory.provenance} />
      </header>

      <ol className="mem-chain">
        <li className="mem-step" data-step="decision">
          <span className="mem-step__k">Decision</span>
          {decision.present ? (
            <div className="mem-step__b">
              <p>{decision.rationale ?? decision.explanation ?? 'Recorded with no rationale.'}</p>
              <span className="mem-step__m">
                {decision.status}
                {decision.decidedBy && ` · by ${decision.decidedBy}`}
                {onDecision && (
                  <>
                    {' · '}
                    <button type="button" className="kb-link" onClick={() => onDecision(decision.id)}>
                      View decision
                    </button>
                  </>
                )}
              </span>
            </div>
          ) : (
            <p className="mem-step__none">{decision.reason}</p>
          )}
        </li>

        <li className="mem-step" data-step="outcome">
          <span className="mem-step__k">Outcome</span>
          {outcome.present ? (
            <div className="mem-step__b">
              <MagnitudeBadge magnitude={outcome.magnitude} result={outcome.result} />
              {outcome.feedback && <p>{outcome.feedback}</p>}
              <span className="mem-step__m">
                {outcome.evidenceCount > 0 ? (
                  onEvidence ? (
                    <button type="button" className="kb-link" onClick={() => onEvidence(outcome.id)}>
                      {outcome.evidenceCount} evidence row{outcome.evidenceCount === 1 ? '' : 's'}
                    </button>
                  ) : (
                    `${outcome.evidenceCount} evidence rows`
                  )
                ) : (
                  <span className="kb-none">no evidence attached</span>
                )}
              </span>
            </div>
          ) : (
            <p className="mem-step__none">{outcome.reason}</p>
          )}
        </li>

        <li className="mem-step" data-step="learning">
          <span className="mem-step__k">Learning</span>
          <div className="mem-step__b">
            <p className="mem-lesson">{memory.lesson || 'No lesson text was recorded.'}</p>
          </div>
        </li>
      </ol>

      <footer className="mem-card__foot">
        <div className="kb-card__grades">
          <ConfidenceBadge confidence={memory.confidence} />
          {/*
            REUSE IS THE PATTERN COUNT, AND THE LABEL SAYS SO.

            The only reuse this schema can evidence is the same named pattern
            being reached from more than one outcome. Calling that "reused 8×"
            without naming the basis would invite the reader to think a
            counter was incremented deliberately somewhere.
          */}
          {memory.patternReuseCount > 1 && (
            <span className="kb-conn" title="Times this organization reached this same named conclusion from a separate outcome.">
              reached {memory.patternReuseCount}× independently
            </span>
          )}
        </div>
        <button type="button" className="kb-open" onClick={onOpen}>
          Open chain →
        </button>
      </footer>
    </article>
  );
}
