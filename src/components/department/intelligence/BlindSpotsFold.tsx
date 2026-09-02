import { ChevronDown } from 'lucide-react';
import { Button } from '../../../ui';
import type { BlindSpot } from '../../../api/departmentIntelligence';

/**
 * WHAT WE CANNOT SEE YET.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE MOST IMPORTANT SECTION ON THE PAGE
 *
 * Every dimension the model could not measure is listed here with the reason in
 * plain language and a button into the screen that fixes it. The header states
 * the rule the whole score depends on — NONE OF THESE WAS SCORED AS ZERO —
 * because that is the one thing a reader cannot verify by looking at the number
 * above, and it is the difference between "this unit is failing" and "we cannot
 * see this unit".
 *
 * THE SENTENCES ARE THE SAME ONES THE PANELS SHOW. They come from the same
 * server field, so this list and the panel it refers to can never tell the
 * reader different things about the same gap.
 *
 * COLLAPSED BY DEFAULT, because it is a list of absences and the verdict is what
 * the reader came for — but the count is on the summary, so it cannot be missed.
 */
export function BlindSpotsFold({
  blindSpots,
  onFix,
}: {
  blindSpots: BlindSpot[];
  onFix: (route: string) => void;
}) {
  if (blindSpots.length === 0) {
    return null;
  }

  return (
    <details className="dv-fold">
      <summary>
        <h3>What we can't see yet</h3>
        <span className="dv-fold__count">
          {blindSpots.length} {blindSpots.length === 1 ? 'gap' : 'gaps'}
        </span>
        <span className="dv-panel__sub">each has a fix — none was scored as zero</span>
        <span className="dv-fold__chev" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </summary>

      <div className="dv-fold__body">
        {blindSpots.map((spot) => (
          <div className="dv-blind" key={spot.key}>
            <b>
              {spot.dimension}
              {spot.weight !== null && (
                <span className="dv-src"> · worth {spot.weight} of the model</span>
              )}
            </b>
            <span className="dv-blind__fix">{spot.reason}</span>
            <Button variant="ghost" size="sm" onClick={() => onFix(spot.fixRoute)}>
              {spot.fixLabel} →
            </Button>
          </div>
        ))}
      </div>
    </details>
  );
}
