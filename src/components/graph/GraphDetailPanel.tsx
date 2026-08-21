import { ArrowUpRight, ChevronRight, Info, Loader2, X } from 'lucide-react';
import type { GraphConnection, GraphEdge, GraphNode, GraphNodeDetail } from './graphTypes';
import { FAMILY_COLOR } from './graphTypes';

/**
 * The right-hand panel.
 *
 * WHAT IT SHOWS AND WHAT IT REFUSES TO. Every field comes from
 * GraphProjection::facts() — a stored column, a JSON field of a stored payload,
 * or an aggregate over rows the entity is genuinely attached to. The server
 * omits a fact it has no value for rather than sending an empty one, so this
 * component never has to decide whether a blank means zero or means "not
 * recorded". It renders what it is given, in the order it is given.
 *
 * WHY EVERY RELATIONSHIP CARRIES ITS PROVENANCE. "This student has a result in
 * Accountancy" is a claim about the database, and the reader is entitled to ask
 * which column makes it true. The answer travels with the edge from
 * GraphVocabulary and is shown here, which is the difference between a graph you
 * can audit and a picture you have to trust.
 *
 * IT DOES NOT REIMPLEMENT AN ENTITY SCREEN. Where the application already has a
 * page that owns this entity — People, Departments, Signals — the panel offers a
 * link to it rather than growing a second copy of it here.
 */

export interface GraphDetailPanelProps {
  node: GraphNode | null;
  detail: GraphNodeDetail | null;
  /** Edges touching the selected node, for the "connections" list. */
  edges: GraphEdge[];
  nodesByKey: Map<string, GraphNode>;
  loading: boolean;
  error: string | null;
  expanded: boolean;
  expanding: boolean;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onSelectKey: (key: string) => void;
  onOpenRecord: (view: string) => void;
}

export function GraphDetailPanel({
  node, detail, edges, nodesByKey, loading, error, expanded, expanding,
  onClose, onExpand, onCollapse, onSelectKey, onOpenRecord,
}: GraphDetailPanelProps) {
  if (!node) return null;

  const colour = FAMILY_COLOR[node.family];
  const connected = edges
    .map((edge) => {
      const otherKey = edge.from === node.key ? edge.to : edge.from;
      const other = nodesByKey.get(otherKey);
      return other ? { edge, other, outgoing: edge.from === node.key } : null;
    })
    .filter((x): x is { edge: GraphEdge; other: GraphNode; outgoing: boolean } => x !== null);

  return (
    <aside className="gx-panel" aria-label={`${node.label} details`}>
      <header className="gx-panel__head">
        <div className="gx-panel__ident">
          <span className="gx-panel__kicker" style={{ color: colour }}>
            <span className="gx-panel__dot" style={{ background: colour }} aria-hidden="true" />
            {node.kind === 'group' ? `${node.groupOf ?? 'Group'} · group` : node.label}
          </span>
          <h2 className="gx-panel__title">{node.title}</h2>
          {node.subtitle && <p className="gx-panel__sub">{node.subtitle}</p>}
        </div>
        <button type="button" className="gx-panel__close" onClick={onClose} aria-label="Close details">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="gx-panel__actions">
        {node.expandable && (
          expanded ? (
            <button type="button" className="u-btn u-btn-secondary u-btn-sm" onClick={onCollapse}>
              Collapse
            </button>
          ) : (
            <button type="button" className="u-btn u-btn-primary u-btn-sm" onClick={onExpand} disabled={expanding}>
              {expanding ? <Loader2 size={13} className="gx-spin" aria-hidden="true" /> : null}
              {expanding ? 'Expanding…' : 'Expand connections'}
            </button>
          )
        )}
        {node.deepLink && node.kind === 'entity' && (
          <button type="button" className="u-btn u-btn-ghost u-btn-sm" onClick={() => onOpenRecord(node.deepLink!)}>
            Open full record
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {loading && (
        <div className="gx-panel__loading" role="status">
          <Loader2 size={15} className="gx-spin" aria-hidden="true" />
          <span>Reading this record…</span>
        </div>
      )}

      {error && !loading && (
        <div className="gx-panel__note gx-panel__note--error" role="alert">{error}</div>
      )}

      {/* A group is an aggregate. Saying so, in the panel, is the guard against
          anyone reading its count as a property of a single record. */}
      {node.kind === 'group' && (
        <div className="gx-panel__note">
          <Info size={14} aria-hidden="true" />
          <span>
            {node.count !== null ? `${node.count.toLocaleString()} ` : ''}
            {(node.groupOf ?? 'record').toLowerCase()} records stand behind this node. Expand it to load them in pages —
            they are not all drawn at once.
          </span>
        </div>
      )}

      {detail && detail.facts.length > 0 && (
        <section className="gx-panel__section">
          <h3 className="gx-panel__h3">Details</h3>
          <dl className="gx-facts">
            {detail.facts.map((fact) => (
              <div className="gx-fact" key={fact.label}>
                <dt className="gx-fact__label">
                  {fact.label}
                  {fact.hint && (
                    <span className="gx-fact__hint" title={fact.hint}>
                      <Info size={11} aria-hidden="true" />
                      <span className="u-sr-only">{fact.hint}</span>
                    </span>
                  )}
                </dt>
                <dd className="gx-fact__value">{formatValue(fact.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {detail && detail.connections.length > 0 && (
        <section className="gx-panel__section">
          <h3 className="gx-panel__h3">What this connects to</h3>
          <ul className="gx-conns">
            {detail.connections.map((connection) => (
              <ConnectionRow key={`${connection.label}-${connection.relationship}`} connection={connection} />
            ))}
          </ul>
        </section>
      )}

      {connected.length > 0 && (
        <section className="gx-panel__section">
          <h3 className="gx-panel__h3">On the graph</h3>
          <ul className="gx-links">
            {connected.map(({ edge, other, outgoing }) => (
              <li key={edge.id}>
                <button type="button" className="gx-link" onClick={() => onSelectKey(other.key)}>
                  <span className="gx-link__rel">
                    {outgoing ? '' : '← '}{edge.label}{outgoing ? ' →' : ''}
                  </span>
                  <span className="gx-link__title">
                    <span className="gx-link__dot" style={{ background: FAMILY_COLOR[other.family] }} aria-hidden="true" />
                    {other.title}
                  </span>
                  {/* The clause that makes the edge true. This is the whole
                      difference between an auditable graph and a decorative one. */}
                  <span className="gx-link__why">{edge.note ?? edge.provenance}</span>
                  <ChevronRight size={13} className="gx-link__chev" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail && detail.facts.length === 0 && detail.connections.length === 0 && !loading && (
        <p className="gx-panel__empty">
          This record exists and carries no further detail in the connected source system.
        </p>
      )}
    </aside>
  );
}

function ConnectionRow({ connection }: { connection: GraphConnection }) {
  return (
    <li className="gx-conn">
      <span className="gx-conn__count">{connection.count.toLocaleString()}</span>
      <span className="gx-conn__body">
        <span className="gx-conn__rel">{connection.relationship}</span>
        <span className="gx-conn__label">{connection.label}</span>
      </span>
      <span className="gx-conn__why" title={connection.provenance}>
        <Info size={11} aria-hidden="true" />
        <span className="u-sr-only">{connection.provenance}</span>
      </span>
    </li>
  );
}

/** Numbers get thousands separators; everything else is shown as sent. */
function formatValue(value: string | number | null): string {
  if (value === null) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
}
