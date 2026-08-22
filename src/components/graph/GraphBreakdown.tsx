import type { GraphEdge, GraphNode, GraphSummary } from './graphTypes';
import { FAMILY_COLOR, FAMILY_LABEL } from './graphTypes';

/**
 * The BARS view — the same graph, read as quantities instead of as a picture.
 *
 * WHY IT EXISTS. A node-link diagram answers "what is connected to what". It is
 * a poor way to answer "how much of each is there", and past a few dozen nodes
 * it is a poor way to answer anything: circles and lines stop being countable.
 * This view answers the counting questions directly, from exactly the same data
 * the graph is drawn from, so switching between them can never show two
 * different organizations.
 *
 * EVERY BAR IS A REAL COUNT. The population bars are the organization's totals
 * from FoundationCounts and the loop tables — the same figures the metric strip
 * and the Organization screen publish. The composition bars count what is
 * currently ON the graph, which is a different question and is labelled as one.
 * A category with nothing in it is not drawn as an empty bar; it is not drawn.
 *
 * NO CHART LIBRARY. These are divs with a width, which is all a horizontal bar
 * is. recharts is in the bundle for the time-series screens and would add
 * nothing here but indirection.
 */

export interface GraphBreakdownProps {
  summary: GraphSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectLabel: (label: string) => void;
}

interface Bar {
  key: string;
  label: string;
  value: number;
  colour: string;
  hint?: string;
}

export function GraphBreakdown({ summary, nodes, edges, onSelectLabel }: GraphBreakdownProps) {
  /* What the organization holds. Totals, not what happens to be drawn. */
  const populations: Bar[] = [
    {
      key: 'departments',
      label: summary.departmentSource === 'academic' ? 'Teaching sections' : 'Departments',
      value: summary.departments,
      colour: FAMILY_COLOR.organization,
      hint: summary.departmentSource === 'academic'
        ? 'Derived from the standards this organization’s students are recorded in — its source system records no units.'
        : 'Units this organization’s source system records.',
    },
    { key: 'people', label: 'Staff', value: summary.people, colour: FAMILY_COLOR.people, hint: 'Active rows on the mapped person table. Never students.' },
    { key: 'students', label: 'Students', value: summary.students, colour: FAMILY_COLOR.student, hint: 'One row per enrolment number.' },
    { key: 'datasets', label: 'Imported datasets', value: summary.datasets, colour: FAMILY_COLOR.academic },
    { key: 'records', label: 'Imported records', value: summary.records, colour: FAMILY_COLOR.academic, hint: 'Source rows, not entities.' },
  ].filter((b) => b.value > 0);

  /* The intelligence loop, in the order the loop actually runs. */
  const loop: Bar[] = [
    { key: 'signals', label: 'Signals', value: summary.signals, colour: FAMILY_COLOR.intelligence },
    { key: 'evidence', label: 'Evidence', value: summary.evidence, colour: FAMILY_COLOR.intelligence },
    { key: 'cases', label: 'Cases', value: summary.cases, colour: FAMILY_COLOR.intelligence },
    { key: 'recommendations', label: 'Recommendations', value: summary.recommendations, colour: FAMILY_COLOR.intelligence },
    { key: 'decisions', label: 'Decisions', value: summary.decisions, colour: FAMILY_COLOR.intelligence },
    { key: 'capabilities', label: 'Capabilities', value: summary.capabilities, colour: FAMILY_COLOR.intelligence },
  ].filter((b) => b.value > 0);

  /* What is on the graph right now, by node label. A different question from
     the two above, and captioned as one. */
  const byLabel = new Map<string, { count: number; family: GraphNode['family'] }>();
  for (const node of nodes) {
    const key = node.kind === 'group' ? `${node.groupOf ?? 'Group'} (groups)` : node.label;
    const entry = byLabel.get(key) ?? { count: 0, family: node.family };
    entry.count += 1;
    byLabel.set(key, entry);
  }

  const composition: Bar[] = [...byLabel.entries()]
    .map(([label, { count, family }]) => ({ key: label, label, value: count, colour: FAMILY_COLOR[family] }))
    .sort((a, b) => b.value - a.value);

  /* Relationships on the graph, by what they MEAN. */
  const byType = new Map<string, { count: number; provenance: string }>();
  for (const edge of edges) {
    const entry = byType.get(edge.label) ?? { count: 0, provenance: edge.provenance };
    entry.count += 1;
    byType.set(edge.label, entry);
  }

  const relationships = [...byType.entries()]
    .map(([label, { count, provenance }]) => ({ label, count, provenance }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="gx-bars">
      {populations.length > 0 && (
        <BarCard
          title="What this organization holds"
          caption="Totals across the whole organization, not what is drawn on the graph."
          bars={populations}
        />
      )}

      {loop.length > 0 && (
        <BarCard
          title="Intelligence loop"
          caption="Rows the Brain has produced for this organization, in the order the loop runs."
          bars={loop}
        />
      )}

      {composition.length > 0 && (
        <BarCard
          title="On the graph right now"
          caption="How many nodes of each kind are currently drawn. Expanding a node changes this; it does not change the totals above."
          bars={composition}
          onSelect={onSelectLabel}
        />
      )}

      {relationships.length > 0 && (
        <section className="gx-barcard">
          <header className="gx-barcard__head">
            <h3>Relationships drawn</h3>
            <p>Every one is a real join. The clause under each is the column that produces it.</p>
          </header>
          <ul className="gx-rels">
            {relationships.map((rel) => (
              <li className="gx-rel" key={rel.label}>
                <span className="gx-rel__count">{rel.count.toLocaleString()}</span>
                <span className="gx-rel__body">
                  <span className="gx-rel__label">{rel.label}</span>
                  <span className="gx-rel__why">{rel.provenance}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BarCard({
  title, caption, bars, onSelect,
}: { title: string; caption: string; bars: Bar[]; onSelect?: (label: string) => void }) {
  // Scaled against the largest bar in THIS card. Scaling every card against one
  // global maximum would flatten six recommendations into invisibility beside
  // 398,831 imported records — two quantities that are not comparable and
  // should not share an axis.
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <section className="gx-barcard">
      <header className="gx-barcard__head">
        <h3>{title}</h3>
        <p>{caption}</p>
      </header>

      <ul className="gx-barlist">
        {bars.map((bar) => (
          <li className="gx-bar" key={bar.key} title={bar.hint}>
            <span className="gx-bar__label">{bar.label}</span>
            <span className="gx-bar__track">
              <span
                className="gx-bar__fill"
                style={{ width: `${Math.max(2, (bar.value / max) * 100)}%`, background: bar.colour }}
                role="img"
                aria-label={`${bar.label}: ${bar.value.toLocaleString()}`}
              />
            </span>
            {onSelect ? (
              <button type="button" className="gx-bar__value gx-bar__value--action" onClick={() => onSelect(bar.key)}>
                {bar.value.toLocaleString()}
              </button>
            ) : (
              <span className="gx-bar__value">{bar.value.toLocaleString()}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Exported so the legend and the switcher can name the families consistently. */
export const BREAKDOWN_FAMILIES = FAMILY_LABEL;
