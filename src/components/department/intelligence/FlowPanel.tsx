import { NotMeasurable, Panel } from '../../intelligence/parts';
import type { CrossUnitFlow } from '../../../api/departmentIntelligence';

/**
 * WORK MOVING BETWEEN THIS UNIT AND OTHERS.
 *
 * THIS PANEL IS ON THE PAGE PRECISELY BECAUSE IT CANNOT BE FILLED.
 *
 * "27 items blocked on Field Ops" is the single most useful sentence a
 * department screen could carry, and nothing this product ingests can produce
 * it: an escalation is a relationship between two units, and the record table
 * has one department column, which can say who owns a record but never who sent
 * it or who is holding it up.
 *
 * Dropping the section would leave the reader believing the question was never
 * worth asking. Keeping it, empty and explained, tells them it was asked, why it
 * could not be answered, and what column on which export would answer it — and
 * that is also the reason the recommendation below reports its root cause as
 * UNDETERMINED rather than blaming this unit for a backlog it may only be
 * holding.
 */
export function FlowPanel({ flow, onFix }: { flow: CrossUnitFlow; onFix?: () => void }) {
  if (flow.supported && flow.items.length > 0) {
    // The server does not produce rows for any connected source today. The
    // branch exists so that adding the column is a backend change only.
    return (
      <Panel title="Flow with other units">
        <div>
          {(flow.items as Array<{ unit: string; count: number; note?: string }>).map((item) => (
            <div className="dv-row" key={item.unit}>
              <span className="dv-row__lab">
                {item.unit}
                {item.note && <span className="dv-src"> · {item.note}</span>}
              </span>
              <span className="dv-row__val">
                <span className="dv-fig">{item.count.toLocaleString()}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Flow with other units">
      <NotMeasurable what="Work moving between units" reason={flow.reason} fixLabel={flow.fixLabel} onFix={onFix} />
      <p className="dv-why">
        <b>What would answer it: </b>
        {flow.requires}
      </p>
    </Panel>
  );
}
