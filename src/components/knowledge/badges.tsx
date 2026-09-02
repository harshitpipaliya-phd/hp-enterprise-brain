import type { ReactNode } from 'react';
import type { Tone } from '../../api/departmentIntelligence';
import type { Confidence, Freshness, Provenance } from '../../api/knowledgeLibrary';
import type { OutcomeMagnitude } from '../../api/organizationalMemory';
import { Pill } from '../intelligence/parts';

/* ==========================================================================
 *  THE GRADE BADGES
 *
 *  Both RETRIEVE surfaces label the same three things — how fresh, how sure,
 *  where from — so the badges live once and are imported by both. A reader who
 *  learns what STALE looks like on Knowledge Library must not have to learn it
 *  again on Memory.
 *
 *  EVERY BADGE CARRIES ITS WORD. The tone draws the eye; the text carries the
 *  meaning. Nothing here is legible by colour alone, and each badge exposes
 *  its reason through `title` so the grade can be interrogated in place.
 * ========================================================================== */

const FRESHNESS_TONE: Record<Freshness['state'], Tone> = {
  FRESH: 'good',
  AGING: 'warn',
  STALE: 'crit',
  UNDETERMINED: 'neutral',
};

const FRESHNESS_LABEL: Record<Freshness['state'], string> = {
  FRESH: 'Fresh',
  AGING: 'Aging',
  STALE: 'Stale',
  UNDETERMINED: 'Age unknown',
};

/**
 * How long since anyone touched this.
 *
 * The day count travels with the word because "Stale" alone invites the reader
 * to guess the scale — eight months and three years are both stale, and only
 * one of them means the procedure predates the current system.
 */
export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  const { state, days } = freshness;

  const detail =
    days === null
      ? 'No timestamp is recorded against this item, so its age cannot be established.'
      : `Last updated ${days} day${days === 1 ? '' : 's'} ago.`;

  return (
    <span title={detail}>
      <Pill tone={FRESHNESS_TONE[state]}>
        <span className="kb-dot" data-tone={FRESHNESS_TONE[state]} aria-hidden="true" />
        {FRESHNESS_LABEL[state]}
        {days !== null && <span className="kb-badge__sub">{days}d</span>}
      </Pill>
    </span>
  );
}

const CONFIDENCE_TONE: Record<Confidence['state'], Tone> = {
  CONFIRMED: 'good',
  SUPPORTED: 'warn',
  INFERRED: 'crit',
  UNDETERMINED: 'neutral',
};

/**
 * How far the organization can stand behind this.
 *
 * UNDETERMINED renders as the word, never as 0%. A claim nobody scored and a
 * claim scored at nothing are opposite findings, and a zero makes them
 * identical.
 */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { state, value, basis } = confidence;

  return (
    <span title={basis}>
      <Pill tone={CONFIDENCE_TONE[state]}>
        {state}
        {value !== null && <span className="kb-badge__sub">{Math.round(value * 100)}%</span>}
      </Pill>
    </span>
  );
}

/**
 * Where this row came from.
 *
 * SEEDED IS SHOWN, NOT HIDDEN AND NOT DISGUISED. A demonstration row presented
 * unlabelled beside a measured one teaches the reader to trust both equally,
 * and only one of them was earned. The badge is quiet, but it is always there.
 */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { state, detail } = provenance;

  if (state === 'OBSERVED') {
    return (
      <span className="kb-prov" data-state="observed" title={detail}>
        Observed
      </span>
    );
  }

  if (state === 'SEEDED') {
    return (
      <span className="kb-prov" data-state="seeded" title={detail}>
        Seeded — demonstration data
      </span>
    );
  }

  return (
    <span className="kb-prov" data-state="unknown" title={detail}>
      Origin unknown
    </span>
  );
}

/**
 * Whether an outcome actually moved, and by how much.
 *
 * THE ONE THAT MATTERS MOST. The stored `result` on every outcome here reads
 * "improved"; the metrics behind most of them are zero. This renders the
 * grade, not the stored word, so an unmeasured outcome reaches the reader as
 * UNDETERMINED with the reason attached rather than as a claimed success.
 */
export function MagnitudeBadge({ magnitude, result }: { magnitude: OutcomeMagnitude; result: string }) {
  if (magnitude.state === 'UNDETERMINED') {
    return (
      <span className="kb-mag" data-state="undetermined" title={magnitude.detail}>
        <b>UNDETERMINED</b>
        <span>recorded as “{result}”, never measured</span>
      </span>
    );
  }

  const change = magnitude.changePercent;
  const direction = change === null ? null : change > 0 ? '▲' : change < 0 ? '▼' : '■';

  return (
    <span className="kb-mag" data-state={magnitude.state.toLowerCase()} title={magnitude.detail}>
      <b>
        {result}
        {change !== null && direction !== null && (
          <>
            {' '}
            {direction} {Math.abs(change)}%
          </>
        )}
      </b>
      <span>{magnitude.state === 'MEASURED' ? 'measured against evidence' : 'reported, no evidence attached'}</span>
    </span>
  );
}

/**
 * A metric above a shelf or feed.
 *
 * `hint` is required: a bare number at the top of a screen is the easiest
 * place in an interface to mislead, because it looks authoritative and states
 * no basis. Making the caller supply one means a counter cannot ship without
 * saying what it counted.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
  active = false,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span className="kb-stat__l">{label}</span>
      <span className="kb-stat__v" data-tone={tone}>
        {value}
      </span>
      <span className="kb-stat__h">{hint}</span>
    </>
  );

  // A tile that filters is a real button; a tile that only reports is not
  // pretending to be one.
  if (!onClick) {
    return <div className="kb-stat">{body}</div>;
  }

  return (
    <button type="button" className="kb-stat kb-stat--action" onClick={onClick} aria-pressed={active}>
      {body}
    </button>
  );
}
