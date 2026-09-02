import type { ReactNode } from 'react';
import type { Tone } from '../../../api/departmentIntelligence';
import type { StandingBand } from '../../../api/personIntelligence';
import { Sparkline } from '../../intelligence/parts';

/* ==========================================================================
 *  THE PIECES THE PERSON PROFILE IS ASSEMBLED FROM
 *
 *  Everything generic — Panel, Pill, Bar, Dial, Sparkline, DualBar, Fold —
 *  comes from components/intelligence/parts. What lives here is only what is
 *  specific to reading a PERSON: the band vocabulary, and the metric card that
 *  carries a source caption.
 * ========================================================================== */

/**
 * A band is a colour AND a word, always. The dot alone would put the whole
 * verdict in a hue, which is unreadable to anyone who cannot separate the
 * hues and unavailable to anyone reading the page as text.
 */
export function bandTone(band: StandingBand): Tone {
  switch (band) {
    case 'steady':
      return 'good';
    case 'watch':
      return 'warn';
    case 'support':
      return 'crit';
    case 'undetermined':
    default:
      return 'neutral';
  }
}

export function bandLabel(band: StandingBand): string {
  switch (band) {
    case 'steady':
      return 'Steady';
    case 'watch':
      return 'Watch';
    case 'support':
      return 'Needs support';
    case 'undetermined':
    default:
      return 'Undetermined';
  }
}

/**
 * THE WORD, NOT A DASH.
 *
 * A dimension with no basis to be computed renders the literal "UNDETERMINED"
 * next to what is missing and the one action that would fix it. A dash would
 * say the question was never asked; a zero would say it was asked and the
 * answer was none. Both are lies about the same row.
 */
export function Undetermined({ what, action }: { what: string; action?: ReactNode }) {
  return (
    <span className="pi-undet">
      <b>UNDETERMINED</b>
      <span className="pi-undet__why">{what}</span>
      {action}
    </span>
  );
}

/**
 * A metric card.
 *
 * THE SOURCE CAPTION IS NOT OPTIONAL (R6). Every figure on this screen is
 * derived from records somebody imported, and a reader who cannot see which
 * dataset produced a number has no way to check it or to fix it at source. The
 * prop is required, so a card cannot reach the screen without one.
 */
export function MetricCard({
  label,
  value,
  sub,
  source,
  spark,
  sparkTone = 'neutral',
  sparkLabel,
  flag,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  source: string;
  spark?: number[];
  sparkTone?: Tone;
  sparkLabel?: string;
  flag?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="pi-card">
      <header className="pi-card__head">
        <h4>{label}</h4>
        {flag}
      </header>
      <div className="pi-card__v">{value}</div>
      {sub && <div className="pi-card__sub">{sub}</div>}
      {spark && <Sparkline values={spark} tone={sparkTone} label={sparkLabel ?? label} />}
      {children}
      <p className="pi-src">{source}</p>
    </section>
  );
}

/** A labelled comparison row. The reference is part of the row, never implied. */
export function CompareRow({
  label,
  reference,
  children,
}: {
  label: string;
  reference: string;
  children: ReactNode;
}) {
  return (
    <div className="pi-cmp">
      <div className="pi-cmp__l">
        <span className="pi-cmp__lab">{label}</span>
        <span className="pi-cmp__ref">{reference}</span>
      </div>
      <div className="pi-cmp__r">{children}</div>
    </div>
  );
}

/** A real button that reads as a link. Never an <a> with no href. */
export function UnlockAction({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) return null;

  return (
    <button type="button" className="pi-unlock" onClick={onClick}>
      {label} →
    </button>
  );
}
