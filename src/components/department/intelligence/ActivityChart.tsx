import { NotMeasurable, Panel, shortDate } from '../../intelligence/parts';
import type { Activity } from '../../../api/departmentIntelligence';

/**
 * WORK ARRIVING AGAINST WORK FINISHING, WEEK BY WEEK.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * INLINE SVG, NO CHART LIBRARY
 *
 * Two polylines and an axis do not justify a dependency, and the repo has no
 * charting package this would reuse — ui/charts.tsx is hand-drawn SVG for the
 * same reason. Adding one for eight points per series would be paid for on every
 * page load of the whole application.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE WINDOW ENDS WHERE THE DATA ENDS
 *
 * The weeks are counted back from the last week the records cover, not from
 * today. An import that stopped three weeks ago must not draw three empty weeks
 * and present them as a collapse in demand — so the last week's date is printed
 * on the axis and named in the caption.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ACCESSIBILITY
 *
 * The <svg> carries a full-sentence aria-label with the actual figures, and the
 * projection note below states the same finding in words. A reader who cannot
 * see the lines loses none of the meaning.
 */
export function ActivityChart({ activity, onFix }: { activity: Activity; onFix?: () => void }) {
  if (!activity.supported || activity.weeks.length === 0) {
    return (
      <Panel title="Activity over time">
        <NotMeasurable
          what="Activity over time"
          reason={activity.reason ?? 'No dated record is attributed to this unit.'}
          fixLabel="Open in Ingestion"
          onFix={onFix}
        />
      </Panel>
    );
  }

  const weeks = activity.weeks;

  /*
    TWO CHARTS, ONE COMPONENT — because there are two attribution bases and they
    do not carry the same facts.

    Work attributed through the people who handled it has both timestamps, so
    arriving and finishing are two lines a week apart. Work attributed by the
    name the export states carries a monthly volume and no closure date, so
    there is ONE line. `resolved` is null on those points rather than 0: a zero
    line along the bottom would read as "this unit finished nothing", which is
    not what the absence of a column means.
  */
  const hasResolved = weeks.some((w) => w.resolved !== null);
  const period = activity.granularity === 'month' ? 'months' : 'weeks';

  // Geometry. A viewBox rather than pixels, so the chart scales with the panel
  // and the stroke widths stay honest at every size.
  const W = 1000;
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 40;

  const peak = Math.max(
    1,
    ...weeks.flatMap((w) => (w.resolved === null ? [w.received] : [w.received, w.resolved])),
  );
  // Round the top of the scale up to something readable rather than to the data.
  const step = peak > 400 ? 100 : peak > 150 ? 50 : peak > 40 ? 20 : 10;
  const top = Math.ceil(peak / step) * step;

  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, weeks.length - 1);
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);

  const line = (pick: (w: (typeof weeks)[number]) => number | null) =>
    weeks
      .map((w, i) => [i, pick(w)] as const)
      .filter((pair): pair is readonly [number, number] => pair[1] !== null)
      .map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');

  const gridValues = [0, top / 2, top];

  const totalReceived = activity.received ?? weeks.reduce((sum, w) => sum + w.received, 0);
  const totalResolved = hasResolved
    ? activity.resolved ?? weeks.reduce((sum, w) => sum + (w.resolved ?? 0), 0)
    : null;
  const first = weeks[0];
  const last = weeks[weeks.length - 1];

  // The full sentence, with the real figures, so a reader who cannot see the
  // lines loses none of the meaning.
  const description =
    `Over ${weeks.length} ${period} from ${first.weekStart} to ${last.weekStart}, ` +
    (totalResolved === null
      ? `${totalReceived.toLocaleString()} items were recorded against this unit. Work finishing is not recorded on this attribution, so only arriving work is drawn.`
      : `${totalReceived.toLocaleString()} items were received and ${totalResolved.toLocaleString()} resolved. ` +
        (activity.projection?.note ?? 'Arrival and completion are level over the window.'));

  return (
    <Panel
      title="Activity over time"
      sub={`${activity.source ?? 'Attributed work'} · ${weeks.length} ${period} to ${shortDate(last.weekStart)}`}
    >
      <div className="dv-legend">
        <span>
          <i style={{ background: 'var(--status-crit)' }} />
          {hasResolved ? 'Received' : 'Recorded'}
        </span>
        {hasResolved && (
          <span>
            <i style={{ background: 'var(--accent-intelligence)' }} />
            Resolved
          </span>
        )}
      </div>

      <div className="dv-chart">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={description}>
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={padL}
                y1={y(value)}
                x2={W - padR}
                y2={y(value)}
                stroke="var(--border-subtle)"
                strokeWidth={1}
              />
              <text
                x={padL - 8}
                y={y(value) + 4}
                fontSize={11}
                fill="var(--content-tertiary)"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          ))}

          <polyline
            fill="none"
            stroke="var(--status-crit)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={line((w) => w.received)}
          />
          {hasResolved && (
            <polyline
              fill="none"
              stroke="var(--accent-intelligence)"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={line((w) => w.resolved)}
            />
          )}

          {/* First, middle and last only: eight dates along this axis overlap at
              every width the panel actually gets. */}
          {[0, Math.floor((weeks.length - 1) / 2), weeks.length - 1].map((i) => (
            <text
              key={weeks[i].weekStart}
              x={x(i)}
              y={H - 12}
              fontSize={11}
              fill="var(--content-tertiary)"
              textAnchor={i === 0 ? 'start' : i === weeks.length - 1 ? 'end' : 'middle'}
            >
              {shortDate(weeks[i].weekStart)}
            </text>
          ))}
        </svg>
      </div>

      {/* The note the server sent, then the projection, then the fallback — in
          that order, because only the first two are claims about THIS unit. */}
      {activity.note ? (
        <p className="dv-projection">{activity.note}</p>
      ) : activity.projection ? (
        <p className="dv-projection">{activity.projection.note}</p>
      ) : (
        <p className="dv-projection">
          Work is arriving and closing at about the same rate over this window, so the backlog is
          neither growing nor shrinking on trend.
        </p>
      )}

      {activity.sourceFiles && activity.sourceFiles.length > 0 && (
        <p className="dv-src">Source: {activity.sourceFiles.join(', ')}</p>
      )}
    </Panel>
  );
}
