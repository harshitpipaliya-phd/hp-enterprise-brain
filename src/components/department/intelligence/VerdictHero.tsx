import { Dial } from '../../intelligence/parts';
import type { Confidence, DepartmentHeader, Health, Tone } from '../../../api/departmentIntelligence';

/**
 * THE VERDICT, AND HOW MUCH OF THE MODEL IT RESTS ON.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * TWO NUMBERS, DELIBERATELY UNEQUAL IN WEIGHT
 *
 * HEALTH is the verdict and owns the hero: the band, the score, the plain
 * sentence saying why. CONFIDENCE is secondary and sits to the side, because it
 * answers a different question — not "how is this unit doing" but "how much of
 * the question could we answer".
 *
 * They are never combined. A unit whose three measurable dimensions are strong
 * and whose four unmeasurable ones are unknown is a good unit we know little
 * about; blending the two produces a mediocre number that describes neither.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * UNDETERMINED IS PRINTED AS A WORD
 *
 * Where nothing is measurable there is no score, and the hero says so in the
 * place a number would have gone. It does not show 0, and it does not show a
 * midpoint: a unit nobody can see and a unit performing at zero are opposite
 * findings, and the second one is the emergency.
 */

const BAND_TONE: Record<Health['band'], Tone> = {
  healthy: 'good',
  good: 'good',
  watch: 'warn',
  critical: 'crit',
  undetermined: 'neutral',
};

export function VerdictHero({
  department,
  health,
  confidence,
}: {
  department: DepartmentHeader;
  health: Health;
  confidence: Confidence;
}) {
  const tone = BAND_TONE[health.band] ?? 'neutral';
  const measured = health.score !== null;

  const delta = health.deltaSinceRefresh;
  const deltaText =
    delta === null
      ? 'first measured refresh — no earlier score to compare'
      : `${delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} ${Math.abs(delta)} ${
          Math.abs(delta) === 1 ? 'pt' : 'pts'
        } since ${health.previousDate ?? 'the last refresh'}`;

  return (
    <header className="dv-verdict">
      <div>
        <div className="dv-verdict__eyebrow">
          Department intelligence
          {department.description ? ` · ${department.description}` : ''}
        </div>

        <h1>{department.name}</h1>

        <div className="dv-verdict__line">
          {/* The pill always contains the word, so the tone colour is never the
              only thing carrying the verdict. */}
          <span className="dv-verdict__band" data-tone={tone}>
            <span className="dv-dot" aria-hidden="true" />
            {health.label}
          </span>

          <span className="dv-verdict__score">
            {measured ? (
              <>
                {health.score}
                <small>/100</small>
              </>
            ) : (
              <span style={{ fontSize: 'var(--fs-h3)', letterSpacing: '0.04em' }}>UNDETERMINED</span>
            )}
          </span>

          <span className="dv-verdict__meta">
            {deltaText} · {department.headcount.toLocaleString()}{' '}
            {department.headcount === 1 ? 'person' : 'people'}
          </span>
        </div>

        <p className="dv-verdict__why">{health.reason}</p>
      </div>

      <div className="dv-verdict__side">
        <span style={{ color: 'var(--verdict-content-muted)' }}>
          <Dial
            value={confidence.pct}
            size={104}
            stroke={7}
            label={
              confidence.pct === null
                ? 'Data confidence not measurable'
                : `Data confidence ${confidence.pct} percent. ${confidence.caption}`
            }
          >
            <b style={{ fontSize: 'var(--fs-h3)' }}>
              {confidence.pct === null ? '—' : `${confidence.pct}%`}
            </b>
            <small>
              data
              <br />
              confidence
            </small>
          </Dial>
        </span>
        <div className="dv-verdict__note">{confidence.caption}</div>
      </div>
    </header>
  );
}
