import { MeasureRow, Panel } from '../../intelligence/parts';
import type { Contribution } from '../../../api/departmentIntelligence';

/**
 * WHAT THIS UNIT IS WORTH TO THE ORGANIZATION.
 *
 * A share only means something beside the share it should be: 11% of the
 * workforce doing 19% of the work is a finding, and either figure alone is
 * trivia. Where the second half cannot be computed — because the organization
 * does not attribute all of its work the same way — the row says so instead of
 * printing the first half and letting the reader draw the comparison anyway.
 *
 * RANKS ARE OVER THE UNITS THIS READER CAN SEE, which the server states and this
 * prints: "#7 of 12" has to refer to a list they can get back to.
 */
export function ContributionPanel({ contribution }: { contribution: Contribution }) {
  const { rank, rankOf, organizationAverage, difference } = contribution;

  return (
    <Panel title="Contribution to the organization" footer={contribution.note}>
      <div>
        <MeasureRow
          label="Share of the workforce"
          value={contribution.workforceSharePct}
          format="rate"
          hint="of everyone recorded in this organization"
        />

        <MeasureRow
          label="Share of attributed work"
          value={contribution.recordSharePct}
          format="rate"
          hint={
            contribution.recordShareReason ??
            (contribution.workforceSharePct !== null && contribution.recordSharePct !== null
              ? contribution.recordSharePct > contribution.workforceSharePct
                ? 'above its headcount share'
                : 'below its headcount share'
              : 'of all work this organization attributes to a unit')
          }
        />

        {rank === null || rankOf === null ? (
          <div className="dv-row dv-row--none">
            <span className="dv-row__lab">Rank among units</span>
            <span className="dv-why">
              No other unit in this organization can be scored, so there is nothing to rank against.
            </span>
          </div>
        ) : (
          <div className="dv-row">
            <span className="dv-row__lab">Rank among units</span>
            <span className="dv-row__val">
              <span className="dv-fig">
                #{rank} of {rankOf}
              </span>
            </span>
          </div>
        )}

        {organizationAverage === null ? (
          <div className="dv-row dv-row--none">
            <span className="dv-row__lab">Health against the organization</span>
            <span className="dv-why">
              No department in this organization can be scored yet, so there is no average to
              compare against.
            </span>
          </div>
        ) : (
          <div className="dv-row">
            <span className="dv-row__lab">Health against the organization</span>
            <span className="dv-row__val">
              <span className="dv-fig">
                {difference === null
                  ? `${organizationAverage} average`
                  : `${difference >= 0 ? '+' : ''}${difference} vs ${organizationAverage}`}
              </span>
            </span>
          </div>
        )}

        <MeasureRow
          label="Size among units"
          value={contribution.sizeRank}
          format="count"
          hint={contribution.sizeOf ? `of ${contribution.sizeOf} units with a recorded headcount` : ''}
        />
      </div>
    </Panel>
  );
}
