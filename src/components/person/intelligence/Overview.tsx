import type { PersonIntelligence } from '../../../api/personIntelligence';
import { isUndetermined } from '../../../api/personIntelligence';
import { DualBar, NotMeasurable, Panel, Pill } from '../../intelligence/parts';
import { CompareRow, MetricCard, Undetermined, UnlockAction } from './shared';

/* ==========================================================================
 *  OVERVIEW
 *
 *  Reads the payload and lays it out. Nothing here computes a figure, derives
 *  a band, or decides what is measurable — those are one definition each, and
 *  they live in PersonIntelligenceService.
 * ========================================================================== */

export interface OverviewActions {
  onAssignRole?: () => void;
  onScheduleAssessment?: () => void;
  onCreatePlan?: (route: string) => void;
}

/**
 * WHAT MOVED SINCE THE LAST REFRESH.
 *
 * On the first measured refresh there is no earlier snapshot, and that is a
 * different statement from "nothing moved" — so the strip says which of the
 * two it is rather than rendering four cells of zero.
 */
export function SinceRefreshStrip({ data }: { data: PersonIntelligence['sinceRefresh'] }) {
  if (!data.supported) {
    return (
      <p className="pi-since__none">
        No earlier refresh to compare against — {data.reason ?? 'this is the first measured refresh'}.
      </p>
    );
  }

  return (
    <div className="pi-since" role="list">
      {data.changes.map((c, i) => (
        <div className="pi-since__cell" role="listitem" key={`${c.label}-${i}`}>
          <span className="pi-since__dot" data-direction={c.direction} aria-hidden="true" />
          <div>
            <b>{c.label}</b>
            <span>{c.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricCards({ data }: { data: PersonIntelligence }) {
  const { contribution, presence, capability } = data;
  const hoursThresholdNote = presence.longHoursFlag
    ? `${presence.longHoursWeeks} week${presence.longHoursWeeks === 1 ? '' : 's'} above the configured threshold — worth a workload check`
    : null;

  const capDelta =
    capability.vsTeam && capability.vsTeam.teamAvg !== null
      ? Number((capability.vsTeam.value - capability.vsTeam.teamAvg).toFixed(2))
      : null;

  return (
    <div className="pi-cards">
      {/*
        VOLUME IS SHOWN AS FACT (R5). The number is true and belongs on screen.
        What it does NOT do while no role is assigned is rank this person: it
        reaches the standing only as week-to-week consistency, which is stated
        in the panel below rather than left for the reader to assume.
      */}
      <MetricCard
        label="Contribution"
        value={contribution.handledTotal.toLocaleString()}
        sub={
          <>
            +{contribution.handled30d.toLocaleString()} in last 30d
            {contribution.teamSharePct !== null && ` · ${contribution.teamSharePct}% of team`}
          </>
        }
        flag={contribution.highLoad ? <Pill tone="warn">high load</Pill> : null}
        spark={contribution.weeklyTrend}
        sparkTone={contribution.highLoad ? 'warn' : 'neutral'}
        sparkLabel="Records handled per week, last 8 weeks"
        source="operational records · matched by attachment rule"
      />

      <MetricCard
        label="Attendance"
        value={presence.attendancePct === null ? <span className="pi-card__none">not measured</span> : `${presence.attendancePct}%`}
        sub={
          presence.attendancePct === null
            ? 'No attendance records in the last 60 days.'
            : `${presence.streakDays} day present streak${
                presence.absencePattern === 'recurring_weekday' && presence.recurringDay
                  ? ` · absences cluster on ${presence.recurringDay}`
                  : presence.absencePattern === 'clustered'
                    ? ' · absences arrive in blocks'
                    : ''
              }`
        }
        spark={presence.attendancePct === null ? undefined : presence.weeklyHours}
        sparkLabel="Weekly attendance hours, last 8 weeks"
        source="attendance dataset · trailing 60 days"
      />

      <MetricCard
        label="Avg working hours"
        value={presence.avgHours === null ? <span className="pi-card__none">not measured</span> : `${presence.avgHours}h`}
        sub={
          hoursThresholdNote ? (
            <span className="pi-warn-line">
              <span className="pi-dot" data-tone="warn" aria-hidden="true" />
              {hoursThresholdNote}
            </span>
          ) : presence.avgHours === null ? (
            'The attendance dataset carries no hours amount for this person.'
          ) : (
            'Within the configured range.'
          )
        }
        spark={presence.avgHours === null ? undefined : presence.weeklyHours}
        sparkTone={presence.longHoursFlag ? 'warn' : 'neutral'}
        sparkLabel="Average hours per week, last 8 weeks"
        source="attendance dataset · hours amount column"
      />

      <MetricCard
        label="Capability"
        value={
          capability.score === null ? (
            <span className="pi-card__none">not assessed</span>
          ) : (
            <>
              {capability.score}
              <small>/{capability.of}</small>
            </>
          )
        }
        sub={
          capability.score === null ? (
            capability.unlock ?? 'No assessment on file.'
          ) : capDelta === null ? (
            capability.name
          ) : (
            <>
              {capDelta >= 0 ? '▲' : '▼'} {Math.abs(capDelta)} vs team average · {capability.name}
            </>
          )
        }
        /* One assessment is a point, not a direction — the sparkline draws it
           flat rather than inventing a slope between a value and nothing. */
        spark={
          capability.score === null
            ? undefined
            : [capability.score, capability.score]
        }
        sparkLabel={`Capability ${capability.score ?? 'not assessed'} of ${capability.of}`}
        source="capability assessment · KASBA proficiency"
      />
    </div>
  );
}

/**
 * WHERE THIS PERSON STANDS.
 *
 * Three comparisons, each naming its own reference (R5). Two of them are
 * UNDETERMINED for the reference person and stay on the page saying so, with
 * the action that would make them answerable — a comparison that is quietly
 * dropped tells the reader it was never worth asking.
 */
export function WhereTheyStand({
  data,
  actions,
}: {
  data: PersonIntelligence;
  actions: OverviewActions;
}) {
  const { capability, person, contribution } = data;
  const vsTeam = capability.vsTeam;
  const teamAvg = vsTeam?.teamAvg ?? null;
  const ahead = vsTeam !== null && teamAvg !== null && vsTeam.value > teamAvg;

  return (
    <Panel title="Where this person stands">
      {vsTeam === null ? (
        <NotMeasurable
          what="Comparison to the team"
          reason="No capability assessment is on file, so there is nothing to compare against the team average."
          fixLabel={actions.onScheduleAssessment ? 'Schedule an assessment' : undefined}
          onFix={actions.onScheduleAssessment}
        />
      ) : (
        <CompareRow label="Capability" reference="vs team average">
          <DualBar
            value={vsTeam.value}
            reference={teamAvg}
            max={capability.of}
            tone={ahead ? 'good' : 'warn'}
            label={`${capability.name ?? 'Capability'} for ${person.name}`}
            referenceLabel={teamAvg === null ? 'no team average' : `team ${teamAvg}`}
          />
          <span className="pi-cmp__v">
            {vsTeam.value}
            <small>/{capability.of}</small>
          </span>
        </CompareRow>
      )}

      <CompareRow label="Capability" reference="vs role requirement">
        {isUndetermined(capability.vsRole) ? (
          <Undetermined
            what={
              person.roleAssigned
                ? 'No capability requirement is recorded for this role.'
                : 'No job role is assigned, so there is no requirement to compare against.'
            }
            action={<UnlockAction label="Assign role" onClick={actions.onAssignRole} />}
          />
        ) : (
          <>
            <DualBar
              value={capability.vsRole.value ?? 0}
              reference={capability.vsRole.required}
              max={capability.of}
              tone={(capability.vsRole.value ?? 0) >= capability.vsRole.required ? 'good' : 'warn'}
              label="Capability against role requirement"
              referenceLabel={`required ${capability.vsRole.required}`}
            />
            <span className="pi-cmp__v">
              {capability.vsRole.value}
              <small>/{capability.of}</small>
            </span>
          </>
        )}
      </CompareRow>

      <CompareRow label="Trajectory" reference="vs own last assessment">
        {isUndetermined(capability.trajectory) ? (
          <Undetermined
            what="Only one assessment is on file — a single point has no direction."
            action={<UnlockAction label="Schedule re-assessment" onClick={actions.onScheduleAssessment} />}
          />
        ) : (
          <Pill tone={capability.trajectory === 'declining' ? 'warn' : capability.trajectory === 'improving' ? 'good' : 'neutral'}>
            {capability.trajectory}
          </Pill>
        )}
      </CompareRow>

      <p className="pi-foot">
        {ahead && capability.name
          ? `Above the team average on ${capability.name}.`
          : 'Nothing here is above its reference yet — the measured dimensions sit at or below their comparison point.'}{' '}
        {contribution.handledTotal.toLocaleString()} handled records are shown as fact, not judged: while no
        role is assigned, volume reaches the standing only as week-to-week consistency, never as a ranking.
      </p>
    </Panel>
  );
}

export function RecommendationPanel({
  data,
  actions,
}: {
  data: PersonIntelligence;
  actions: OverviewActions;
}) {
  const { recommendation } = data;
  const route = recommendation.createPlanRoute;

  return (
    <section className="pi-rec">
      <h3>{recommendation.title}</h3>
      <p>{recommendation.body}</p>
      <p className="pi-rec__meta">
        confidence {Math.round(recommendation.confidence * 100)}% · root cause {recommendation.rootCause}
        {recommendation.meta ? ` · ${recommendation.meta}` : ''}
      </p>
      {/*
        NO DEAD BUTTON. When the server has no plan route for this
        recommendation there is nothing for a "Create plan" click to do, and a
        button that does nothing is worse than no button — so it is not
        rendered rather than rendered disabled with an explanation nobody can
        act on.
      */}
      {route && actions.onCreatePlan && (
        <button type="button" className="u-btn u-btn-primary" onClick={() => actions.onCreatePlan?.(route)}>
          Create plan
        </button>
      )}
    </section>
  );
}
