import type { ReactNode } from 'react';
import { Button } from '../../ui';
import type { MeasureFormat, Tone } from '../../api/departmentIntelligence';

/**
 * THE ATOMS THIS SCREEN IS BUILT FROM.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE ONE RULE THEY ALL ENCODE: null IS NOT ZERO
 *
 * Every component here that can receive a null value renders the SENTENCE
 * explaining the absence, never a 0, a dash, or "N/A". That is not a stylistic
 * preference. A department with no open work and a department whose work is not
 * recorded are opposite findings, and as a zero they are indistinguishable —
 * one of them is a unit running clean and the other is a unit nobody can see.
 *
 * Because the rule lives in these atoms rather than in each section, a new
 * section cannot accidentally opt out of it.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * FORMATTING ONLY. NOTHING HERE COMPUTES A FIGURE.
 *
 * These decide how a number LOOKS, never what it is. Every value arrives derived
 * from the server, because each is derived from organization-wide aggregates a
 * browser would need every department's records to reproduce.
 */

/* ========================================================================== */
/*  FORMATTING                                                                */
/* ========================================================================== */

export function formatValue(value: number, format: MeasureFormat): string {
  switch (format) {
    case 'rate':
      return `${Math.round(value * 100)}%`;
    case 'percent':
      return `${Math.round(value)}%`;
    case 'days':
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
    case 'decimal':
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    case 'score':
      return `${Math.round(value)}`;
    case 'count':
    default:
      return Math.round(value).toLocaleString();
  }
}

/** A share of 100 for a bar's width, from whichever format the value is in. */
export function toPercent(value: number, format: MeasureFormat): number {
  const pct = format === 'rate' ? value * 100 : value;

  return Math.max(0, Math.min(100, pct));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** A date as the reader would say it. Invalid input stays as it arrived. */
export function shortDate(value: string | null): string | null {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ========================================================================== */
/*  PANEL                                                                     */
/* ========================================================================== */

export function Panel({
  title,
  sub,
  action,
  footer,
  children,
}: {
  title?: string;
  sub?: string | null;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dv-panel">
      {(title || action) && (
        <div className="dv-panel__head">
          {title && <h3>{title}</h3>}
          {sub && <span className="dv-panel__sub">{sub}</span>}
          {action}
        </div>
      )}
      {children}
      {footer && <p className="dv-foot">{footer}</p>}
    </section>
  );
}

export function SectionHeading({ title, sub }: { title: string; sub?: string | null }) {
  return (
    <div className="dv-section">
      <h2>{title}</h2>
      {sub && <span className="dv-section__sub">{sub}</span>}
    </div>
  );
}

/**
 * A whole section that could not be filled.
 *
 * IT STAYS ON THE PAGE. Hiding it would tell the reader the question was never
 * asked, when in fact it was asked and could not be answered — and the second is
 * a finding they can act on.
 */
export function NotMeasurable({
  what,
  reason,
  fixLabel,
  onFix,
}: {
  what: string;
  reason: string;
  fixLabel?: string;
  onFix?: () => void;
}) {
  return (
    <div className="dv-empty">
      <b>{what} is not measurable yet</b>
      <span>{reason}</span>
      {fixLabel && onFix && (
        <Button variant="ghost" size="sm" onClick={onFix}>
          {fixLabel}
        </Button>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  FIGURES                                                                   */
/* ========================================================================== */

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  // The tone is an attribute AND the pill always contains words, so colour is
  // never the only thing carrying the meaning.
  return (
    <span className="dv-pill" data-tone={tone}>
      {children}
    </span>
  );
}

export function Bar({ pct, tone = 'neutral', label }: { pct: number; tone?: Tone; label: string }) {
  const width = Math.max(0, Math.min(100, pct));

  return (
    <span
      className="dv-bar"
      role="img"
      aria-label={label}
      title={label}
    >
      <i style={{ width: `${width}%` }} data-tone={tone} />
    </span>
  );
}

/**
 * A ring. `value` is 0–100; `null` draws the track alone and says so in its
 * label, rather than drawing an empty ring that reads as zero.
 */
export function Dial({
  value,
  size,
  stroke,
  label,
  children,
}: {
  value: number | null;
  size: number;
  stroke: number;
  label: string;
  children: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value === null ? 0 : (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div className="dv-dial" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={stroke}
        />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        )}
      </svg>
      <div className="dv-dial__n" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

/**
 * One labelled measure.
 *
 * When `value` is null the row becomes the reason: the label, then the sentence
 * saying what is missing. There is no numeric slot to leave empty, so there is
 * nothing for a zero to fill.
 */
export function MeasureRow({
  label,
  value,
  format,
  hint,
  source,
  tone = 'neutral',
  showBar = false,
}: {
  label: string;
  value: number | null;
  format: MeasureFormat;
  hint: string;
  source?: string | null;
  tone?: Tone;
  showBar?: boolean;
}) {
  if (value === null) {
    return (
      <div className="dv-row dv-row--none">
        <span className="dv-row__lab">{label}</span>
        <span className="dv-why">{hint}</span>
      </div>
    );
  }

  const text = formatValue(value, format);
  const barred = showBar && (format === 'rate' || format === 'percent');

  /*
    THE SUPPORTING SENTENCE STAYS ON EVERY MEASURED ROW.

    It was previously shown as a pill and therefore dropped for rates, which
    render a bar in the pill's place — so exactly the rows carrying a percentage,
    the ones hardest to check, were the ones that lost "14,986 of 16,505
    classified records". A figure whose denominator is not on screen cannot be
    audited, and the source it came from is half of what makes it trustworthy.
  */
  return (
    <div className="dv-row">
      <span className="dv-row__lab">
        {label}
        <span className="dv-why">
          {hint}
          {source && ` · from ${source}`}
        </span>
      </span>
      <span className="dv-row__val">
        <span className="dv-fig">{text}</span>
        {barred && <Bar pct={toPercent(value, format)} tone={tone} label={`${label}: ${text}`} />}
      </span>
    </div>
  );
}

/* ========================================================================== */
/*  LOADING                                                                   */
/* ========================================================================== */

/**
 * PER SECTION, NOT A PAGE SPINNER. The skeleton holds the same shape the real
 * content will, so nothing on the page moves when the data lands.
 */
export function Skeleton({ height, width = '100%' }: { height: number; width?: number | string }) {
  return <div className="dv-skel" style={{ height, width }} aria-hidden="true" />;
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section className="dv-panel" aria-hidden="true">
      <Skeleton height={16} width="38%" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={13} width={`${92 - i * 7}%`} />
      ))}
    </section>
  );
}

/* ========================================================================== */
/*  SPARKLINE, DUAL-BAR, FOLD                                                 */
/*                                                                            */
/*  Added when the Person Profile was rebuilt. They live here rather than in  */
/*  the person folder because none of them knows what a person is — they take */
/*  numbers and a label. The department screens can adopt them unchanged.     */
/* ========================================================================== */

/**
 * An 8-point trend, drawn as a polyline.
 *
 * A FLAT LINE AND NO LINE ARE DIFFERENT ANSWERS. A series that is genuinely
 * flat (one assessment repeated, a steady week-on-week count) draws its flat
 * line. A series with nothing in it draws nothing and says so in the label,
 * because a line pinned to the floor reads as "zero every week" — which is a
 * measurement, not an absence.
 */
export function Sparkline({
  values,
  tone = 'neutral',
  label,
  height = 34,
}: {
  values: number[];
  tone?: Tone;
  label: string;
  height?: number;
}) {
  const points = values.filter((v) => Number.isFinite(v));

  if (points.length < 2) {
    return (
      <span className="dv-spark dv-spark--none" role="img" aria-label={`${label}: not enough history to draw a trend`}>
        not enough history
      </span>
    );
  }

  const width = 100;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  // Inset by one stroke so the extreme points are not clipped by the viewBox.
  const top = 2;
  const usable = height - top * 2;

  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = top + usable - ((v - min) / span) * usable;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      className="dv-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${points.join(', ')}`}
      data-tone={tone}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * A value bar with a reference marker on it.
 *
 * THE REFERENCE IS ALWAYS NAMED (R5). There is no way to render this without
 * saying what the tick is — `referenceLabel` is required — so a comparison can
 * never reach the screen as a bare "you are here" against an unstated baseline.
 */
export function DualBar({
  value,
  reference,
  max,
  tone = 'neutral',
  label,
  referenceLabel,
}: {
  value: number;
  reference: number | null;
  max: number;
  tone?: Tone;
  label: string;
  referenceLabel: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const refPct = reference === null ? null : Math.max(0, Math.min(100, (reference / max) * 100));

  return (
    <span
      className="dv-dual"
      role="img"
      aria-label={
        reference === null
          ? `${label}: ${value} of ${max}, no reference on file`
          : `${label}: ${value} of ${max}, ${referenceLabel} ${reference}`
      }
    >
      <i className="dv-dual__fill" style={{ width: `${pct}%` }} data-tone={tone} />
      {refPct !== null && (
        <>
          <i className="dv-dual__tick" style={{ left: `${refPct}%` }} aria-hidden="true" />
          <em className="dv-dual__ref" style={{ left: `${refPct}%` }} aria-hidden="true">
            {referenceLabel}
          </em>
        </>
      )}
    </span>
  );
}

/**
 * A collapsible section built on <details>, so it is keyboard-operable and
 * findable by the browser's own find-in-page without any JavaScript of ours.
 */
export function Fold({
  title,
  badge,
  open = false,
  children,
}: {
  title: string;
  badge?: string | null;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="dv-fold" open={open}>
      <summary>
        <span className="dv-fold__t">{title}</span>
        {badge && <span className="dv-fold__b">{badge}</span>}
      </summary>
      <div className="dv-fold__body">{children}</div>
    </details>
  );
}
