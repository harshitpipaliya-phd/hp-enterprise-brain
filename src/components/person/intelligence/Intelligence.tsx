import type { PersonIntelligence } from '../../../api/personIntelligence';
import { isUndetermined } from '../../../api/personIntelligence';
import { Bar, Fold, NotMeasurable, Panel, Pill, shortDate } from '../../intelligence/parts';
import { CompareRow, Undetermined, UnlockAction } from './shared';
import type { OverviewActions } from './Overview';

/* ==========================================================================
 *  INTELLIGENCE TAB
 * ========================================================================== */

const KASBA_ROWS = [
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'ability', label: 'Ability' },
  { key: 'skill', label: 'Skill' },
  { key: 'behaviour', label: 'Behaviour' },
  { key: 'attitude', label: 'Attitude' },
] as const;

export function CapabilityProfile({
  data,
  actions,
}: {
  data: PersonIntelligence;
  actions: OverviewActions;
}) {
  const { capability } = data;

  if (capability.score === null) {
    return (
      <Panel title="Capability profile">
        <NotMeasurable
          what="Capability"
          reason={capability.unlock ?? 'No KASBA assessment has been recorded for this person.'}
          fixLabel={actions.onScheduleAssessment ? 'Schedule an assessment' : undefined}
          onFix={actions.onScheduleAssessment}
        />
      </Panel>
    );
  }

  const teamAvg = capability.vsTeam?.teamAvg ?? null;
  const delta = teamAvg === null ? null : Number((capability.score - teamAvg).toFixed(2));

  return (
    <Panel
      title={capability.name ?? 'Capability profile'}
      sub={capability.assessedAt ? `assessed ${shortDate(capability.assessedAt)}` : null}
      action={
        <Pill tone={capability.score >= 3.5 ? 'good' : capability.score >= 2.5 ? 'warn' : 'crit'}>
          {capability.score} / {capability.of}
        </Pill>
      }
    >
      <div className="pi-kasba">
        {KASBA_ROWS.map(({ key, label }) => {
          const value = capability.kasba[key];

          if (value === null) {
            return (
              <div className="pi-kasba__row pi-kasba__row--none" key={key}>
                <span className="pi-kasba__lab">{label}</span>
                <span className="pi-kasba__why">not assessed on this dimension</span>
              </div>
            );
          }

          /*
            A LOW ATTITUDE SCORE IS THE ONE THAT CHANGES THE CONVERSATION, so
            it is toned as critical at or below 1 rather than blending into
            the other four. It still reads as a number with a label — the tone
            draws the eye, it does not carry the meaning on its own.
          */
          const tone = key === 'attitude' && value <= 1 ? 'crit' : value >= 3.5 ? 'good' : value >= 2.5 ? 'warn' : 'crit';

          return (
            <div className="pi-kasba__row" key={key}>
              <span className="pi-kasba__lab">{label}</span>
              <Bar pct={(value / capability.of) * 100} tone={tone} label={`${label}: ${value} of ${capability.of}`} />
              <span className="pi-kasba__v">{value}</span>
            </div>
          );
        })}
      </div>

      <CompareRow label="Capability" reference="vs team average">
        {teamAvg === null ? (
          <Undetermined what="Nobody else has been assessed on this capability yet." />
        ) : (
          <>
            <span className="pi-cmp__v">{capability.score}</span>
            <Pill tone={delta !== null && delta >= 0 ? 'good' : 'warn'}>
              {delta !== null && delta >= 0 ? '+' : ''}
              {delta} vs team {teamAvg}
            </Pill>
          </>
        )}
      </CompareRow>

      <CompareRow label="Capability" reference="vs role requirement">
        {isUndetermined(capability.vsRole) ? (
          <Undetermined
            what="No job role is assigned, so there is no requirement to compare against."
            action={<UnlockAction label="Assign role" onClick={actions.onAssignRole} />}
          />
        ) : (
          <span className="pi-cmp__v">
            {capability.vsRole.value} against required {capability.vsRole.required}
          </span>
        )}
      </CompareRow>

      <CompareRow label="Trajectory" reference="vs own last assessment">
        {isUndetermined(capability.trajectory) ? (
          <Undetermined
            what="Only one assessment is on file."
            action={<UnlockAction label="Re-assess" onClick={actions.onScheduleAssessment} />}
          />
        ) : (
          <Pill tone={capability.trajectory === 'declining' ? 'warn' : capability.trajectory === 'improving' ? 'good' : 'neutral'}>
            {capability.trajectory}
          </Pill>
        )}
      </CompareRow>
    </Panel>
  );
}

/**
 * PATTERNS.
 *
 * Sentences, not tiles — each says what was observed, from which dataset, and
 * how it should be read. The long-hours line is supportive by construction
 * (R5): a run of long weeks is a workload finding about the team's demand on
 * this person, not a verdict on the person.
 */
export function Patterns({ data }: { data: PersonIntelligence }) {
  const { presence, contribution } = data;

  const rows: Array<{ text: string; source: string; tone: 'good' | 'warn' | 'neutral'; pill: string }> = [];

  if (presence.attendancePct !== null) {
    rows.push({
      text:
        presence.absencePattern === 'recurring_weekday' && presence.recurringDay
          ? `Present on ${presence.attendancePct}% of recorded days, with absences repeatedly falling on ${presence.recurringDay}.`
          : presence.absencePattern === 'clustered'
            ? `Present on ${presence.attendancePct}% of recorded days, with absences arriving in blocks rather than singly.`
            : `Present on ${presence.attendancePct}% of recorded days, with no repeating absence pattern.`,
      source: 'attendance dataset · trailing 60 days',
      tone: presence.absencePattern === 'none' ? 'good' : 'warn',
      pill: presence.absencePattern === 'none' ? 'reliable' : 'watch',
    });
  }

  if (presence.avgHours !== null) {
    rows.push({
      text: presence.longHoursFlag
        ? `Averaging ${presence.avgHours}h per recorded day, above the configured threshold for ${presence.longHoursWeeks} consecutive weeks — worth a workload check.`
        : `Averaging ${presence.avgHours}h per recorded day, within the configured range.`,
      source: 'attendance dataset · hours amount column',
      tone: presence.longHoursFlag ? 'warn' : 'good',
      pill: presence.longHoursFlag ? 'watch' : 'reliable',
    });
  }

  if (contribution.handledTotal > 0) {
    const weeks = contribution.weeklyTrend.filter((w) => w > 0).length;
    rows.push({
      text: `${contribution.handledTotal.toLocaleString()} records handled in total, ${contribution.handled30d.toLocaleString()} of them in the last 30 days, across ${weeks} of the last 8 weeks${
        contribution.supervisedCount > 0 ? `; supervising a further ${contribution.supervisedCount}` : ''
      }.`,
      source: 'operational records · matched by attachment rule',
      tone: 'neutral',
      pill: 'consistent',
    });
  }

  return (
    <Panel title="Patterns">
      {rows.length === 0 ? (
        <NotMeasurable
          what="Patterns"
          reason="Neither attendance nor handled volume is on file for this person, so there is nothing to describe a pattern from."
        />
      ) : (
        rows.map((r, i) => (
          <div className="pi-pattern" key={i}>
            <p>{r.text}</p>
            <div className="pi-pattern__f">
              <Pill tone={r.tone}>{r.pill}</Pill>
              <span className="pi-src">{r.source}</span>
            </div>
          </div>
        ))
      )}
    </Panel>
  );
}

/**
 * ANOMALIES.
 *
 * A mismatch is two datasets disagreeing about the same day. It is reported as
 * a data-quality issue carrying its own likely cause, because that is what the
 * evidence supports — the records say the import or the device is wrong, and
 * they say nothing at all about the person.
 */
export function Anomalies({
  data,
  onOpenMismatches,
}: {
  data: PersonIntelligence;
  onOpenMismatches?: () => void;
}) {
  const { mismatches, cleared } = data.consistency;

  return (
    <Panel
      title="Anomalies"
      footer={
        mismatches.count > 0 && onOpenMismatches ? (
          <button type="button" className="pi-unlock" onClick={onOpenMismatches}>
            Open mismatch days in Records →
          </button>
        ) : null
      }
    >
      {mismatches.count === 0 ? (
        <p className="pi-clean">
          No cross-source contradictions found. Where two datasets both record this person&rsquo;s presence on a
          day, they agree.
        </p>
      ) : (
        <div className="pi-anom">
          <div className="pi-anom__head">
            <b>
              {mismatches.count} day{mismatches.count === 1 ? '' : 's'} where check-in and attendance disagree
            </b>
            <Pill tone="warn">review</Pill>
          </div>
          {mismatches.sampleDates.length > 0 && (
            <p className="pi-anom__dates">{mismatches.sampleDates.map((d) => shortDate(d) ?? d).join(' · ')}</p>
          )}
          <p className="pi-anom__cause">Likely cause: {mismatches.likelyCause}.</p>
        </div>
      )}

      {cleared.map((c) => (
        <div className="pi-cleared" key={c.rule}>
          <Pill tone="good">clear</Pill>
          <div>
            <b>{c.rule}</b>
            <span>{c.detail}</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

const LOOP_COPY: Array<{ key: keyof PersonIntelligence['loop']; label: string; copy: string }> = [
  { key: 'signals', label: 'Signals', copy: 'patterns the system raised that name this person' },
  { key: 'cases', label: 'Cases', copy: 'investigations opened from those signals' },
  { key: 'decisions', label: 'Decisions', copy: 'decisions this person is recorded as taking' },
  { key: 'executions', label: 'Executions', copy: 'actions carried out under their name' },
];

/**
 * ONE STRIP, NOT FOUR EMPTY CARDS.
 *
 * These counts are legitimately zero for most people — the loop only names
 * someone once a pattern reaches them — so four full-size cards each announcing
 * a nothing took a quarter of the tab to say the same word four times.
 */
export function LoopStrip({ loop }: { loop: PersonIntelligence['loop'] }) {
  return (
    <Panel title="Intelligence-loop involvement">
      <div className="pi-loop">
        {LOOP_COPY.map(({ key, label, copy }) => (
          <div className="pi-loop__cell" key={key}>
            <span className="pi-loop__n">{loop[key].toLocaleString()}</span>
            <b>{label}</b>
            <span className="pi-loop__c">{copy}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** How the standing was arrived at, reproducing the server's own arithmetic. */
export function ScoreExplainFold({ data }: { data: PersonIntelligence }) {
  const { scoreExplain, standing, confidence } = data;

  return (
    <Fold title="How this standing is calculated, simply" open>
      {scoreExplain.components.length === 0 ? (
        <p className="pi-foot">
          Nothing this person is measured on is on file yet, so there is no arithmetic to show. The band is{' '}
          <b>UNDETERMINED</b> rather than a low score — see “What we can’t see yet”.
        </p>
      ) : (
        <div className="pi-table-wrap">
          <table className="pi-table">
            <thead>
              <tr>
                <th>Component</th>
                <th className="pi-num">Value</th>
                <th className="pi-num">Weight</th>
                <th className="pi-num">Points</th>
              </tr>
            </thead>
            <tbody>
              {scoreExplain.components.map((c) => (
                <tr key={c.label}>
                  <td>
                    {c.label}
                    <span className="pi-src">{c.basis}</span>
                  </td>
                  <td className="pi-num">{c.valuePct}%</td>
                  <td className="pi-num">×{c.weight}</td>
                  <td className="pi-num">{c.points}</td>
                </tr>
              ))}
              {scoreExplain.penalty && (
                <tr className="pi-table__pen">
                  <td>
                    {scoreExplain.penalty.label}
                    <span className="pi-src">
                      a capped deduction per contradicting day — a data-quality signal, not a judgement
                    </span>
                  </td>
                  <td className="pi-num" />
                  <td className="pi-num" />
                  <td className="pi-num">−{scoreExplain.penalty.points}</td>
                </tr>
              )}
              <tr className="pi-table__total">
                <td>Standing</td>
                <td className="pi-num" />
                <td className="pi-num" />
                <td className="pi-num">{scoreExplain.total ?? 'UNDETERMINED'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="pi-foot">
        {scoreExplain.note} Standing and data confidence are separate numbers: standing is the verdict from what
        could be measured, confidence is how much of the model was measurable at all —{' '}
        {confidence.measurableDimensions} of {confidence.totalDimensions} dimensions here. Missing data lowers
        confidence and never lowers standing. {standing.reason}
      </p>
    </Fold>
  );
}

export function BlindSpotsFold({
  spots,
  onFix,
}: {
  spots: PersonIntelligence['blindSpots'];
  onFix?: (route: string) => void;
}) {
  return (
    <Fold title="What we can’t see yet" badge={`${spots.length} dimension${spots.length === 1 ? '' : 's'}`}>
      {spots.length === 0 ? (
        <p className="pi-foot">Every dimension in the model could be measured for this person.</p>
      ) : (
        spots.map((s) => (
          <div className="pi-blind" key={s.dimension}>
            <div>
              <b>{s.dimension}</b>
              <span>{s.reason}</span>
            </div>
            {onFix && (
              <button type="button" className="pi-unlock" onClick={() => onFix(s.fixRoute)}>
                {s.fixLabel} →
              </button>
            )}
          </div>
        ))
      )}
      <p className="pi-foot">
        None of these is scored as zero. They are excluded from the standing entirely and counted against data
        confidence instead.
      </p>
    </Fold>
  );
}
