/**
 * The three-layer reading of a screen: State, Movement, Consequence.
 *
 * WHAT THE LAYERS ARE FOR. A dashboard that reports only State — 412 people, 14
 * departments, 43 unassigned — makes the reader do all the work. They have to
 * remember what it said last month to know whether it is getting worse, and
 * decide for themselves whether any of it matters. Most people do neither, which
 * is why most dashboards are opened once.
 *
 *   State        what is true now
 *   Movement     how it changed, and how fast
 *   Consequence  what it costs, and what to do about it
 *
 * CONSEQUENCE IS ALLOWED TO BE EMPTY, and saying so is the whole discipline of
 * this file. A screen with nothing real to put there renders <ConsequenceEmpty>
 * naming the data that is missing and what would produce it. It never invents a
 * plausible sentence, because an invented consequence is indistinguishable from
 * a derived one and destroys trust in the ones that are real.
 *
 * Everything here is presentational. No component fetches, and none computes a
 * confidence — confidence arrives from the API, which is the only place allowed
 * to derive it.
 */

import React from 'react'

/* ─────────────────────────── the strip ─────────────────────────── */

export function LayerStrip({ children }: { children: React.ReactNode }) {
  return <div className="bl-strip">{children}</div>
}

function Layer({ tone, tag, children }: { tone: 'state' | 'move' | 'conseq'; tag: string; children: React.ReactNode }) {
  return (
    <section className={`bl-layer bl-layer--${tone}`} aria-label={tag}>
      <div className="bl-layer__tag">{tag}</div>
      <div className="bl-layer__body">{children}</div>
    </section>
  )
}

export const StateLayer = ({ children }: { children: React.ReactNode }) => (
  <Layer tone="state" tag="Layer 1 · State">{children}</Layer>
)

export const MovementLayer = ({ children }: { children: React.ReactNode }) => (
  <Layer tone="move" tag="Layer 2 · Movement">{children}</Layer>
)

export const ConsequenceLayer = ({ children }: { children: React.ReactNode }) => (
  <Layer tone="conseq" tag="Layer 3 · Consequence">{children}</Layer>
)

/** The headline figure of a State layer. */
export function LayerFigure({ value, unit, note }: { value: React.ReactNode; unit?: string; note?: string }) {
  return (
    <>
      <div className="bl-figure">{value}{unit ? <small>{unit}</small> : null}</div>
      {note ? <p className="bl-note">{note}</p> : null}
    </>
  )
}

/** The findings list a Movement or Consequence layer is usually made of. */
export function LayerPoints({ points }: { points: React.ReactNode[] }) {
  return (
    <ul className="bl-points">
      {points.map((p, i) => <li key={i}>{p}</li>)}
    </ul>
  )
}

/**
 * What a layer renders when it has nothing real to say.
 *
 * `missing` names the data, `produces` names the thing that would create it.
 * Both are required: "no data" tells a user they are stuck, whereas "no
 * outcomes have been recorded — close a recommendation to record one" tells
 * them what to do. A layer that cannot fill both in has not earned the right to
 * be on the screen at all.
 */
export function ConsequenceEmpty({ missing, produces }: { missing: string; produces: string }) {
  return (
    <div className="bl-empty">
      <p className="bl-empty__what">Nothing to report yet.</p>
      <p className="bl-empty__why">
        This needs <strong>{missing}</strong>, and none exists for this organization.
      </p>
      <p className="bl-empty__how">{produces}</p>
    </div>
  )
}

/* ─────────────────────────── metric ─────────────────────────── */

export interface MetricProps {
  label: string
  /** null renders as "never measured", never as 0. */
  value: number | string | null
  unit?: string
  /** 0..1 from the API. Never computed here. */
  confidence?: number | null
  /** How the figure was derived — shown under the confidence bar. */
  basis?: string
  /** What would have to be true for it to be measurable. Required when null. */
  missing?: string
}

/**
 * A single figure that carries how much it should be believed.
 *
 * A number with no confidence attached invites full belief, and most numbers in
 * this product do not deserve it. Null renders as an explanation rather than a
 * value, because "43" and "we have never looked" are different answers and only
 * one of them supports a decision.
 */
export function Metric({ label, value, unit, confidence, basis, missing }: MetricProps) {
  const unmeasured = value === null

  return (
    <div className={`bl-metric${unmeasured ? ' bl-metric--none' : ''}`}>
      <div className="bl-metric__label">{label}</div>

      {unmeasured ? (
        <div className="bl-metric__none">never measured</div>
      ) : (
        <div className="bl-metric__value">
          {value}{unit ? <small>{unit}</small> : null}
        </div>
      )}

      {!unmeasured && confidence != null && (
        <div className="bl-metric__bar" role="img"
          aria-label={`Confidence ${(confidence * 100).toFixed(0)} per cent`}>
          <i style={{ width: `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%` }} />
        </div>
      )}

      <div className="bl-metric__basis">
        {unmeasured
          ? (missing ?? 'No source data for this figure.')
          : [confidence != null ? `confidence ${confidence.toFixed(2)}` : null, basis].filter(Boolean).join(' · ')}
      </div>
    </div>
  )
}

/* ─────────────────────────── undetermined ─────────────────────────── */

/**
 * A first-class "cannot answer yet", with the gaps named.
 *
 * This is what the API returns as HTTP 200 rather than an error or a
 * low-confidence guess, and the UI has to honour that. A spinner implies the
 * answer is coming; a confident paragraph at 0.2 confidence is worse than
 * silence. Naming the gaps turns a dead end into a task list.
 */
export function Undetermined({ gaps, question }: { gaps: string[]; question?: string }) {
  return (
    <div className="bl-undet" role="status">
      <h4>Undetermined</h4>
      {question ? <p className="bl-undet__q">{question}</p> : null}
      <p>
        Cannot answer yet. Missing:{' '}
        {gaps.map((g, i) => (
          <React.Fragment key={g}>
            {i > 0 ? ' ' : ''}<code>{g}</code>
          </React.Fragment>
        ))}
        .
      </p>
      <p className="bl-undet__why">
        Returned as a result rather than a guess at reduced confidence.
      </p>
    </div>
  )
}

/* ─────────────────────────── evidence ─────────────────────────── */

/**
 * A claim's receipt. Expands to the rows it was derived from.
 *
 * Every figure in this product should be traceable to records somebody can go
 * and look at. A number that cannot be expanded is an assertion, and assertions
 * are what this product is supposed to replace.
 */
export function EvidenceChip({ count, children }: { count: number; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  if (count === 0) {
    return <span className="bl-chip bl-chip--none">no evidence on file</span>
  }

  return (
    <>
      <button type="button" className="bl-chip bl-chip--ev" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {count} {count === 1 ? 'record' : 'records'} {open ? '⌃' : '⌄'}
      </button>
      {open && <div className="bl-evidence">{children}</div>}
    </>
  )
}

/** Severity as a word, not only a colour. */
export function SeverityChip({ severity }: { severity: string }) {
  const known = ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'unknown'
  return <span className={`bl-chip bl-chip--sev-${known}`}>{severity}</span>
}

/**
 * Confidence as a chip, for lists where a bar does not fit.
 *
 * Shows the number, not a word. "High confidence" hides whether it was 0.71 or
 * 0.94, and those support different decisions.
 */
export function ConfidenceChip({ value }: { value: number | null }) {
  if (value === null) return <span className="bl-chip bl-chip--none">no confidence</span>
  return <span className="bl-chip bl-chip--conf">conf {value.toFixed(2)}</span>
}

/* ─────────────────────────── panel ─────────────────────────── */

export interface PanelProps {
  title: string
  /** A short gloss on what the panel shows — units, scope, cadence. */
  hint?: string
  right?: React.ReactNode
  /** The takeaway. Prose, under the chart, saying what a reader should notice. */
  footnote?: React.ReactNode
  flush?: boolean
  children: React.ReactNode
}

export function Panel({ title, hint, right, footnote, flush, children }: PanelProps) {
  return (
    <section className="bl-panel">
      <header className="bl-panel__head">
        <h3>{title}</h3>
        {hint ? <span className="bl-panel__hint">{hint}</span> : null}
        {right ? <span className="bl-panel__right">{right}</span> : null}
      </header>
      <div className={`bl-panel__body${flush ? ' bl-panel__body--flush' : ''}`}>{children}</div>
      {footnote ? <footer className="bl-panel__foot">{footnote}</footer> : null}
    </section>
  )
}

/* ─────────────────────────── attention ─────────────────────────── */

export interface AttentionItem {
  id: string
  title: string
  severity: string
  detail: string
  /** What ignoring it costs. Omit entirely rather than inventing one. */
  cost?: string | null
  confidence: number | null
  evidence: string[]
}

/**
 * The queue, ordered by the caller.
 *
 * An EMPTY queue renders a claim about data, not a congratulation. "Nothing
 * needs attention" and "nothing has been checked" look identical to a user and
 * mean opposite things, so this says which one it is.
 */
export function AttentionQueue({ items, checked }: { items: AttentionItem[]; checked: boolean }) {
  if (items.length === 0) {
    return (
      <div className="bl-empty">
        <p className="bl-empty__what">{checked ? 'Nothing needs attention.' : 'Nothing has been checked yet.'}</p>
        <p className="bl-empty__why">
          {checked
            ? 'Every detection rule ran and none of them matched.'
            : 'No detection rule has run against this organization, so an empty list means unexamined, not healthy.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bl-queue">
      {items.map((item) => (
        <article key={item.id} className={`bl-att bl-att--${item.severity}`}>
          <div className="bl-att__row">
            <SeverityChip severity={item.severity} />
            <h4 className="bl-att__title">{item.title}</h4>
          </div>
          <p className="bl-att__detail">{item.detail}</p>
          <div className="bl-att__row bl-att__row--meta">
            <ConfidenceChip value={item.confidence} />
            <EvidenceChip count={item.evidence.length}>
              {item.evidence.map((e, i) => <div key={i} className="bl-evidence__row">{e}</div>)}
            </EvidenceChip>
            {item.cost ? <span className="bl-att__cost">{item.cost}</span> : null}
          </div>
        </article>
      ))}
    </div>
  )
}
