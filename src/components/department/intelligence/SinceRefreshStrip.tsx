import type { SinceRefresh } from '../../../api/departmentIntelligence';

/**
 * WHAT MOVED.
 *
 * This strip exists because intelligence is about CHANGE. "563 open items" is a
 * fact; "563, up 41 in a week" is the thing somebody acts on, and the second
 * needs two measurements.
 *
 * WHICH IS WHY IT IS ALLOWED TO BE EMPTY. Movement is read from recorded
 * history — the scheduled snapshot — and until that has run twice there is
 * exactly one measurement. The strip then says so, in the reader's language,
 * rather than showing a row of zeros. "Unchanged" and "never compared" are
 * different claims and only one of them is reassuring.
 */
export function SinceRefreshStrip({ sinceRefresh }: { sinceRefresh: SinceRefresh }) {
  if (!sinceRefresh.supported || sinceRefresh.changes.length === 0) {
    return (
      <div className="dv-delta">
        <div className="dv-delta__cell">
          <span className="dv-dot" data-dir="flat" aria-hidden="true" />
          <div>
            <b>No comparison yet</b>
            <br />
            <span>{sinceRefresh.reason ?? 'Nothing earlier has been recorded to compare against.'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dv-delta" aria-label="Changes since the last recorded refresh">
      {sinceRefresh.changes.map((change) => (
        <div className="dv-delta__cell" key={change.label}>
          <span className="dv-dot" data-dir={change.direction} aria-hidden="true" />
          <div>
            <b>{change.label}</b>
            <br />
            <span>{change.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
