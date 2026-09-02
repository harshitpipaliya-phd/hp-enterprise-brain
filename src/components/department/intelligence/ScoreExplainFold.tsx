import { ChevronDown } from 'lucide-react';
import type { ScoreExplain } from '../../../api/departmentIntelligence';

/**
 * HOW THIS SCORE IS CALCULATED, SIMPLY.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * OPEN BY DEFAULT
 *
 * A score nobody can check is a score nobody should act on. This is the only
 * fold on the page that starts open, because the arithmetic is the argument.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE TABLE ADDS UP IN FRONT OF THE READER
 *
 * value × weight = points, and the points sum to the total printed at the
 * bottom. That only works because the weight shown is the RE-BASED share — the
 * dimension's weight over the SURVIVING weight, which is what the engine divides
 * by. Printing the raw model weight beside points computed from the re-based one
 * is how a "how this is calculated" table stops adding up, so both are shown and
 * labelled: the share it carries now, and what it is worth in the whole model.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE WEIGHTS ARE THE SERVER'S
 *
 * There is no weight table in this file and none anywhere in the client. They
 * arrive on each component, from the same constant the scoring engine divides
 * by, so this panel cannot come to explain a formula the server is not using.
 */
export function ScoreExplainFold({ scoreExplain }: { scoreExplain: ScoreExplain }) {
  const { components, excluded, total } = scoreExplain;

  return (
    <details className="dv-fold" open>
      <summary>
        <h3>How this score is calculated, simply</h3>
        <span className="dv-panel__sub">
          {components.length} measured {components.length === 1 ? 'component' : 'components'}
          {excluded.length > 0 && `, ${excluded.length} excluded`}
        </span>
        <span className="dv-fold__chev" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </summary>

      <div className="dv-fold__body">
        {components.length === 0 ? (
          <p className="dv-plain">
            Nothing this model reads is recorded for this unit, so there is no score to explain.
            The blind spots above say what would produce one.
          </p>
        ) : (
          <>
            <div className="dv-math" style={{ borderBottom: 0, paddingBottom: 0 }}>
              <span className="dv-math__h">Measured component</span>
              <span className="dv-math__h">Value</span>
              <span className="dv-math__h">Weight</span>
              <span className="dv-math__h">Points</span>
            </div>

            {components.map((component) => (
              <div className="dv-math" key={component.key}>
                <span>
                  {component.label}
                  {component.attribution === 'owner' && (
                    <span className="dv-src"> · attributed by owner</span>
                  )}
                </span>
                <b>{component.valuePct}%</b>
                <span className="dv-math__x">
                  × {component.weight.toFixed(2)}
                  <span className="dv-src"> ({component.rawWeight} of {scoreExplain.modelWeight})</span>
                </span>
                <b>{component.points.toFixed(1)}</b>
                <span className="dv-math__basis">{component.basis}</span>
              </div>
            ))}

            <div className="dv-math__total">
              <span>Department health</span>
              <b>{total === null ? 'UNDETERMINED' : `${total} / 100`}</b>
            </div>
          </>
        )}

        <p className="dv-plain">
          <b>Only measured things count.</b> {scoreExplain.note}
        </p>

        {excluded.length > 0 && (
          <p className="dv-plain">
            <b>Excluded this time: </b>
            {excluded.map((e) => `${e.label} (worth ${e.rawWeight})`).join(', ')}. Together they are{' '}
            {(scoreExplain.modelWeight - scoreExplain.totalWeight).toFixed(2)} of the model's{' '}
            {scoreExplain.modelWeight} total weight — that missing weight is what lowers data
            confidence, and it is the only thing it lowers.
          </p>
        )}
      </div>
    </details>
  );
}
