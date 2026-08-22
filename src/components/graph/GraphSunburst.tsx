import { useMemo, useState } from 'react';
import { hierarchy, partition } from 'd3-hierarchy';
import type { GraphEdge, GraphNode } from './graphTypes';
import { FAMILY_COLOR } from './graphTypes';
import { computeLayout, flowThrough } from './layout';

/**
 * SUNBURST — the composition view.
 *
 * WHY THIS AND NOT ANOTHER NODE-LINK PICTURE. The flow view answers "what
 * connects to what" and the bar view answers "how many of each are there".
 * Neither answers "how is this organization DIVIDED" — which branch is most of
 * it, and how deep does each branch go. A sunburst answers exactly that: one
 * ring per hop from the organization, each arc sized by how much of the graph
 * sits beneath it, so a branch that dominates the tenant is visibly most of the
 * circle.
 *
 * IT IS BUILT ON THE SAME SPANNING TREE AS THE FLOW VIEW, deliberately. The
 * parent of a node here is the parent it has there, so the three views cannot
 * disagree about the shape of the organization, and there is exactly one place
 * where "who is whose parent" is decided.
 *
 * NOTHING ANIMATES AND NOTHING RECOMPUTES ON HOVER. The arcs are computed once
 * per data change; hovering changes opacity and stroke only, so the ring holds
 * still under the pointer exactly as the flow view does.
 */

export interface GraphSunburstProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootKey: string | null;
  selectedKey: string | null;
  dimmedKeys: Set<string>;
  onSelect: (node: GraphNode) => void;
  /**
   * The organization's human display name, as the rest of the app knows it.
   *
   * PREFERRED OVER THE ROOT NODE'S TITLE. Where an organization has no name
   * recorded in its source table the projection falls back to a generated
   * "Organization 1000010", which is an internal id wearing a label and is
   * exactly what should not be the biggest text on the screen. This prop is the
   * same value the page header already shows, so the two cannot disagree.
   */
  organizationName?: string;
}

/** Drawn at a fixed size and scaled by CSS, so it is crisp at any container width. */
const SIZE = 760;

const RADIUS = SIZE / 2;

export function GraphSunburst({
  nodes, edges, rootKey, selectedKey, dimmedKeys, onSelect, organizationName,
}: GraphSunburstProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  /* The one spanning tree, borrowed from the layout engine rather than rebuilt. */
  const { parents, depths } = useMemo(
    () => computeLayout(nodes, edges, { mode: 'hierarchy', width: SIZE, height: SIZE, rootKey }),
    [nodes, edges, rootKey],
  );

  const arcs = useMemo(() => {
    const root = rootKey && byKey.has(rootKey) ? rootKey : nodes[0]?.key;
    if (!root) return [];

    const children = new Map<string, string[]>();
    for (const [child, parent] of parents) {
      if (!parent) continue;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(child);
    }

    const h = hierarchy<string>(root, (key) => children.get(key) ?? [])
      // A leaf counts as one slice of the circle. Group nodes are NOT weighted
      // by their count here: a group of 4,321 students would otherwise swallow
      // the entire ring and hide every other branch, which is the opposite of
      // what a composition view is for. The count is on the card in the flow
      // view and on the bar in the bar view, where it can be read exactly.
      .count();

    const laid = partition<string>().size([2 * Math.PI, RADIUS])(h);

    return laid
      .descendants()
      .filter((d) => d.depth > 0) // the root is the hub, drawn separately
      .map((d) => ({
        key: d.data,
        node: byKey.get(d.data),
        depth: d.depth,
        path: arcPath(d.x0, d.x1, d.y0, d.y1),
        // Kept so a label can be placed only where there is room for one.
        x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1,
      }))
      .filter((a) => a.node);
  }, [nodes, parents, rootKey, byKey]);

  const focusKey = hovered ?? selectedKey;
  const lit = useMemo(() => flowThrough(parents, focusKey), [parents, focusKey]);

  const rootNode = rootKey ? byKey.get(rootKey) : undefined;
  const maxDepth = depths.size ? Math.max(...depths.values()) : 0;
  const hubRadius = RADIUS / (maxDepth + 1) - 4;

  /* The app's own display name wins; the node title is the fallback, and only
     then the generic word. */
  const displayName = organizationName?.trim() || rootNode?.title || 'Organization';

  return (
    <div className="gx-canvas gx-canvas--sunburst">
      <svg
        className="gx-sun"
        viewBox={`${-RADIUS} ${-RADIUS} ${SIZE} ${SIZE}`}
        role="application"
        aria-label={`Composition of ${rootNode?.title ?? 'this organization'}, ${maxDepth} levels deep.`}
      >
        {arcs.map((a) => {
          const node = a.node!;
          const dimmed = dimmedKeys.has(a.key) || (!!focusKey && !lit.has(a.key));

          return (
            <path
              key={a.key}
              className={[
                'gx-sun__arc',
                `gx-sun__arc--${node.family}`,
                dimmed ? 'gx-sun__arc--dim' : '',
                focusKey && lit.has(a.key) ? 'gx-sun__arc--lit' : '',
                a.key === selectedKey ? 'gx-sun__arc--selected' : '',
              ].filter(Boolean).join(' ')}
              d={a.path}
              fill={FAMILY_COLOR[node.family]}
              role="button"
              tabIndex={0}
              aria-label={`${node.label}: ${node.title}`}
              onPointerEnter={() => setHovered(a.key)}
              onPointerLeave={() => setHovered((h) => (h === a.key ? null : h))}
              onFocus={() => setHovered(a.key)}
              onBlur={() => setHovered((h) => (h === a.key ? null : h))}
              onClick={() => onSelect(node)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(node);
                }
              }}
            />
          );
        })}

        {/*
          * Labels, but only where one genuinely fits. Drawing every label makes
          * the ring unreadable, which is what the detail panel and the hover
          * card are for; a segment too narrow for text keeps its colour and
          * gives up its name.
          */}
        {arcs.map((a) => {
          const node = a.node!;
          const angle = a.x1 - a.x0;
          const midRadius = (a.y0 + a.y1) / 2;
          const arcLength = angle * midRadius;
          const band = a.y1 - a.y0;

          // Needs both a long enough arc and a deep enough band to hold type.
          if (arcLength < 46 || band < 26) return null;
          if (dimmedKeys.has(a.key)) return null;
          if (focusKey && !lit.has(a.key)) return null;

          const mid = (a.x0 + a.x1) / 2 - Math.PI / 2;
          const flip = Math.cos(mid) < 0;
          const chars = Math.max(3, Math.floor(arcLength / 7.2));

          return (
            <text
              key={`label-${a.key}`}
              className="gx-sun__label"
              transform={
                `rotate(${(mid * 180) / Math.PI}) `
                + `translate(${midRadius} 0) `
                + `rotate(${flip ? 180 : 0})`
              }
              textAnchor="middle"
              dy="0.32em"
            >
              {truncate(node.title, chars)}
            </text>
          );
        })}

        {/*
          * The hub: the organization itself, always legible at the centre.
          * Its NAME is the strongest text on the screen — never its id.
          */}
        <circle className="gx-sun__hub" r={hubRadius} />
        <text className="gx-sun__hub-kicker" y={-hubRadius * 0.42} textAnchor="middle">
          ORGANIZATION
        </text>
        <text className="gx-sun__hub-title" y={4} textAnchor="middle">
          {truncate(displayName, 20)}
        </text>
        <text className="gx-sun__hub-meta" y={hubRadius * 0.46} textAnchor="middle">
          {nodes.length.toLocaleString()} nodes · {edges.length.toLocaleString()} connections
        </text>
      </svg>

      {focusKey && byKey.get(focusKey) && (
        <div className="gx-tooltip" role="status">
          <span className="gx-tooltip__label" style={{ color: FAMILY_COLOR[byKey.get(focusKey)!.family] }}>
            {byKey.get(focusKey)!.label}
          </span>
          <strong className="gx-tooltip__title">{byKey.get(focusKey)!.title}</strong>
          {byKey.get(focusKey)!.subtitle && (
            <span className="gx-tooltip__sub">{byKey.get(focusKey)!.subtitle}</span>
          )}
          <span className="gx-tooltip__depth">
            {lit.size - 1} connected {lit.size === 2 ? 'node' : 'nodes'} on this branch
          </span>
        </div>
      )}
    </div>
  );
}

/** One annular sector, written out so no d3-shape arc generator is needed. */
function arcPath(x0: number, x1: number, y0: number, y1: number): string {
  // SVG angles start at 3 o'clock; the partition starts at 12. Rotate by -90°.
  const a0 = x0 - Math.PI / 2;
  const a1 = x1 - Math.PI / 2;
  const large = x1 - x0 > Math.PI ? 1 : 0;

  const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;

  // A full circle cannot be drawn as one arc — it would collapse to a point.
  if (x1 - x0 >= 2 * Math.PI - 1e-9) {
    return [
      `M ${p(y1, 0)} A ${y1} ${y1} 0 1 1 ${p(y1, Math.PI)} A ${y1} ${y1} 0 1 1 ${p(y1, 0)}`,
      `M ${p(y0, 0)} A ${y0} ${y0} 0 1 0 ${p(y0, Math.PI)} A ${y0} ${y0} 0 1 0 ${p(y0, 0)}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${p(y0, a0)}`,
    `L ${p(y1, a0)}`,
    `A ${y1} ${y1} 0 ${large} 1 ${p(y1, a1)}`,
    `L ${p(y0, a1)}`,
    `A ${y0} ${y0} 0 ${large} 0 ${p(y0, a0)}`,
    'Z',
  ].join(' ');
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
