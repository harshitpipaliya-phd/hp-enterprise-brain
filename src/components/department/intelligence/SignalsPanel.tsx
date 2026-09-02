import { NotMeasurable, Panel, shortDate } from '../../intelligence/parts';
import type { Signal } from '../../../api/departmentIntelligence';

/**
 * WHAT HAS BEEN RAISED AGAINST THIS UNIT.
 *
 * Resolved signals stay on the list, dimmed. A unit that closed four problems
 * and has one open is in a different position from a unit that has only ever had
 * one, and hiding the closed ones makes them look identical.
 *
 * SEEDED SIGNALS ARE LABELLED, not hidden. A demo row is a rehearsal, not an
 * observation of this organization, and the difference has to survive onto the
 * screen or somebody eventually opens an investigation into a fixture.
 */
export function SignalsPanel({
  signals,
  onOpenSignals,
}: {
  signals: Signal[];
  onOpenSignals?: () => void;
}) {
  if (signals.length === 0) {
    return (
      <Panel title="Signals against this unit">
        <NotMeasurable
          what="Signal history"
          reason="No signal names this unit. Signal detection runs across the organization, so this is a finding about the unit rather than a gap — but nothing here can be read as a trend until one is raised."
          fixLabel="Open Signals"
          onFix={onOpenSignals}
        />
      </Panel>
    );
  }

  const open = signals.filter((s) => s.open).length;

  return (
    <Panel
      title="Signals against this unit"
      sub={`${open} open of ${signals.length}`}
      footer={
        signals.some((s) => s.seeded)
          ? 'Rows marked “seeded” were written by a demo seeder rather than observed in this organization.'
          : null
      }
    >
      <div>
        {signals.map((signal) => (
          <div className={`dv-signal${signal.open ? '' : ' dv-signal--closed'}`} key={signal.id}>
            <span
              className="dv-sev"
              data-sev={signal.open ? signal.severity : 'closed'}
              aria-hidden="true"
            />
            <div>
              <span className="dv-signal__t">{signal.title}</span>
              {signal.detail && <> — {signal.detail}</>}
              <div className="dv-signal__m">
                {/* The status is spelled out, so severity is never carried by the
                    dot's colour alone. */}
                {signal.open ? `${signal.severity} severity · open` : `resolved`}
                {signal.raisedAt && ` · raised ${shortDate(signal.raisedAt)}`}
                {signal.evidenceCount > 0 &&
                  ` · ${signal.evidenceCount} evidence ${signal.evidenceCount === 1 ? 'record' : 'records'}`}
                {signal.seeded && ' · seeded demo record'}
              </div>
              {signal.recommendedAction && (
                <div className="dv-signal__m">Suggested: {signal.recommendedAction}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
