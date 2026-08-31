import type { ReactNode } from 'react';
import type { ScoreStatus, DepartmentScore, ScoreDerivation } from './departmentScore';
import { departmentDerivation } from './departmentScore';

/**
 * THE SCORE, AS ONE OBJECT — used by the directory card and the detail header
 * so the two cannot render the same number differently.
 *
 * WHY A RING RATHER THAN "50 / 100". The old card printed the score as a
 * fraction, which reads as a mark out of a hundred and invites the eye to do
 * arithmetic that is not the point. The ring shows the same figure as a
 * proportion of the whole, so "76%" and "how full is this" arrive together.
 *
 * SVG, NOT A LIBRARY. Two circles and a dash offset — the whole control is
 * fewer lines than the import would be, it inherits the page's colours through
 * currentColor, and it scales with `size` rather than shipping a chart runtime
 * to draw one arc.
 *
 * `null` IS A FIRST-CLASS STATE, not a zero with different styling. An unscored
 * department renders an empty track and the words the caller supplies — never
 * a 0% ring, which is the visual claim that the department scored nothing.
 */
export function DepartmentScoreRing({
  score,
  status,
  label,
  size = 76,
  emptyLabel = 'Not scored',
  caption,
}: {
  score: number | null;
  status: ScoreStatus | null;
  /** "Excellent", "Healthy" … Rendered under the figure. */
  label?: string | null;
  size?: number;
  emptyLabel?: string;
  caption?: ReactNode;
}) {
  const stroke = Math.max(5, Math.round(size * 0.09));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A null score draws no arc at all; a real 0 draws none either, and the
  // figure beneath it is what tells them apart.
  const filled = score === null ? 0 : (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="dept-ring" data-status={status ?? 'unknown'} style={{ ['--dept-ring-size' as string]: `${size}px` }}>
      {/* The dial is its own box so the legend below can sit in NORMAL FLOW.
          It used to be absolutely positioned at `top: 100%`, which put the
          status word and caption outside the component's own height — they hung
          past the bottom of whatever contained the ring, and the detail header
          had to be given 34px of dead margin to stop them colliding with the
          next block. Anything measuring this component got the dial's height and
          none of the text under it. */}
      <div className="dept-ring__dial">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
          <circle
            className="dept-ring__track"
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={stroke}
          />
          {score !== null && (
            <circle
              className="dept-ring__fill"
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
              // Start at twelve o'clock rather than three, which is where a
              // reader expects a gauge to begin.
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>

        <div className="dept-ring__center">
          {score === null ? (
            <span className="dept-ring__empty">{emptyLabel}</span>
          ) : (
            <span className="dept-ring__value">
              {score}
              <small>%</small>
            </span>
          )}
        </div>
      </div>

      {(label || caption) && (
        <div className="dept-ring__legend">
          {label && <span className="dept-ring__label">{label}</span>}
          {caption && <span className="dept-ring__caption">{caption}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * One dimension as a labelled meter.
 *
 * An unmeasurable dimension renders its bar EMPTY and says why, rather than
 * being dropped: the sentence explaining what this organization does not record
 * is the most actionable line on the page, and hiding the row hides it.
 */
export function DepartmentMeter({
  label,
  score,
  status,
  basis,
}: {
  label: string;
  score: number | null;
  status: ScoreStatus | null;
  basis: string;
}) {
  return (
    <div className="dept-meter" data-status={score === null ? 'unknown' : status ?? 'unknown'}>
      <div className="dept-meter__head">
        <span className="dept-meter__label">{label}</span>
        <span className="dept-meter__value">
          {score === null ? 'Not measured' : `${score}%`}
        </span>
      </div>
      <div className="dept-meter__track">
        <i style={{ width: score === null ? '0%' : `${Math.max(2, score)}%` }} />
      </div>
      <p className="dept-meter__basis">{basis}</p>
    </div>
  );
}

/**
 * A compact figure with a label and a supporting line.
 *
 * `value === null` means the metric could not be derived, and the block says so
 * in words. It never falls back to 0 — the whole reason this component takes a
 * nullable value is that "0 people" and "we could not count the people" are
 * different facts that a bare 0 would merge.
 */
export function DepartmentStat({
  label,
  value,
  hint,
  emptyHint = 'Not enough data',
  tone = 'state',
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  emptyHint?: string;
  tone?: 'state' | 'good' | 'warn' | 'crit';
}) {
  const empty = value === null || value === undefined;

  return (
    <article className="dept-stat" data-tone={empty ? 'state' : tone} data-empty={empty || undefined}>
      <span className="dept-stat__label">{label}</span>
      <strong className="dept-stat__value">
        {empty ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
      </strong>
      <span className="dept-stat__hint">{empty ? emptyHint : hint}</span>
    </article>
  );
}

/**
 * HOW THE SCORE WAS REACHED — one sentence, then the arithmetic.
 *
 * The first version of this was a four-column table. On a department where one
 * dimension of seven survives, a table of one row with a "weight x score"
 * column is heavier than the fact it carries: the reader has to parse a grid to
 * learn that 33 divided by 1 is 33.
 *
 * So the arithmetic leads as a single line, and the table only appears when
 * there is genuinely something to compare — two or more measured dimensions.
 * Below it, what is NOT counted, ordered by the weight it would add, because on
 * a young organization that ranking is the actual advice.
 */
export function DepartmentScoreDerivation({ scored }: { scored: DepartmentScore }) {
  const d = departmentDerivation(scored);

  if (d.contributions.length === 0) {
    return (
      <section className="dept-intel__card di-derivation" aria-label="How this score is derived">
        <div className="dept-intel__card-head">
          <h2>How this score is derived</h2>
        </div>
        <p className="di-note di-note--empty">
          No dimension could be measured, so there is no score to derive. The list below is what this organization
          would need to record.
        </p>
        <DerivationGaps derivation={d} />
      </section>
    );
  }

  const only = d.contributions.length === 1 ? d.contributions[0] : null;

  return (
    <section className="dept-intel__card di-derivation" aria-label="How this score is derived">
      <div className="dept-intel__card-head">
        <h2>How this score is derived</h2>
        <span>{Math.round(d.coverage * 100)}% of the model measurable</span>
      </div>

      {/* The whole calculation, in the form a reader can check at a glance. */}
      <p className="di-derivation__headline">
        <strong>{d.score}%</strong>
        {only
          ? <> is {only.label.toLowerCase()} ({only.score}%) — the only one of {d.contributions.length + d.exclusions.length} dimensions this organization can measure.</>
          : <> is the weighted average of the {d.contributions.length} dimensions this organization can measure.</>}
      </p>

      {d.contributions.length > 1 && (
        <ul className="di-derivation__terms">
          {d.contributions.map((c) => (
            <li key={c.key}>
              <span>{c.label}</span>
              <strong>{c.score}%</strong>
              <small>{Math.round(c.share * 100)}% of the score</small>
            </li>
          ))}
        </ul>
      )}

      <p className="di-derivation__note">
        The {d.exclusions.length} unmeasured {d.exclusions.length === 1 ? 'dimension is' : 'dimensions are'} left out
        rather than counted as zero, so this unit is not marked down for data the source system has never held.
      </p>

      <DerivationGaps derivation={d} />
    </section>
  );
}

/**
 * What is not counted, and what would turn it on — heaviest first.
 *
 * Ordered by weight because that ordering IS the recommendation: recording the
 * dimension that carries 1.5 changes the score more than the one that carries
 * 0.75, and a reader deciding where to start is owed that ranking rather than
 * the order the model happens to define them in.
 */
function DerivationGaps({ derivation }: { derivation: ScoreDerivation }) {
  if (derivation.exclusions.length === 0) return null;

  const ranked = [...derivation.exclusions].sort((a, b) => b.weight - a.weight);

  return (
    <div className="di-derivation__missing">
      <h3>What would raise it</h3>
      <ol>
        {ranked.map((x) => (
          <li key={x.key}>
            <span className="di-derivation__missing-name">
              {x.label}
              <small>+{x.weight} weight</small>
            </span>
            <span className="di-derivation__missing-fix">{x.remedy}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
