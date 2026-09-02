import type { PersonIntelligence } from '../../../api/personIntelligence';
import { shortDate } from '../../intelligence/parts';

/* ==========================================================================
 *  RECORDS TAB — THE ANOMALY BANNER
 *
 *  It sits ABOVE the table because it is a statement about the table: some of
 *  the rows below contradict each other. Framed as a data-quality finding with
 *  its cause named (R5) — two imported datasets disagree about the same day,
 *  and that is a fact about the import, not about the person.
 * ========================================================================== */

export function MismatchBanner({
  mismatches,
  filtered,
  onToggle,
}: {
  mismatches: PersonIntelligence['consistency']['mismatches'];
  filtered: boolean;
  onToggle: () => void;
}) {
  if (mismatches.count === 0) return null;

  return (
    <div className="pi-banner" role="status">
      <div>
        <b>
          {mismatches.count} day{mismatches.count === 1 ? '' : 's'} where check-in and attendance disagree
        </b>
        <p>
          On these dates one dataset records this person as present and another records them as absent
          {mismatches.windowDays > 0 && <>, across {mismatches.windowDays.toLocaleString()} days of records</>}. The
          likely cause is {mismatches.likelyCause} — not a discrepancy in the person’s own reporting.
          {mismatches.sampleDates.length > 0 && (
            <> Affected dates include {mismatches.sampleDates.map((d) => shortDate(d) ?? d).join(', ')}.</>
          )}
        </p>
      </div>
      <button type="button" className="pi-unlock" onClick={onToggle}>
        {filtered ? 'Show all records' : 'Show only mismatch days'} →
      </button>
    </div>
  );
}
