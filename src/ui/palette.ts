/**
 * The one place a colour is chosen for data.
 *
 * WHY THIS FILE EXISTS. Eleven screens each declared their own `PALETTE` array
 * and their own SEVERITY_COLORS / STATUS_COLORS maps, in Tailwind defaults and
 * assorted one-off hexes — #ef4444 in fifty-five places, #22c55e in twenty-nine,
 * #3b82f6 in twenty-one. The visible consequence was that "critical" was a
 * different red on Signals than on Departments, and a chart series changed
 * colour when the same data appeared on another screen. That is precisely the
 * "random colors on different pages" the redesign exists to remove, and no
 * amount of retheming the stylesheet could fix it, because none of it was in
 * the stylesheet.
 *
 * EVERY VALUE IS A TOKEN REFERENCE, not a hex. `var(--chart-1)` resolves in SVG
 * fill/stroke and in inline styles exactly as it does in CSS, so these follow
 * the theme — including the dark instrument, where the chart ramp lightens to
 * stay legible on espresso. A hex here would have to be duplicated per theme
 * and would drift the first time one of them changed.
 *
 * ORDER IS PART OF THE CONTRACT. seriesColor(i) is stable, so the third series
 * of a chart is the same colour on every screen that draws it. Do not sort or
 * re-order these arrays to make one chart look nicer.
 *
 * WHAT THIS DOES NOT DO: it does not decide what is critical, what is resolved,
 * or which bucket a row falls into. Those are the API's answers and are read
 * from the data. This only says what colour the answer is drawn in.
 */

/**
 * Categorical series colours, in fixed order.
 *
 * Six is the practical ceiling for a categorical scale that must stay
 * distinguishable; a chart needing more categories needs grouping, not a
 * seventh hue.
 */
export const CHART_PALETTE = [
  'var(--chart-1)', // champagne — the primary series
  'var(--chart-2)', // sage
  'var(--chart-3)', // dusty rose
  'var(--chart-4)', // muted amber
  'var(--chart-5)', // plum
  'var(--chart-6)', // warm taupe
] as const;

/** Stable colour for series `i`, wrapping past the end of the palette. */
export function seriesColor(i: number): string {
  return CHART_PALETTE[((i % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length];
}

/**
 * Severity, as a warm descending ramp.
 *
 * Severity IS a verdict — unlike a capability level, where charts.tsx
 * deliberately uses one hue at varying opacity so a measurement is not read as
 * a judgement. Here the judgement is the point, so four distinct hues are
 * correct. Every consumer still renders the word beside the colour.
 */
export const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--status-crit)',   // burgundy
  high:     'var(--chart-3)',       // dusty rose
  medium:   'var(--status-warn)',   // amber
  low:      'var(--chart-2)',       // sage
  info:     'var(--content-tertiary)',
  unknown:  'var(--content-tertiary)',
};

/**
 * Signal / case lifecycle.
 *
 * Champagne for the states that need work, sage for resolved, neutral for
 * closed — so the eye lands on what is open rather than on what is finished.
 */
export const STATUS_COLOR: Record<string, string> = {
  new:           'var(--chart-1)',
  triaged:       'var(--chart-4)',
  investigating: 'var(--chart-5)',
  evidenced:     'var(--chart-3)',
  resolved:      'var(--status-good)',
  closed:        'var(--content-tertiary)',
  active:        'var(--chart-1)',
  inactive:      'var(--status-warn)',
  archived:      'var(--content-tertiary)',
  pending:       'var(--status-warn)',
  processing:    'var(--chart-1)',
  completed:     'var(--status-good)',
  failed:        'var(--status-crit)',
  error:         'var(--status-crit)',
  success:       'var(--status-good)',
  unknown:       'var(--content-tertiary)',
};

/**
 * Graph node colours, grouped by what the node IS rather than per label — the
 * graph is easier to read when the four families are four colours than when
 * twelve labels are twelve.
 */
export const GRAPH_NODE_COLOR: Record<string, string> = {
  Case: 'var(--chart-5)', Hypothesis: 'var(--chart-5)',
  Signal: 'var(--chart-1)', Evidence: 'var(--chart-1)',
  Recommendation: 'var(--chart-4)', Decision: 'var(--chart-4)',
  Risk: 'var(--status-crit)', Policy: 'var(--status-crit)',
  Organization: 'var(--chart-2)', Department: 'var(--chart-2)',
  Person: 'var(--chart-2)', Capability: 'var(--chart-2)',
};

/** Semantic single values, for the inline styles that need one colour. */
export const SEMANTIC = {
  good:    'var(--status-good)',
  warn:    'var(--status-warn)',
  crit:    'var(--status-crit)',
  info:    'var(--status-info)',
  accent:  'var(--accent-intelligence)',
  neutral: 'var(--content-tertiary)',
  text:    'var(--content-primary)',
  text2:   'var(--content-secondary)',
  border:  'var(--border-default)',
  surface: 'var(--surface-card)',
  inset:   'var(--surface-inset)',
} as const;

/**
 * Look a colour up by name, falling back to neutral rather than to a random
 * palette entry — an unrecognised status is unknown, and should look it.
 */
export function severityColor(name: string | null | undefined): string {
  return SEVERITY_COLOR[String(name ?? '').toLowerCase()] ?? SEVERITY_COLOR.unknown;
}

export function statusColor(name: string | null | undefined): string {
  return STATUS_COLOR[String(name ?? '').toLowerCase()] ?? STATUS_COLOR.unknown;
}
