import type { PersonIntelligence } from '../../../api/personIntelligence';
import { Dial, Pill } from '../../intelligence/parts';
import { bandLabel, bandTone } from './shared';

/* ==========================================================================
 *  THE HERO'S VERDICT BLOCK
 *
 *  TWO NUMBERS, SIDE BY SIDE, NEVER BLENDED (R3). On the left the standing —
 *  a verdict built only from what could be measured. On the right the data
 *  confidence — how much of the model was measurable at all. A reader who saw
 *  one figure could not tell a person doing well from a person nobody can see,
 *  which is the single most important distinction this screen makes.
 * ========================================================================== */

export function StandingChips({ person }: { person: PersonIntelligence['person'] }) {
  return (
    <div className="pi-chips">
      <span className="pi-chip" data-assigned={person.roleAssigned ? 'yes' : 'no'}>
        {person.role ?? 'Role not assigned'}
      </span>
      {person.departmentCode && <span className="pi-chip">{person.departmentCode}</span>}
      <span className="pi-chip">{person.recordCount.toLocaleString()} records</span>
    </div>
  );
}

export function StandingVerdict({ standing }: { standing: PersonIntelligence['standing'] }) {
  const tone = bandTone(standing.band);

  return (
    <div className="pi-verdict">
      <div className="pi-verdict__row">
        <Pill tone={tone}>
          <span className="pi-verdict__dot" data-tone={tone} aria-hidden="true" />
          {bandLabel(standing.band)}
        </Pill>
        <span className="pi-verdict__score">
          {standing.score === null ? (
            <b className="pi-verdict__undet">UNDETERMINED</b>
          ) : (
            <>
              {standing.score}
              <small>/100</small>
            </>
          )}
        </span>
        {standing.deltaSinceRefresh !== null && (
          <span className="pi-verdict__delta">
            {standing.deltaSinceRefresh >= 0 ? '+' : ''}
            {standing.deltaSinceRefresh} since last refresh
          </span>
        )}
      </div>
      <p className="pi-verdict__reason">{standing.reason}</p>
    </div>
  );
}

export function ConfidenceRing({ confidence }: { confidence: PersonIntelligence['confidence'] }) {
  const pct = confidence.pct;

  return (
    <div className="pi-conf">
      <Dial
        value={pct}
        size={68}
        stroke={7}
        label={`Data confidence: ${
          pct === null ? 'not computable' : `${pct}%`
        } — ${confidence.measurableDimensions} of ${confidence.totalDimensions} dimensions measurable`}
      >
        <b>{pct === null ? '—' : `${Math.round(pct)}%`}</b>
      </Dial>
      <div className="pi-conf__t">
        <b>data confidence</b>
        <span>
          {confidence.measurableDimensions} of {confidence.totalDimensions} dimensions measurable
        </span>
      </div>
    </div>
  );
}
