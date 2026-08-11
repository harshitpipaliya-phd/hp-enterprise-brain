/**
 * Hand-built SVG charts for the Brain.
 *
 * NO CHART LIBRARY, DELIBERATELY. Every general-purpose charting package treats
 * a missing value as either zero or a gap to interpolate across, and both are
 * lies this product cannot afford. "Nobody has ever been assessed on inclusive
 * education" and "everybody scored zero" are opposite findings — the first says
 * look, the second says act — and a library that renders them identically
 * destroys the distinction the whole system exists to preserve. Here, null gets
 * its own visual encoding: a hatch, never a value.
 *
 * COLOUR RULES, which are not decoration:
 *
 *   1. Magnitude uses ONE hue at varying opacity, never red-amber-green. A
 *      capability level of 2.4 is a measurement, not a verdict; RAG smuggles a
 *      judgement into it and invites the reader to skip the number.
 *   2. Red is reserved for consequence — a deficit, a breach, an overdue item —
 *      so it keeps meaning something when it appears.
 *   3. Everything reads from semantic design tokens, so both themes work and
 *      neither is hardcoded here.
 *
 * SIZING. Charts render into a viewBox and scale to their container width.
 * Callers give a nominal width and height; the aspect ratio is preserved.
 */

import React from 'react'

/* ─────────────────────────── shared ─────────────────────────── */

/** Semantic tokens, resolved by the browser so both themes work. */
const T = {
  data: 'var(--chart-data, var(--feedback-info-solid))',
  dataSoft: 'var(--feedback-info-content)',
  move: 'var(--feedback-warning-solid)',
  conseq: 'var(--feedback-error-solid)',
  good: 'var(--feedback-success-solid)',
  rule: 'var(--border-default)',
  ruleSoft: 'var(--border-subtle)',
  text: 'var(--content-primary)',
  text2: 'var(--content-secondary)',
  text3: 'var(--content-tertiary)',
  /** Never-measured. Muted on purpose: absence should not compete for attention. */
  none: 'var(--content-tertiary)',
} as const

let uid = 0
const nextId = () => `bc${++uid}`

/**
 * The hatch that means "never measured".
 *
 * One definition per chart instance because SVG pattern ids are document-global
 * and two charts on a page would otherwise collide.
 */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-hatch`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke={T.none} strokeWidth="1.6" opacity="0.55" />
      </pattern>
    </defs>
  )
}

interface FrameProps {
  width: number
  height: number
  label: string
  children: React.ReactNode
}

/**
 * Every chart is an image with a text alternative. The label is the finding,
 * not the chart type — "capability coverage by unit" tells a screen reader
 * nothing that "bar chart" does not.
 */
function Frame({ width, height, label, children }: FrameProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ height: 'auto', display: 'block', overflow: 'visible' }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  )
}

const Text = ({
  x, y, children, size = 11, fill = T.text2, weight = 400, anchor = 'start', mono = false,
}: {
  x: number; y: number; children: React.ReactNode; size?: number; fill?: string
  weight?: number; anchor?: 'start' | 'middle' | 'end'; mono?: boolean
}) => (
  <text
    x={x} y={y} fontSize={size} fill={fill} fontWeight={weight} textAnchor={anchor}
    fontFamily={mono ? 'var(--font-mono, ui-monospace, monospace)' : 'inherit'}
  >
    {children}
  </text>
)

/* ─────────────────────────── sparkline ─────────────────────────── */

export interface SparklineProps {
  /** null entries are genuine gaps and are not bridged. */
  values: (number | null)[]
  width?: number
  height?: number
  color?: string
  label?: string
}

/**
 * A trend, with gaps left as gaps.
 *
 * A run of nulls breaks the line rather than drawing through it. An
 * interpolated segment asserts a measurement nobody took.
 */
export function Sparkline({ values, width = 120, height = 32, color = T.data, label }: SparklineProps) {
  const known = values.filter((v): v is number => v !== null)
  if (known.length < 2) {
    return (
      <Frame width={width} height={height} label={label ?? 'Not enough history to draw a trend'}>
        <Text x={0} y={height / 2 + 4} size={10} fill={T.none}>not enough history</Text>
      </Frame>
    )
  }

  const max = Math.max(...known)
  const min = Math.min(...known)
  const range = max - min || 1
  const X = (i: number) => (i / (values.length - 1)) * width
  const Y = (v: number) => height - 3 - ((v - min) / range) * (height - 8)

  // Break the path at every null instead of joining across it.
  const segments: string[] = []
  let current = ''
  values.forEach((v, i) => {
    if (v === null) { if (current) segments.push(current); current = ''; return }
    current += `${current ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(v).toFixed(1)} `
  })
  if (current) segments.push(current)

  // Explicit accumulator type: inferred from the array it would widen to
  // `number | null` and take the index expression with it.
  const lastIndex = values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1)
  const lastValue = lastIndex >= 0 ? values[lastIndex] : null

  return (
    <Frame width={width} height={height} label={label ?? 'Trend'}>
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      ))}
      {lastValue !== null && (
        <circle cx={X(lastIndex)} cy={Y(lastValue)} r="2.6" fill={color} />
      )}
    </Frame>
  )
}

/* ─────────────────────────── horizontal bars ─────────────────────────── */

export interface BarRow {
  key: string
  /** null means never measured — hatched, not drawn as zero. */
  value: number | null
  color?: string
  /** Replaces the numeric label, for units the caller formats itself. */
  display?: string
}

export interface HBarsProps {
  rows: BarRow[]
  width?: number
  labelWidth?: number
  rowHeight?: number
  max?: number
  color?: string
  format?: (v: number) => string
  label?: string
}

export function HBars({
  rows, width = 420, labelWidth = 150, rowHeight = 26, max, color = T.data, format = (v) => String(v), label,
}: HBarsProps) {
  const known = rows.map((r) => r.value).filter((v): v is number => v !== null)
  const scaleMax = max ?? Math.max(...known, 1)
  const barArea = width - labelWidth - 62
  const height = rows.length * rowHeight + 10

  return (
    <Frame width={width} height={height} label={label ?? 'Comparison'}>
      <Defs id="hb" />
      {rows.map((r, i) => {
        const y = i * rowHeight + 6
        if (r.value === null) {
          return (
            <g key={r.key}>
              <Text x={0} y={y + 13} size={11.5} fill={T.text} weight={600}>{r.key}</Text>
              <rect x={labelWidth} y={y + 2} width={barArea} height={14} rx={2} fill="url(#hb-hatch)" opacity={0.5} />
              <Text x={labelWidth + barArea + 7} y={y + 13} size={10.5} fill={T.none}>never measured</Text>
            </g>
          )
        }
        const w = Math.max(2, (r.value / scaleMax) * barArea)
        return (
          <g key={r.key}>
            <Text x={0} y={y + 13} size={11.5} fill={T.text} weight={600}>{r.key}</Text>
            <rect x={labelWidth} y={y + 2} width={w} height={14} rx={2} fill={r.color ?? color} opacity={0.9} />
            <Text x={labelWidth + w + 7} y={y + 13} size={11} fill={T.text2} weight={600} mono>
              {r.display ?? format(r.value)}
            </Text>
          </g>
        )
      })}
    </Frame>
  )
}

/* ─────────────────────────── stacked area ─────────────────────────── */

export interface StackedAreaProps {
  series: Record<string, number[]>
  colors: Record<string, string>
  periodLabels?: (string | null)[]
  width?: number
  height?: number
  label?: string
}

/** Arrival composition over time. Shape carries the finding; a total hides it. */
export function StackedArea({ series, colors, periodLabels = [], width = 520, height = 180, label }: StackedAreaProps) {
  const keys = Object.keys(series)
  if (keys.length === 0) return null
  const n = series[keys[0]].length
  if (n < 2) return null

  const totals = Array.from({ length: n }, (_, i) => keys.reduce((a, k) => a + (series[k][i] ?? 0), 0))
  const max = Math.max(...totals, 1)
  const PL = 32, PB = 22, PT = 8
  const X = (i: number) => PL + (i / (n - 1)) * (width - PL - 8)
  const Y = (v: number) => PT + (1 - v / max) * (height - PT - PB)

  let base = new Array(n).fill(0)
  const bands = keys.map((k) => {
    const top = series[k].map((v, i) => base[i] + (v ?? 0))
    let d = `M ${X(0)} ${Y(base[0])}`
    top.forEach((v, i) => { d += ` L ${X(i)} ${Y(v)}` })
    for (let i = n - 1; i >= 0; i--) d += ` L ${X(i)} ${Y(base[i])}`
    base = top
    return { k, d: `${d} Z` }
  })

  return (
    <Frame width={width} height={height} label={label ?? 'Composition over time'}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PL} y1={Y(max * f)} x2={width - 8} y2={Y(max * f)} stroke={T.ruleSoft} />
          <Text x={PL - 6} y={Y(max * f) + 3} size={9.5} fill={T.text3} anchor="end">{Math.round(max * f)}</Text>
        </g>
      ))}
      {bands.map(({ k, d }) => <path key={k} d={d} fill={colors[k] ?? T.data} opacity={0.8} />)}
      {periodLabels.map((l, i) => l ? (
        <Text key={i} x={X(i)} y={height - 6} size={9.5} fill={T.text3} anchor="middle">{l}</Text>
      ) : null)}
    </Frame>
  )
}

/* ─────────────────────────── twin line ─────────────────────────── */

export interface TwinLineProps {
  a: number[]
  b: number[]
  labelA: string
  labelB: string
  /** Annotates the period where a first rises above b. */
  crossingNote?: string
  width?: number
  height?: number
  label?: string
}

/**
 * Two series whose CROSSING is the finding — arrival against resolution being
 * the canonical case. The crossing is marked, because a reader should not have
 * to find it.
 */
export function TwinLine({ a, b, labelA, labelB, crossingNote, width = 380, height = 130, label }: TwinLineProps) {
  const n = Math.min(a.length, b.length)
  if (n < 2) return null
  const max = Math.max(...a, ...b, 1)
  const PL = 26, PB = 20, PT = 12
  const X = (i: number) => PL + (i / (n - 1)) * (width - PL - 10)
  const Y = (v: number) => PT + (1 - v / max) * (height - PT - PB)
  const path = (arr: number[]) => arr.slice(0, n).map((v, i) => `${i ? 'L' : 'M'} ${X(i)} ${Y(v)}`).join(' ')

  let cross = -1
  for (let i = 1; i < n; i++) if (a[i - 1] <= b[i - 1] && a[i] > b[i]) { cross = i; break }

  return (
    <Frame width={width} height={height} label={label ?? `${labelA} against ${labelB}`}>
      <line x1={PL} y1={Y(0)} x2={width - 10} y2={Y(0)} stroke={T.rule} />
      {cross > 0 && (
        <g>
          <line x1={X(cross)} y1={PT} x2={X(cross)} y2={Y(0)} stroke={T.conseq} strokeWidth="1.5" strokeDasharray="3 3" />
          <Text x={X(cross) + 5} y={PT + 11} size={9.5} fill={T.conseq} weight={700}>
            {crossingNote ?? `${labelA} overtakes`}
          </Text>
        </g>
      )}
      <path d={path(b)} fill="none" stroke={T.data} strokeWidth="2" />
      <path d={path(a)} fill="none" stroke={T.conseq} strokeWidth="2.4" />
      <Text x={PL} y={height - 4} size={10} fill={T.conseq} weight={700}>{labelA}</Text>
      <Text x={PL + 100} y={height - 4} size={10} fill={T.data} weight={700}>{labelB}</Text>
    </Frame>
  )
}

/* ─────────────────────────── heatmap ─────────────────────────── */

export interface HeatmapProps {
  /** row label => one cell per column; null means never assessed. */
  rows: Record<string, (number | null)[]>
  columns: string[]
  /** row label => required level. Omit a row to leave its deficit unknown. */
  demand?: Record<string, number | null>
  scaleMax?: number
  cellWidth?: number
  rowHeight?: number
  labelWidth?: number
  label?: string
}

/**
 * Capability against organizational unit, with the deficit column that is the
 * actual point of the chart.
 *
 * Sequential single hue by design — see the colour rules at the top of this
 * file. The deficit column is the only place red appears, because a shortfall
 * against a stated requirement IS a consequence.
 */
export function Heatmap({
  rows, columns, demand = {}, scaleMax = 5, cellWidth = 78, rowHeight = 30, labelWidth = 150, label,
}: HeatmapProps) {
  const id = React.useMemo(nextId, [])
  const keys = Object.keys(rows)
  const deficitX = labelWidth + columns.length * cellWidth + 20
  const width = deficitX + 110
  const height = keys.length * rowHeight + 72

  return (
    <Frame width={width} height={height} label={label ?? 'Capability by unit'}>
      <Defs id={id} />
      <Text x={0} y={14} size={9} fill={T.text3} weight={800}>MEAN ASSESSED LEVEL · LATEST PER ASSIGNMENT</Text>
      {columns.map((c, i) => (
        <Text key={c} x={labelWidth + i * cellWidth + cellWidth / 2} y={40} size={10} fill={T.text2} weight={600} anchor="middle">{c}</Text>
      ))}
      <Text x={deficitX + 50} y={40} size={10} fill={T.conseq} weight={800} anchor="middle">DEFICIT</Text>

      {keys.map((rowKey, ri) => {
        const y = 50 + ri * rowHeight
        const cells = rows[rowKey]
        const measured = cells.filter((v): v is number => v !== null)
        const supply = measured.length ? measured.reduce((a, b) => a + b, 0) / measured.length : null
        const required = demand[rowKey] ?? null
        // Null propagates. A deficit needs BOTH a supply and a requirement;
        // treating either absence as zero invents a gap or hides one.
        const deficit = supply === null || required === null ? null : Number((supply - required).toFixed(1))

        return (
          <g key={rowKey}>
            <Text x={0} y={y + 19} size={11.5} fill={T.text} weight={600}>{rowKey}</Text>
            {cells.map((v, ci) => {
              const x = labelWidth + ci * cellWidth
              if (v === null) {
                return <rect key={ci} x={x} y={y} width={cellWidth - 3} height={rowHeight - 4}
                  fill={`url(#${id}-hatch)`} opacity={0.45} stroke={T.ruleSoft} />
              }
              const o = 0.16 + (v / scaleMax) * 0.78
              return (
                <g key={ci}>
                  <rect x={x} y={y} width={cellWidth - 3} height={rowHeight - 4} fill={T.data} opacity={o} />
                  <Text x={x + (cellWidth - 3) / 2} y={y + 19} size={11.5} weight={700} anchor="middle"
                    fill={o > 0.55 ? 'var(--surface-deep)' : T.text}>{v.toFixed(1)}</Text>
                </g>
              )
            })}
            <rect x={deficitX} y={y} width={100} height={rowHeight - 4} fill="var(--surface-inset)" />
            {deficit === null ? (
              <Text x={deficitX + 50} y={y + 19} size={10.5} fill={T.none} weight={600} anchor="middle">
                {supply === null ? 'not assessed' : 'no target'}
              </Text>
            ) : (
              <g>
                <rect x={deficitX} y={y} width={Math.min(100, (Math.abs(deficit) / 2.5) * 100)} height={rowHeight - 4}
                  fill={deficit < 0 ? T.conseq : T.good} opacity={deficit < 0 ? 0.35 : 0.3} />
                <Text x={deficitX + 50} y={y + 19} size={11.5} weight={800} anchor="middle"
                  fill={deficit < 0 ? T.conseq : T.good}>{deficit > 0 ? `+${deficit.toFixed(1)}` : deficit.toFixed(1)}</Text>
              </g>
            )}
          </g>
        )
      })}
    </Frame>
  )
}

/* ─────────────────────────── radar ─────────────────────────── */

export interface RadarDimension {
  key: string
  /** null means this dimension has never been assessed. */
  value: number | null
  required?: number | null
}

/**
 * A person or unit against a requirement, across assessment dimensions.
 *
 * A dimension that was never assessed gets a hatched wedge and the polygon does
 * NOT pass through it. Drawing it at zero would render "we never looked" as
 * "they scored nothing" — the single most damaging confusion this product can
 * make, because it is about an individual.
 */
export function Radar({ dimensions, max = 5, width = 280, height = 280, label }: {
  dimensions: RadarDimension[]; max?: number; width?: number; height?: number; label?: string
}) {
  const id = React.useMemo(nextId, [])
  const n = dimensions.length
  if (n < 3) return null
  const cx = width / 2, cy = height / 2 + 6, R = Math.min(width, height) / 2 - 45

  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + R * (v / max) * Math.cos(a), cy + R * (v / max) * Math.sin(a)]
  }

  const measured = dimensions.filter((d) => d.value !== null)
  const hasRequirement = dimensions.some((d) => d.required != null)

  return (
    <Frame width={width} height={height} label={label ?? 'Assessment against requirement'}>
      <Defs id={id} />
      {Array.from({ length: max }, (_, g) => g + 1).map((g) => (
        <path key={g} fill="none" stroke={T.ruleSoft}
          d={`${dimensions.map((_, i) => { const [x, y] = pt(i, g); return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}` }).join(' ')} Z`} />
      ))}

      {dimensions.map((d, i) => {
        if (d.value !== null) return null
        const a0 = -Math.PI / 2 + (i - 0.5) * 2 * Math.PI / n
        const a1 = a0 + (2 * Math.PI) / n
        return (
          <path key={`gap-${d.key}`} opacity={0.4} fill={`url(#${id}-hatch)`}
            d={`M ${cx} ${cy} L ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} Z`} />
        )
      })}

      {hasRequirement && (
        <path fill="none" stroke={T.conseq} strokeWidth="1.8" strokeDasharray="5 3"
          d={`${dimensions.map((d, i) => { const [x, y] = pt(i, d.required ?? 0); return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}` }).join(' ')} Z`} />
      )}

      {measured.length > 2 && (
        <path fill={T.data} fillOpacity={0.26} stroke={T.data} strokeWidth="2.2"
          d={`${dimensions.reduce((acc, d, i) => {
            if (d.value === null) return acc
            const [x, y] = pt(i, d.value)
            return `${acc}${acc ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `
          }, '')} Z`} />
      )}

      {dimensions.map((d, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
        const lx = cx + (R + 20) * Math.cos(a)
        const ly = cy + (R + 20) * Math.sin(a) + 4
        return (
          <Text key={d.key} x={lx} y={ly} size={10} weight={700} fill={d.value === null ? T.none : T.text}
            anchor={Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'}>{d.key}</Text>
        )
      })}
    </Frame>
  )
}

/* ─────────────────────────── quadrant ─────────────────────────── */

export interface QuadrantPoint { key: string; x: number; y: number; r?: number; hot?: boolean; onClick?: () => void }

/**
 * Two dimensions with the interesting corner NAMED.
 *
 * The quadrant labels are the point. A reader should not have to work out that
 * top-left means "critical and unready" — saying so is the difference between a
 * chart that informs and one that decorates.
 */
export function Quadrant({
  points, xLabel, yLabel, quadrantLabels = [], width = 440, height = 320, label,
}: {
  points: QuadrantPoint[]
  xLabel: string
  yLabel: string
  quadrantLabels?: { x: number; y: number; text: string; hot?: boolean; anchor?: 'start' | 'end' }[]
  width?: number; height?: number; label?: string
}) {
  const PL = 46, PB = 36, PT = 16, PR = 16
  const X = (v: number) => PL + v * (width - PL - PR)
  const Y = (v: number) => PT + (1 - v) * (height - PT - PB)

  return (
    <Frame width={width} height={height} label={label ?? `${yLabel} against ${xLabel}`}>
      <rect x={PL} y={PT} width={width - PL - PR} height={height - PT - PB} fill="var(--surface-inset)" opacity={0.5} />
      <rect x={PL} y={PT} width={(width - PL - PR) / 2} height={(height - PT - PB) / 2} fill={T.conseq} opacity={0.07} />
      <line x1={X(0.5)} y1={PT} x2={X(0.5)} y2={height - PB} stroke={T.rule} strokeDasharray="4 3" />
      <line x1={PL} y1={Y(0.5)} x2={width - PR} y2={Y(0.5)} stroke={T.rule} strokeDasharray="4 3" />
      {quadrantLabels.map((q, i) => (
        <Text key={i} x={X(q.x)} y={Y(q.y)} size={9.5} weight={800} anchor={q.anchor ?? 'start'}
          fill={q.hot ? T.conseq : T.text3}>{q.text}</Text>
      ))}
      {points.map((p) => (
        <g
          key={p.key}
          onClick={p.onClick}
          onKeyDown={(e) => {
            if (!p.onClick) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              p.onClick()
            }
          }}
          tabIndex={p.onClick ? 0 : undefined}
          role={p.onClick ? 'button' : undefined}
          style={p.onClick ? { cursor: 'pointer' } : undefined}
        >
          <circle cx={X(p.x)} cy={Y(p.y)} r={p.r ?? 6} fill={p.hot ? T.conseq : T.data} fillOpacity={0.6}
            stroke={p.hot ? T.conseq : T.data} />
          <Text x={X(p.x) + (p.r ?? 6) + 5} y={Y(p.y) + 3.5} size={10} fill={T.text} weight={600}>{p.key}</Text>
        </g>
      ))}
      <Text x={width / 2} y={height - 8} size={10} fill={T.text3} weight={700} anchor="middle">{xLabel}</Text>
      <text x={13} y={height / 2} fontSize={10} fill={T.text3} fontWeight={700} textAnchor="middle"
        transform={`rotate(-90 13 ${height / 2})`}>{yLabel}</text>
    </Frame>
  )
}

/* ─────────────────────────── funnel ─────────────────────────── */

/** Stage-to-stage conversion, with each step's share of the one before it. */
export function Funnel({ steps, width = 400, label }: {
  steps: { key: string; value: number }[]; width?: number; label?: string
}) {
  if (steps.length === 0) return null
  const max = steps[0].value || 1
  const barH = 34, gap = 18
  const height = steps.length * (barH + gap) + 8
  const colors = [T.data, T.dataSoft, T.conseq]

  return (
    <Frame width={width} height={height} label={label ?? 'Conversion'}>
      {steps.map((st, i) => {
        const y = i * (barH + gap) + 8
        const w = (st.value / max) * (width - 140)
        return (
          <g key={st.key}>
            <rect x={112} y={y} width={Math.max(2, w)} height={barH} rx={3} fill={colors[i % colors.length]} opacity={0.85} />
            <Text x={106} y={y + 22} size={11.5} weight={700} fill={T.text} anchor="end">{st.key}</Text>
            <Text x={120} y={y + 23} size={16} weight={800} fill="var(--surface-deep)">{st.value}</Text>
            {i > 0 && steps[i - 1].value > 0 && (
              <Text x={112 + Math.max(2, w) + 10} y={y + 22} size={10.5} fill={T.text3} weight={600}>
                {Math.round((st.value / steps[i - 1].value) * 100)}% of previous
              </Text>
            )}
          </g>
        )
      })}
    </Frame>
  )
}

/* ─────────────────────────── decay curve ─────────────────────────── */

/**
 * Evidence plotted on the freshness curve the system actually reasons with.
 *
 * The curve is drawn from the same half-life the backend applies, so the
 * picture cannot drift from the arithmetic. Items sliding into the tail become
 * visible as a cluster, which is the finding.
 */
export function DecayCurve({ items, halfLifeDays = 90, maxAgeDays = 420, width = 480, height = 210, label }: {
  items: { ageDays: number; confidence: number }[]
  halfLifeDays?: number; maxAgeDays?: number; width?: number; height?: number; label?: string
}) {
  const PL = 40, PB = 28, PT = 12
  const X = (a: number) => PL + Math.min(a / maxAgeDays, 1) * (width - PL - 82)
  const Y = (f: number) => PT + (1 - f) * (height - PT - PB)
  const bands: [number, number, string, string][] = [
    [0.9, 1, 'Fresh', T.good], [0.7, 0.9, 'Recent', T.data],
    [0.4, 0.7, 'Aging', T.move], [0, 0.4, 'Stale', T.conseq],
  ]

  let d = ''
  for (let a = 0; a <= maxAgeDays; a += 6) {
    d += `${a ? 'L' : 'M'} ${X(a).toFixed(1)} ${Y(Math.pow(0.5, a / halfLifeDays)).toFixed(1)} `
  }

  return (
    <Frame width={width} height={height} label={label ?? 'Evidence freshness'}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={PL} y1={Y(f)} x2={width - 82} y2={Y(f)} stroke={T.ruleSoft} />
          <Text x={PL - 6} y={Y(f) + 3.5} size={9} fill={T.text3} anchor="end">{f.toFixed(2)}</Text>
        </g>
      ))}
      {bands.map(([lo, hi, name, c]) => (
        <g key={name}>
          <rect x={width - 76} y={Y(hi)} width={68} height={Y(lo) - Y(hi)} fill={c} opacity={0.09} />
          <Text x={width - 71} y={Y(hi) + 13} size={9.5} fill={c} weight={800}>{name}</Text>
        </g>
      ))}
      <path d={d} fill="none" stroke={T.text2} strokeWidth="2" />
      {items.map((it, i) => {
        const f = Math.pow(0.5, it.ageDays / halfLifeDays)
        const effective = it.confidence * f
        return <circle key={i} cx={X(it.ageDays)} cy={Y(f)} r={3 + it.confidence * 3}
          fill={effective < 0.3 ? T.conseq : T.data} fillOpacity={0.55}
          stroke={effective < 0.3 ? T.conseq : T.data} />
      })}
      <Text x={width / 2 - 40} y={height - 6} size={9.5} fill={T.text3} weight={600} anchor="middle">
        evidence age → half-life {halfLifeDays} days
      </Text>
    </Frame>
  )
}

/* ─────────────────────────── benchmark band ─────────────────────────── */

/**
 * Position against a peer cohort.
 *
 * Renders nothing but an explanation when the cohort is too small. A
 * percentile computed from four peers is noise wearing the costume of a
 * statistic, and it would be believed.
 */
export function BenchmarkBand({ percentile, caption, peerCount, minimumPeers = 20, width = 440, label }: {
  percentile: number | null; caption: string; peerCount: number; minimumPeers?: number; width?: number; label?: string
}) {
  const height = 78
  if (percentile === null || peerCount < minimumPeers) {
    return (
      <Frame width={width} height={height} label={label ?? caption}>
        <Text x={0} y={12} size={9} fill={T.text3} weight={800}>{caption}</Text>
        <rect x={0} y={24} width={width} height={20} rx={3} fill="url(#none)" stroke={T.ruleSoft} />
        <Text x={0} y={58} size={11} fill={T.none}>
          {peerCount === 0
            ? 'No peer cohort available.'
            : `Suppressed — ${peerCount} peers, ${minimumPeers} needed.`}
        </Text>
      </Frame>
    )
  }

  const x = width * (percentile / 100)
  return (
    <Frame width={width} height={height} label={label ?? caption}>
      <Text x={0} y={12} size={9} fill={T.text3} weight={800}>{caption}</Text>
      <rect x={0} y={24} width={width} height={20} rx={3} fill={T.ruleSoft} />
      <rect x={width * 0.25} y={24} width={width * 0.5} height={20} fill={T.rule} />
      <line x1={width * 0.5} y1={20} x2={width * 0.5} y2={48} stroke={T.text2} strokeWidth="1.6" />
      <Text x={width * 0.5} y={17} size={9} fill={T.text2} anchor="middle">median</Text>
      <line x1={x} y1={18} x2={x} y2={52} stroke={T.conseq} strokeWidth="2.5" />
      <circle cx={x} cy={34} r={5.5} fill={T.conseq} />
      <Text x={x} y={68} size={10.5} fill={T.conseq} weight={800} anchor={x > width * 0.75 ? 'end' : 'start'}>
        you · {Math.round(percentile)}th pct of {peerCount}
      </Text>
      <Text x={0} y={58} size={9} fill={T.text3}>best</Text>
      <Text x={width} y={58} size={9} fill={T.text3} anchor="end">worst</Text>
    </Frame>
  )
}

/* ─────────────────────────── icicle ─────────────────────────── */

export interface IcicleUnit {
  name: string
  headcount: number
  /** null means no assessment has ever been recorded for this unit. */
  coverage: number | null
  hasLead: boolean
}

/**
 * The organization by headcount and capability coverage, in one row.
 *
 * Width is size, fill is coverage, a dashed outline is missing leadership, and
 * a hatch is a unit nobody has assessed at all. Where an organization is thick
 * and where it is hollow becomes one glance; a nested table never does that.
 */
export function Icicle({ units, orgName, width = 760, height = 200, label }: {
  units: IcicleUnit[]; orgName: string; width?: number; height?: number; label?: string
}) {
  const id = React.useMemo(nextId, [])
  const total = units.reduce((a, u) => a + u.headcount, 0)
  if (total === 0) return null
  let x = 0

  return (
    <Frame width={width} height={height} label={label ?? `${orgName} by size and coverage`}>
      <Defs id={id} />
      <rect x={0} y={8} width={width} height={30} fill={T.data} opacity={0.18} />
      <Text x={10} y={28} size={12} weight={700} fill={T.text}>{orgName} · {total} people</Text>
      {units.map((u) => {
        const w = (u.headcount / total) * width
        if (w < 1) return null
        const left = x
        x += w
        const cov = u.coverage
        return (
          <g key={u.name}>
            <rect x={left} y={46} width={Math.max(1, w - 1.5)} height={height - 70}
              fill={cov === null ? T.none : T.data} opacity={cov === null ? 0.12 : 0.12 + cov * 0.72} />
            {(cov === null || cov < 0.15) && (
              <rect x={left} y={46} width={Math.max(1, w - 1.5)} height={height - 70} fill={`url(#${id}-hatch)`} opacity={0.32} />
            )}
            {!u.hasLead && (
              <rect x={left + 1} y={47} width={Math.max(1, w - 3.5)} height={height - 72}
                fill="none" stroke={T.conseq} strokeWidth="2" strokeDasharray="4 3" />
            )}
            {w > 56 && (
              <g>
                <Text x={left + 6} y={64} size={10.5} weight={700} fill={T.text}>{u.name}</Text>
                <Text x={left + 6} y={79} size={9.5} fill={T.text2}>{u.headcount} people</Text>
                <Text x={left + 6} y={94} size={9.5} fill={cov === null ? T.none : T.text2}>
                  {cov === null ? 'never assessed' : `${Math.round(cov * 100)}% covered`}
                </Text>
                {!u.hasLead && <Text x={left + 6} y={110} size={9} weight={800} fill={T.conseq}>NO LEAD</Text>}
              </g>
            )}
          </g>
        )
      })}
    </Frame>
  )
}

/* ─────────────────────────── legend ─────────────────────────── */

/**
 * The legend that explains the hatch.
 *
 * Any screen showing a chart that can contain nulls must render this. An
 * unexplained hatch is worse than no hatch: the reader invents a meaning, and
 * the meaning they usually invent is zero.
 */
export function NullLegend({ what = 'never measured' }: { what?: string }) {
  return (
    <div className="bc-legend">
      <span className="bc-legend__item">
        <span className="bc-legend__hatch" aria-hidden="true" />
        {what} — <strong>not counted as a gap</strong>
      </span>
      <span className="bc-legend__item">
        <span className="bc-legend__swatch bc-legend__swatch--data" aria-hidden="true" />
        measured, low to high
      </span>
      <span className="bc-legend__item">
        <span className="bc-legend__swatch bc-legend__swatch--conseq" aria-hidden="true" />
        below requirement
      </span>
    </div>
  )
}

/* ─────────────────────────── risk matrix ─────────────────────────── */

export interface RiskCell {
  /** 1-5 bands. Risks with either axis unmeasured are not placed at all. */
  likelihood: number
  impact: number
  count: number
  maxSeverity: number | null
  risks: { id: string; title: string; severity: number | null }[]
}

/**
 * Likelihood against impact, on the 5x5 grid a risk register is read on.
 *
 * WHY THIS IS NOT `Heatmap`. Heatmap answers "how good is each capability in each
 * unit" — a value per cell, one sequential hue, plus a deficit column. This answers
 * "how many risks sit at each combination of likelihood and impact", where the
 * cell's POSITION carries the meaning and its contents are a population. Forcing one
 * component to do both would mean a scaleMax that means two different things.
 *
 * THE BACKGROUND IS THE JUDGEMENT; THE BUBBLES ARE THE DATA. Cell tint comes from
 * likelihood x impact — the standard register shading, and the one place red is used
 * here — so a reader sees which corner is dangerous before reading a single bubble.
 * Bubble AREA scales with the number of risks in the cell, not its radius: scaling
 * the radius would make three risks look nine times worse than one.
 *
 * EMPTY IS NOT THE SAME AS UNPLACEABLE, and both are shown. A grid with nothing in
 * the top-right is good news. A grid missing four risks because their likelihood was
 * never measured is not — so `unplaceable` renders as a note rather than being
 * silently dropped. A matrix that omits rows without saying so is worse than one
 * with a visible gap.
 */
export function RiskMatrix({
  cells, unplaceable = 0, hotLabel = 'likely and consequential',
  width = 420, cell = 62, label,
}: {
  cells: RiskCell[]
  unplaceable?: number
  hotLabel?: string
  width?: number
  cell?: number
  label?: string
}) {
  const id = React.useMemo(nextId, [])
  const PL = 34, PB = 30, PT = 18

  const grid = cell * 5
  const height = PT + grid + PB
  const totalWidth = Math.max(width, PL + grid + 12)

  const byKey = new Map<string, RiskCell>()
  for (const c of cells) byKey.set(`${c.likelihood}:${c.impact}`, c)

  const maxCount = cells.reduce((m, c) => Math.max(m, c.count), 0)
  const bands = [1, 2, 3, 4, 5]

  return (
    <>
      <Frame width={totalWidth} height={height} label={label ?? 'Risk likelihood against impact'}>
        <Defs id={id} />

        {bands.map((impact) =>
          bands.map((likelihood) => {
            const x = PL + (likelihood - 1) * cell
            // Impact rises up the axis, so band 5 is the top row.
            const y = PT + (5 - impact) * cell
            const heat = (likelihood * impact) / 25

            return (
              <rect
                key={`c${likelihood}:${impact}`}
                x={x} y={y} width={cell - 2} height={cell - 2}
                fill={heat >= 0.48 ? T.conseq : T.data}
                opacity={heat >= 0.48 ? 0.05 + heat * 0.16 : 0.04 + heat * 0.08}
                stroke={T.ruleSoft}
              />
            )
          }),
        )}

        {bands.map((impact) =>
          bands.map((likelihood) => {
            const found = byKey.get(`${likelihood}:${impact}`)
            if (!found || found.count === 0) return null

            const x = PL + (likelihood - 1) * cell + (cell - 2) / 2
            const y = PT + (5 - impact) * cell + (cell - 2) / 2
            const r = 9 + Math.sqrt(found.count / Math.max(1, maxCount)) * 12
            const hot = likelihood * impact >= 12

            return (
              <g key={`b${likelihood}:${impact}`}>
                <title>
                  {`${found.count} risk${found.count === 1 ? '' : 's'} · likelihood ${likelihood}/5 · impact ${impact}/5`}
                  {found.maxSeverity == null ? '' : ` · worst severity ${found.maxSeverity.toFixed(2)}`}
                  {`\n${found.risks.map((risk) => `• ${risk.title}`).join('\n')}`}
                </title>
                <circle
                  cx={x} cy={y} r={r}
                  fill={hot ? T.conseq : T.data} fillOpacity={0.55}
                  stroke={hot ? T.conseq : T.data} strokeWidth={1.5}
                />
                <Text x={x} y={y + 4} size={12} weight={800} anchor="middle" fill="var(--surface-deep)">
                  {found.count}
                </Text>
              </g>
            )
          }),
        )}

        {bands.map((likelihood) => (
          <Text key={`lx${likelihood}`} x={PL + (likelihood - 1) * cell + (cell - 2) / 2} y={PT + grid + 15}
            size={10} fill={T.text3} weight={700} anchor="middle" mono>
            {likelihood}
          </Text>
        ))}
        {bands.map((impact) => (
          <Text key={`iy${impact}`} x={PL - 10} y={PT + (5 - impact) * cell + (cell - 2) / 2 + 4}
            size={10} fill={T.text3} weight={700} anchor="end" mono>
            {impact}
          </Text>
        ))}

        <Text x={PL + grid} y={12} size={9} weight={800} anchor="end" fill={T.conseq}>
          {hotLabel.toUpperCase()}
        </Text>
        <Text x={PL + grid / 2} y={height - 6} size={10} fill={T.text3} weight={700} anchor="middle">
          LIKELIHOOD →
        </Text>
        <text x={11} y={PT + grid / 2} fontSize={10} fill={T.text3} fontWeight={700} textAnchor="middle"
          transform={`rotate(-90 11 ${PT + grid / 2})`}>
          IMPACT →
        </text>
      </Frame>

      {unplaceable > 0 && (
        <p className="bc-note bc-note--warn">
          {unplaceable} risk{unplaceable === 1 ? ' is' : 's are'} not plotted: either likelihood or impact
          could not be measured for {unplaceable === 1 ? 'it' : 'them'}. They stay in the register below rather
          than being placed at the origin.
        </p>
      )}
    </>
  )
}

/* ─────────────────────────── scored findings ─────────────────────────── */

/**
 * A ranked list of scored findings, where the score is bounded 0-max.
 *
 * Exists because `HBars` normalises to the largest value in the set, which is right
 * for counts and wrong for a bounded score: it would draw a worst-in-set severity of
 * 0.9 as a full-width bar. Here the axis IS the scale, so a register whose worst
 * finding is mild looks mild. A null score is hatched rather than drawn at zero.
 */
export function ScoreBars({
  rows, max = 5, width = 460, rowHeight = 26, labelWidth = 210, label, hotFrom = 3.5,
}: {
  rows: { key: string; value: number | null }[]
  max?: number
  width?: number
  rowHeight?: number
  labelWidth?: number
  label?: string
  /** At or above this, the bar is drawn as a consequence rather than a measurement. */
  hotFrom?: number
}) {
  const id = React.useMemo(nextId, [])
  const barMax = width - labelWidth - 46
  const height = rows.length * rowHeight + 26

  if (rows.length === 0) return null

  return (
    <Frame width={width} height={height} label={label ?? 'Findings by severity'}>
      <Defs id={id} />
      <Text x={0} y={11} size={9} fill={T.text3} weight={800}>{`SEVERITY · 0 TO ${max}`}</Text>

      {rows.map((row, i) => {
        const y = 20 + i * rowHeight
        const hot = row.value !== null && row.value >= hotFrom

        return (
          <g key={row.key}>
            <title>{row.key}</title>
            <Text x={0} y={y + 15} size={11.5} fill={T.text} weight={600}>
              {row.key.length > 34 ? `${row.key.slice(0, 33)}…` : row.key}
            </Text>

            {row.value === null ? (
              <>
                <rect x={labelWidth} y={y + 4} width={barMax} height={rowHeight - 12}
                  fill={`url(#${id}-hatch)`} opacity={0.45} stroke={T.ruleSoft} />
                <Text x={labelWidth + barMax + 6} y={y + 15} size={10} fill={T.none} weight={600}>
                  not scored
                </Text>
              </>
            ) : (
              <>
                <rect x={labelWidth} y={y + 4} width={barMax} height={rowHeight - 12}
                  fill="var(--surface-inset)" />
                <rect x={labelWidth} y={y + 4} width={Math.max(2, (row.value / max) * barMax)} height={rowHeight - 12}
                  fill={hot ? T.conseq : T.data} opacity={hot ? 0.75 : 0.62} />
                <Text x={labelWidth + barMax + 6} y={y + 15} size={11} weight={800} mono
                  fill={hot ? T.conseq : T.text}>
                  {row.value.toFixed(2)}
                </Text>
              </>
            )}
          </g>
        )
      })}
    </Frame>
  )
}
