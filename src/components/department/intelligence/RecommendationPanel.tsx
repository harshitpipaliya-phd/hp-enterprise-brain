import { Button } from '../../../ui';
import type { Recommendation } from '../../../api/departmentIntelligence';

/**
 * ONE THING TO DO NEXT — AND HONESTY ABOUT WHETHER WE KNOW WHY.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE SUFFICIENCY GATE IS PART OF THE RECOMMENDATION, NOT A FOOTNOTE
 *
 * A recommendation is only as good as the questions that could be answered
 * before it was made, so the count travels with it: "5 of 7 answered". A reader
 * seeing 3 of 7 should discount the advice, and they can only do that if the
 * number is in front of them.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * UNDETERMINED IS PRINTED IN CAPITALS, ON PURPOSE
 *
 * Where the recorded data establishes WHAT is happening but not WHY, the root
 * cause is UNDETERMINED and the missing input is named. The alternative reading
 * is printed beside it, because the failure mode this whole screen is built
 * against is a confident action taken on top of an unexamined cause — and
 * "capacity" is always the most familiar explanation, which is exactly what
 * makes it the most dangerous guess.
 */
export function RecommendationPanel({
  recommendation,
  onOpenCase,
}: {
  recommendation: Recommendation;
  onOpenCase?: () => void;
}) {
  const gate = recommendation.sufficiencyGate;
  const unanswered = gate.questions.filter((q) => !q.answered);

  return (
    <section className="dv-reco" aria-labelledby="dv-reco-title">
      <div>
        <h3 id="dv-reco-title">Recommended next action</h3>
        <p>{recommendation.title}. {recommendation.body}</p>

        {recommendation.alternative && (
          <p className="dv-reco__meta">
            <strong>The alternative reading: </strong>
            {recommendation.alternative}
          </p>
        )}

        <div className="dv-reco__meta">
          <strong>Confidence: {recommendation.confidence}</strong> · {recommendation.confidenceReason} ·{' '}
          Sufficiency gate: <strong>{gate.answered} of {gate.total} answered</strong> ·{' '}
          Root cause: <strong>{recommendation.rootCause}</strong>
        </div>

        <div className="dv-reco__meta">
          {recommendation.rootCause === 'UNDETERMINED' && <>{recommendation.rootCauseMissing} </>}
          {unanswered.length > 0 && (
            <>
              Still unanswered: {unanswered.map((q) => q.question).join(' ')}
            </>
          )}
        </div>
      </div>

      {onOpenCase && (
        <Button variant="primary" onClick={onOpenCase}>
          Open as case
        </Button>
      )}
    </section>
  );
}
