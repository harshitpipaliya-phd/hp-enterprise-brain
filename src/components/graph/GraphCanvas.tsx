import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GraphEdge, GraphNode } from './graphTypes';
import { FAMILY_COLOR, nodeRadius } from './graphTypes';
import { GraphLayout } from './layout';

/**
 * The canvas. SVG, because it gives hit-testing, focus, keyboard access and
 * crisp text for free at the scale this graph operates at — a couple of hundred
 * nodes. A <canvas> renderer would be faster at ten thousand and would need
 * every one of those four things reimplemented, and the node budget on the
 * server means ten thousand never arrives.
 *
 * WHAT IT OWNS: the viewport (zoom and pan), the simulation loop, dragging, and
 * which node is hovered. It does NOT own selection or expansion — those are the
 * screen's, so the detail panel and the graph cannot disagree about what is
 * selected.
 *
 * ACCESSIBILITY. Nodes are real focusable elements in a list-shaped role, so the
 * graph is reachable by keyboard: Tab moves between nodes, Enter selects, and
 * the container takes arrow keys for panning and +/- for zoom. A force-directed
 * picture is never going to be a good experience for a screen reader, which is
 * why every node also carries its full label and count in an accessible name and
 * why the detail panel — an ordinary list of fields — is where the same
 * information can actually be read.
 */

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootKey: string | null;
  selectedKey: string | null;
  /** Keys drawn dimmed rather than removed — filtered out, but still located. */
  dimmedKeys: Set<string>;
  /** Keys already expanded, so the affordance can say "collapse". */
  expandedKeys: Set<string>;
  busyKey: string | null;
  onSelect: (node: GraphNode) => void;
  onExpand: (node: GraphNode) => void;
  /** Bumped by the screen to request a re-fit (after load, or "Reset view"). */
  fitToken: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.6;

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export function GraphCanvas({
  nodes, edges, rootKey, selectedKey, dimmedKeys, expandedKeys, busyKey, onSelect, onExpand, fitToken,
}: GraphCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layoutRef = useRef<GraphLayout | null>(null);
  const frameRef = useRef<number | null>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const fitRef = useRef(0);

  const [size, setSize] = useState({ width: 900, height: 600 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [, forceRender] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const dragRef = useRef<{ key: string; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  /* --------------------------------------------------------------- sizing */

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const next = { width: Math.max(320, rect.width), height: Math.max(320, rect.height) };
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };

    measure();

    // ResizeObserver rather than a window listener: the sidebar collapsing
    // changes this element's width without the window changing at all.
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------------ simulation */

  const runLoop = useCallback(() => {
    if (frameRef.current !== null) return;

    const step = () => {
      const layout = layoutRef.current;
      if (!layout) {
        frameRef.current = null;
        return;
      }

      const moving = layout.tick();
      forceRender((n) => n + 1);

      // Stops when the graph stops. A rAF loop that never ends is a battery
      // bug on a screen the user has walked away from.
      frameRef.current = moving ? requestAnimationFrame(step) : null;
    };

    frameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    const options = { width: size.width, height: size.height, rootKey };

    if (!layoutRef.current) {
      layoutRef.current = new GraphLayout(nodes, edges, options);
    } else {
      layoutRef.current.update(nodes, edges, options);
    }

    runLoop();
  }, [nodes, edges, rootKey, size.width, size.height, runLoop]);

  useEffect(() => {
    layoutRef.current?.resize(size.width, size.height);
    runLoop();
  }, [size.width, size.height, runLoop]);

  /* ---------------------------------------------------------------- fit */

  const applyViewport = useCallback((next: Viewport) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  const fit = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return;

    const b = layout.bounds();
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const padding = 64;

    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min((size.width - padding * 2) / w, (size.height - padding * 2) / h)),
    );

    applyViewport({
      x: size.width / 2 - ((b.minX + b.maxX) / 2) * scale,
      y: size.height / 2 - ((b.minY + b.maxY) / 2) * scale,
      scale,
    });
  }, [applyViewport, size.width, size.height]);

  useEffect(() => {
    if (fitToken === fitRef.current) return;
    fitRef.current = fitToken;

    // Let the simulation get its first few ticks in before framing it, or the
    // fit is computed against the seed positions and lands off-centre.
    const timer = window.setTimeout(fit, 420);
    return () => window.clearTimeout(timer);
  }, [fitToken, fit]);

  /** Bring one node to the middle of the viewport without changing zoom. */
  const centreOn = useCallback((key: string) => {
    const p = layoutRef.current?.position(key);
    if (!p) return;

    const { scale } = viewportRef.current;
    applyViewport({ x: size.width / 2 - p.x * scale, y: size.height / 2 - p.y * scale, scale });
  }, [applyViewport, size.width, size.height]);

  useEffect(() => {
    if (!selectedKey) return;
    // Give a freshly-expanded graph a moment to place the node first.
    const timer = window.setTimeout(() => centreOn(selectedKey), 260);
    return () => window.clearTimeout(timer);
  }, [selectedKey, centreOn]);

  /* ------------------------------------------------------- zoom and pan */

  const zoomBy = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    const current = viewportRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    if (scale === current.scale) return;

    const ax = anchorX ?? size.width / 2;
    const ay = anchorY ?? size.height / 2;

    // Keep the point under the anchor fixed while the scale changes.
    applyViewport({
      x: ax - ((ax - current.x) / current.scale) * scale,
      y: ay - ((ay - current.y) / current.scale) * scale,
      scale,
    });
  }, [applyViewport, size.width, size.height]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    // Registered non-passively so the page does not scroll behind the graph.
    // React's onWheel is passive and cannot preventDefault.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const { x, y, scale } = viewportRef.current;
    return {
      x: ((clientX - (rect?.left ?? 0)) - x) / scale,
      y: ((clientY - (rect?.top ?? 0)) - y) / scale,
    };
  }, []);

  const onPointerDownBackground = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const { x, y } = viewportRef.current;
    panRef.current = { startX: event.clientX, startY: event.clientY, originX: x, originY: y };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;

    if (drag) {
      const world = toWorld(event.clientX, event.clientY);
      drag.moved = true;
      layoutRef.current?.pin(drag.key, world.x, world.y);
      runLoop();
      return;
    }

    const pan = panRef.current;
    if (!pan) return;

    applyViewport({
      ...viewportRef.current,
      x: pan.originX + (event.clientX - pan.startX),
      y: pan.originY + (event.clientY - pan.startY),
    });
  };

  const endPointer = (event: React.PointerEvent) => {
    const drag = dragRef.current;

    if (drag) {
      // A press that never moved is a click, not a drag: select, and let the
      // node go back to the simulation. A press that DID move leaves the node
      // pinned where the user put it, which is the point of dragging it.
      if (!drag.moved) {
        layoutRef.current?.release(drag.key);
        const node = nodeByKey.get(drag.key);
        if (node) onSelect(node);
      }
      dragRef.current = null;
    }

    panRef.current = null;
    if ((event.currentTarget as Element).hasPointerCapture?.(event.pointerId)) {
      (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    }
  };

  const onNodePointerDown = (event: React.PointerEvent, node: GraphNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    dragRef.current = { key: node.key, moved: false };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  /* ------------------------------------------------------------ keyboard */

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 60;
    const current = viewportRef.current;

    switch (event.key) {
      case 'ArrowLeft': applyViewport({ ...current, x: current.x + step }); break;
      case 'ArrowRight': applyViewport({ ...current, x: current.x - step }); break;
      case 'ArrowUp': applyViewport({ ...current, y: current.y + step }); break;
      case 'ArrowDown': applyViewport({ ...current, y: current.y - step }); break;
      case '+': case '=': zoomBy(1.2); break;
      case '-': case '_': zoomBy(1 / 1.2); break;
      case '0': fit(); break;
      default: return;
    }

    event.preventDefault();
  };

  /* -------------------------------------------------------------- render */

  const layout = layoutRef.current;
  const positionOf = (key: string) => layout?.position(key);

  // Labels are hidden below a zoom where they would overlap into illegibility.
  // The node stays; only its text goes, and the tooltip and panel still name it.
  const showLabels = viewport.scale > 0.55;
  const neighbourKeys = useMemo(() => {
    if (!selectedKey) return new Set<string>();
    const out = new Set<string>([selectedKey]);
    for (const edge of edges) {
      if (edge.from === selectedKey) out.add(edge.to);
      if (edge.to === selectedKey) out.add(edge.from);
    }
    return out;
  }, [edges, selectedKey]);

  return (
    <div className="gx-canvas" ref={hostRef}>
      <svg
        ref={svgRef}
        className="gx-svg"
        width={size.width}
        height={size.height}
        role="application"
        aria-label="Organization graph. Use Tab to move between nodes, Enter to select, arrow keys to pan, plus and minus to zoom."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDownBackground}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <defs>
          <marker id="gx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
          </marker>
        </defs>

        <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`}>
          {/* Edges first, so nodes sit on top of them. */}
          <g className="gx-edges">
            {edges.map((edge) => {
              const a = positionOf(edge.from);
              const b = positionOf(edge.to);
              if (!a || !b) return null;

              const dimmed = dimmedKeys.has(edge.from) || dimmedKeys.has(edge.to);
              const active = !!selectedKey && (edge.from === selectedKey || edge.to === selectedKey);

              // Stop the line at the node's edge rather than its centre, so the
              // arrowhead lands on the circle instead of under it.
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
              const x1 = a.x + (dx / dist) * a.r;
              const y1 = a.y + (dy / dist) * a.r;
              const x2 = b.x - (dx / dist) * (b.r + 6);
              const y2 = b.y - (dy / dist) * (b.r + 6);

              return (
                <g key={edge.id} className={`gx-edge${active ? ' gx-edge--active' : ''}${dimmed ? ' gx-edge--dim' : ''}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#gx-arrow)" />
                  {/* An edge label is only readable when the reader is close in
                      and the edge is one they are looking at. Drawing all of
                      them at all zooms is what turns a graph into noise. */}
                  {active && showLabels && (
                    <text
                      className="gx-edge__label"
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 5}
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <g className="gx-nodes">
            {nodes.map((node) => {
              const p = positionOf(node.key);
              if (!p) return null;

              const r = nodeRadius(node);
              const colour = FAMILY_COLOR[node.family];
              const selected = node.key === selectedKey;
              const dimmed = dimmedKeys.has(node.key)
                || (!!selectedKey && !neighbourKeys.has(node.key));
              const isRoot = node.key === rootKey;
              const expanded = expandedKeys.has(node.key);
              const busy = busyKey === node.key;

              const name = node.count !== null && node.count !== undefined
                ? `${node.title}, ${node.count.toLocaleString()} ${node.groupOf ?? node.label}`
                : `${node.label}: ${node.title}`;

              return (
                <g
                  key={node.key}
                  className={[
                    'gx-node',
                    `gx-node--${node.family}`,
                    node.kind === 'group' ? 'gx-node--group' : '',
                    selected ? 'gx-node--selected' : '',
                    dimmed ? 'gx-node--dim' : '',
                    isRoot ? 'gx-node--root' : '',
                    hovered === node.key ? 'gx-node--hover' : '',
                  ].filter(Boolean).join(' ')}
                  transform={`translate(${p.x},${p.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={name}
                  aria-pressed={selected}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endPointer}
                  onPointerEnter={() => setHovered(node.key)}
                  onPointerLeave={() => setHovered((h) => (h === node.key ? null : h))}
                  onFocus={() => setHovered(node.key)}
                  onBlur={() => setHovered((h) => (h === node.key ? null : h))}
                  onDoubleClick={(event) => { event.stopPropagation(); if (node.expandable) onExpand(node); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelect(node);
                    }
                    if (event.key === 'e' && node.expandable) {
                      event.preventDefault();
                      event.stopPropagation();
                      onExpand(node);
                    }
                  }}
                >
                  {selected && <circle className="gx-node__halo" r={r + 9} />}

                  <circle
                    className="gx-node__body"
                    r={r}
                    fill={colour}
                    // A group is an aggregate, and it is drawn as one: hollow
                    // with a dashed rim, so it can never be read as a record.
                    fillOpacity={node.kind === 'group' ? 0.16 : 0.9}
                    stroke={colour}
                    strokeDasharray={node.kind === 'group' ? '5 4' : undefined}
                  />

                  {node.kind === 'group' && node.count !== null && (
                    <text className="gx-node__count" textAnchor="middle" dy="4">
                      {compact(node.count)}
                    </text>
                  )}

                  {/* The expandable affordance: a small ring, filled once the
                      node has been expanded, so "already open" is visible
                      without clicking. */}
                  {node.expandable && (
                    <circle
                      className={`gx-node__pip${expanded ? ' gx-node__pip--open' : ''}${busy ? ' gx-node__pip--busy' : ''}`}
                      cx={r * 0.72}
                      cy={-r * 0.72}
                      r={4.5}
                    />
                  )}

                  {showLabels && (
                    <text className="gx-node__label" textAnchor="middle" y={r + 15}>
                      {truncate(node.title, node.label === 'Organization' ? 34 : 22)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Zoom controls. Buttons rather than wheel-only, because a trackpad
          user and a touch user both need a target. */}
      <div className="gx-zoom" role="group" aria-label="Graph view controls">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" onClick={fit} aria-label="Fit graph to view" title="Fit to view">⤢</button>
        <span className="gx-zoom__level" aria-live="off">{Math.round(viewport.scale * 100)}%</span>
      </div>

      {hovered && nodeByKey.get(hovered) && (
        <NodeTooltip node={nodeByKey.get(hovered)!} />
      )}
    </div>
  );
}

/**
 * The hover card. Fixed to a corner rather than following the pointer: a card
 * chasing the cursor across a graph covers the very nodes the reader is
 * comparing, and reflowing it on every mousemove is the most expensive thing on
 * the screen.
 */
function NodeTooltip({ node }: { node: GraphNode }) {
  return (
    <div className="gx-tooltip" role="status">
      <span className="gx-tooltip__label" style={{ color: FAMILY_COLOR[node.family] }}>
        {node.kind === 'group' ? `${node.groupOf ?? 'Group'} · group` : node.label}
      </span>
      <strong className="gx-tooltip__title">{node.title}</strong>
      {node.subtitle && <span className="gx-tooltip__sub">{node.subtitle}</span>}
      {node.count !== null && node.count !== undefined && (
        <span className="gx-tooltip__count">{node.count.toLocaleString()} records</span>
      )}
      {node.expandable && <span className="gx-tooltip__hint">Click to inspect · double-click to expand</span>}
    </div>
  );
}

function compact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value / 100_000) / 10}M`;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
