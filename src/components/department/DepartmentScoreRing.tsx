import type { ReactNode } from 'react';
import type { ScoreStatus } from './departmentScore';

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
