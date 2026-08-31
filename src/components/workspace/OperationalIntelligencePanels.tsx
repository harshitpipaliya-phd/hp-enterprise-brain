import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash,
  Gauge,
  HelpCircle,
  Minus,
  TrendingUp,
} from 'lucide-react';
import type {
  Concentration,
  Distribution,
  Insight,
  LifecycleStage,
  Momentum,
  Scorecard,
  TrendPoint,
} from '../../api/operations';
import { NOT_MEASURABLE, monthLabel, pct, scoreTone } from '../../api/operations';
import './OperationalIntelligence.css';

/**
 * The panels that render derived operational intelligence, shared by every
 * screen that shows any of it.
 *
 * ONE COMPONENT PER QUESTION, REUSED — not one per screen. The Organization
 * overview, the Departments list and the Analytics screen all answer "how
 * concentrated is this" and all three used to draw their own version, which is
 * how the same organization ends up described three slightly different ways in
 * one product. These render the API's shape directly; there is no per-screen
 * massaging of the numbers, and nothing here computes anything.
 *
 * THE UNMEASURABLE PATH IS THE DEFAULT PATH, NOT AN EDGE CASE. Every component
 * below takes `supported` and `reason` and renders the reason when support is
 * false. None of them can render a zero for a missing measurement, because none
 * of them is given a number in that case — the type is `null` and the branch is
 * required. That is deliberate: "Capabilities 0" was the single most misleading
 * thing on the old screens, and the fix has to be structural rather than
 * remembered.
 *
 * NOTHING HERE IS SPECIFIC TO AN INDUSTRY OR A TENANT. Every label rendered is
 * either a fixed English word for a universal concept ("Completed", "Backlog")
 * or a string the organization's own data supplied. There is no branch on tenant
 * id, industry, dataset name or department name anywhere in this file.
 */

/* ─────────────────────────────── scorecard ─────────────────────────────── */

export function ScorecardPanel({
  scorecard,
  title = 'Organization intelligence',
}: {
  scorecard: Scorecard;
  title?: string;
}) {
  return (
    <section className="opsi-panel opsi-scorecard" aria-label={title}>
      <div className="opsi-head">
        <div>
          <span className="opsi-kicker">Derived from this organization&apos;s own records</span>
          <h2>{title}</h2>
        </div>
        <div className="opsi-scorecard__overall" data-health={scoreTone(scorecard.overall)}>
          <strong>{scorecard.overall === null ? '—' : `${scorecard.overall}%`}</strong>
          <em>{scorecard.band ?? NOT_MEASURABLE}</em>
        </div>
      </div>

      <p className="opsi-note">
        {scorecard.measuredDimensions} of {scorecard.measuredDimensions + scorecard.unmeasuredDimensions} dimensions
        are measurable from what this organization has connected. Unmeasurable dimensions are excluded from the score
        rather than counted as zero.
      </p>

      <ul className="opsi-dimensions">
        {scorecard.dimensions.map((dimension) => (
          <li key={dimension.key} className="opsi-dimension" data-health={scoreTone(dimension.score)}>
            <div className="opsi-dimension__row">
              <span className="opsi-dimension__label">{dimension.label}</span>
              <span className="opsi-dimension__score">{dimension.score}%</span>
            </div>
            <div className="opsi-bar" role="img" aria-label={`${dimension.label} ${dimension.score} percent`}>
              <span style={{ width: `${Math.max(2, Math.min(100, dimension.score ?? 0))}%` }} />
            </div>
            <p className="opsi-dimension__statement">{dimension.statement}</p>
            {dimension.formula && <p className="opsi-dimension__formula">{dimension.formula}</p>}
          </li>
        ))}
      </ul>

      {scorecard.unmeasured.length > 0 && (
        <div className="opsi-unmeasured">
          <h3><HelpCircle size={15} aria-hidden="true" /> Not yet measurable</h3>
          <ul>
            {scorecard.unmeasured.map((dimension) => (
              <li key={dimension.key}>
                <strong>{dimension.label}</strong>
                <span className="opsi-unmeasured__status">{NOT_MEASURABLE}</span>
                <p>{dimension.reason}</p>
                {dimension.nextStep && (
                  <p className="opsi-unmeasured__next"><ArrowRight size={13} aria-hidden="true" /> {dimension.nextStep}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="opsi-verdict">
        <VerdictColumn
          title="Strengths"
          icon={<CheckCircle2 size={15} />}
          tone="good"
          empty="No dimension is scoring above 80 yet."
          rows={scorecard.strengths.map((s) => ({ head: `${s.dimension} · ${s.score}%`, body: s.statement }))}
        />
        <VerdictColumn
          title="Risks"
          icon={<AlertTriangle size={15} />}
          tone="crit"
          empty="No measured dimension is below 70."
          rows={scorecard.risks.map((r) => ({ head: `${r.dimension} · ${r.score}%`, body: r.statement }))}
        />
        <VerdictColumn
          title="Opportunities"
          icon={<TrendingUp size={15} />}
          tone="state"
          empty="Every dimension in the model is already measurable."
          rows={scorecard.opportunities.map((o) => ({ head: o.dimension, body: `${o.reason} ${o.unlocks}` }))}
        />
      </div>

      {scorecard.recommendedFocus && (
        <p className="opsi-focus">
          <strong>Recommended focus:</strong> {scorecard.recommendedFocus.dimension}
          {scorecard.recommendedFocus.score !== null ? ` (${scorecard.recommendedFocus.score}%)` : ''} —{' '}
          {scorecard.recommendedFocus.why}
        </p>
      )}
    </section>
  );
}

function VerdictColumn({
  title,
  icon,
  tone,
  rows,
  empty,
}: {
  title: string;
  icon: ReactNode;
  tone: 'good' | 'crit' | 'state';
  rows: Array<{ head: string; body: string }>;
  empty: string;
}) {
  return (
    <div className="opsi-verdict__col" data-health={tone}>
      <h3>{icon} {title}</h3>
      {rows.length === 0 ? (
        <p className="opsi-empty">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.head}>
              <strong>{row.head}</strong>
              <span>{row.body}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ──────────────────────────────── insights ──────────────────────────────── */

export function InsightsPanel({
  insights,
  limit = 8,
  title = 'What the data is telling us',
}: {
  insights: Insight[];
  limit?: number;
  title?: string;
}) {
  if (insights.length === 0) {
    return (
      <section className="opsi-panel" aria-label={title}>
        <div className="opsi-head"><h2>{title}</h2></div>
        <p className="opsi-empty">
          Nothing in the connected data crosses a threshold worth reporting. Findings appear as soon as a measured
          pattern does.
        </p>
      </section>
    );
  }

  return (
    <section className="opsi-panel opsi-insights" aria-label={title}>
      <div className="opsi-head">
        <div>
          <span className="opsi-kicker">Composed from measured values — no language model</span>
          <h2>{title}</h2>
        </div>
      </div>
      <ul className="opsi-insights__list">
        {insights.slice(0, limit).map((insight) => (
          <li key={insight.key} className="opsi-insight" data-health={severityTone(insight.severity)}>
            <div className="opsi-insight__head">
              <span className="opsi-insight__dot" aria-hidden="true" />
              <strong>{insight.title}</strong>
              <em>{insight.severity}</em>
            </div>
            <dl className="opsi-insight__body">
              <Fact label="What happened" value={insight.whatHappened} />
              <Fact label="Why it matters" value={insight.whyItMatters} />
              <Fact label="What is at risk" value={insight.whatIsAtRisk} />
              <Fact label="What to investigate" value={insight.investigate} />
              <Fact label="What could improve" value={insight.improve} />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function severityTone(severity: string): 'good' | 'warn' | 'crit' | 'state' {
  if (severity === 'high') return 'crit';
  if (severity === 'medium') return 'warn';
  return 'state';
}

/* ─────────────────────────────── lifecycle ─────────────────────────────── */

/**
 * The intelligence loop, with the reason each empty stage is empty.
 *
 * A stage with no rows renders its explanation instead of a zero. See
 * IntelligenceLoopMetrics on the server for why "0" was the wrong thing to draw.
 */
export function LifecyclePanel({
  stages,
  onOpen,
}: {
  stages: LifecycleStage[];
  onOpen?: (stageKey: string) => void;
}) {
  return (
    <section className="opsi-panel opsi-lifecycle" aria-label="Intelligence lifecycle">
      <div className="opsi-head">
        <div>
          <span className="opsi-kicker">Intelligence loop</span>
          <h2>Where this organization&apos;s reasoning has reached</h2>
        </div>
      </div>
      <ol className="opsi-lifecycle__track">
        {stages.map((stage) => (
          <li key={stage.key} className="opsi-lifecycle__stage" data-state={stage.state}>
            <button
              type="button"
              onClick={onOpen ? () => onOpen(stage.key) : undefined}
              disabled={!onOpen}
              title={stage.message}
            >
              <span className="opsi-lifecycle__label">{stage.label}</span>
              <strong className="opsi-lifecycle__value">
                {stage.count > 0 ? stage.count.toLocaleString() : stateWord(stage.state)}
              </strong>
              <span className="opsi-lifecycle__message">{stage.message}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function stateWord(state: LifecycleStage['state']): string {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'waiting':
      return 'Waiting';
    default:
      return '—';
  }
}

/* ───────────────────────────── measure tiles ───────────────────────────── */

export function MeasureTile({
  icon,
  label,
  value,
  detail,
  supported,
  reason,
  tone = 'state',
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  detail?: string;
  supported: boolean;
  reason?: string | null;
  tone?: 'good' | 'warn' | 'crit' | 'state';
}) {
  return (
    <div className="opsi-tile" data-health={supported ? tone : 'muted'}>
      <span className="opsi-tile__icon">{icon ?? <Gauge size={16} />}</span>
      <span className="opsi-tile__label">{label}</span>
      {supported ? (
        <>
          <strong className="opsi-tile__value">{value}</strong>
          {detail && <span className="opsi-tile__detail">{detail}</span>}
        </>
      ) : (
        <>
          <strong className="opsi-tile__value opsi-tile__value--muted">{NOT_MEASURABLE}</strong>
          <span className="opsi-tile__detail">{reason}</span>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── distributions ─────────────────────────── */

export function DistributionPanel({
  title,
  rows,
  concentration,
  empty,
  note,
}: {
  title: string;
  rows: Distribution[];
  concentration?: Concentration | null;
  empty: string;
  note?: string;
}) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.records), 0);

  return (
    <section className="opsi-panel opsi-distribution" aria-label={title}>
      <div className="opsi-head"><h3>{title}</h3></div>
      {rows.length === 0 ? (
        <p className="opsi-empty">{empty}</p>
      ) : (
        <ul className="opsi-distribution__rows">
          {rows.map((row) => (
            <li key={row.name}>
              <span className="opsi-distribution__name" title={row.name}>{row.name}</span>
              <span className="opsi-bar opsi-bar--slim">
                <span style={{ width: `${max > 0 ? Math.max(2, (row.records / max) * 100) : 2}%` }} />
              </span>
              <span className="opsi-distribution__value">{row.records.toLocaleString()}</span>
              <span className="opsi-distribution__share">{pct(row.share, 1)}</span>
            </li>
          ))}
        </ul>
      )}
      {concentration?.supported && (
        <p className="opsi-note">
          {concentration.members} members · {concentration.band} · top holds {pct(concentration.topShare, 1)}
        </p>
      )}
      {note && <p className="opsi-note">{note}</p>}
    </section>
  );
}

/* ──────────────────────────────── trend ──────────────────────────────── */

/**
 * A volume series as inline SVG.
 *
 * NO CHART LIBRARY, deliberately: this is one polyline over at most eighteen
 * points, and the axis labels are the periods the server already grouped by.
 * Every point is a value the API returned — nothing is interpolated, smoothed
 * or extended past the last month with data.
 */
export function TrendChart({
  points,
  momentum,
  title,
  height = 120,
}: {
  points: TrendPoint[];
  momentum?: Momentum;
  title: string;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <section className="opsi-panel" aria-label={title}>
        <div className="opsi-head"><h3>{title}</h3></div>
        <p className="opsi-empty">At least two months of dated records are needed to plot a trend.</p>
      </section>
    );
  }

  const width = 640;
  const pad = 8;
  const max = points.reduce((acc, p) => Math.max(acc, p.records), 0) || 1;
  const step = (width - pad * 2) / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = pad + index * step;
    const y = height - pad - (point.records / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const area = `${pad},${height - pad} ${coords.join(' ')} ${(pad + (points.length - 1) * step).toFixed(1)},${height - pad}`;

  return (
    <section className="opsi-panel opsi-trend" aria-label={title}>
      <div className="opsi-head">
        <h3>{title}</h3>
        {momentum?.supported && momentum.direction && (
          <span className="opsi-trend__momentum" data-direction={momentum.direction}>
            {momentum.direction === 'rising' ? <ArrowUpRight size={14} /> : momentum.direction === 'falling' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
            {momentum.change !== null ? `${(momentum.change * 100).toFixed(1)}%` : ''} quarter on quarter
          </span>
        )}
      </div>
      <svg className="opsi-trend__svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
        aria-label={`${title}: ${points.length} months, peak ${max.toLocaleString()} records`}>
        <polygon className="opsi-trend__area" points={area} />
        <polyline className="opsi-trend__line" points={coords.join(' ')} />
      </svg>
      <div className="opsi-trend__axis">
        <span>{monthLabel(points[0].period)}</span>
        <span>peak {max.toLocaleString()}</span>
        <span>{monthLabel(points[points.length - 1].period)}</span>
      </div>
      {momentum && !momentum.supported && momentum.reason && <p className="opsi-note">{momentum.reason}</p>}
    </section>
  );
}

/* ──────────────────────────── unmeasured block ──────────────────────────── */

/**
 * The panel a screen renders INSTEAD of a zero, when the thing it exists to
 * show is not derivable from what the organization connected.
 */
export function NotMeasurable({
  title,
  reason,
  nextStep,
}: {
  title: string;
  reason: string;
  nextStep?: string | null;
}) {
  return (
    <section className="opsi-panel opsi-notmeasurable" aria-label={title}>
      <div className="opsi-head"><h3><CircleSlash size={15} aria-hidden="true" /> {title}</h3></div>
      <p className="opsi-notmeasurable__status">{NOT_MEASURABLE}</p>
      <p className="opsi-notmeasurable__reason">{reason}</p>
      {nextStep && (
        <p className="opsi-notmeasurable__next"><ArrowRight size={14} aria-hidden="true" /> {nextStep}</p>
      )}
    </section>
  );
}

/* ───────────────────────────── activity strip ───────────────────────────── */

export function ExecutionStrip({
  completed,
  inProgress,
  open,
  cancelled,
}: {
  completed: number;
  inProgress: number;
  open: number;
  cancelled: number;
}) {
  const total = completed + inProgress + open + cancelled;

  if (total === 0) return null;

  const segments = [
    { key: 'completed', label: 'Completed', value: completed, tone: 'good' },
    { key: 'progress', label: 'In progress', value: inProgress, tone: 'state' },
    { key: 'open', label: 'Open', value: open, tone: 'warn' },
    { key: 'cancelled', label: 'Cancelled', value: cancelled, tone: 'crit' },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="opsi-strip">
      <div className="opsi-strip__bar" role="img" aria-label="Workflow state distribution">
        {segments.map((segment) => (
          <span
            key={segment.key}
            data-health={segment.tone}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${segment.value.toLocaleString()}`}
          />
        ))}
      </div>
      <ul className="opsi-strip__legend">
        {segments.map((segment) => (
          <li key={segment.key} data-health={segment.tone}>
            <span className="opsi-strip__swatch" aria-hidden="true" />
            {segment.label} <strong>{segment.value.toLocaleString()}</strong>
            <em>{((segment.value / total) * 100).toFixed(1)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { Activity };
