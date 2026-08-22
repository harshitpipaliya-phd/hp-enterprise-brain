import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GraphEdge, GraphNode } from './graphTypes';
import { FAMILY_COLOR, nodeRadius } from './graphTypes';
import type { LayoutMode } from './layout';
import { CARD_H, CARD_W, computeLayout, flowThrough, layoutBounds } from './layout';

/**
 * The canvas. SVG, and STILL — nothing on this screen animates.
 *
 * Positions come from computeLayout(), a pure function of the nodes, the edges
 * and the chosen layout. There is no simulation and no requestAnimationFrame
 * loop: the picture is drawn once per data change and then holds absolutely
 * still until the reader expands something or drags a node. The same
 * organization always lays out the same way, so a reader can build a memory of
 * where things are.
 *
 * WHAT IT OWNS: the viewport (zoom and pan), dragging, and which node is
 * hovered. It does NOT own selection or expansion — those belong to the screen,
 * so the detail panel and the graph cannot disagree about what is selected.
 *
 * THE FLOW VIEW DRAWS CARDS, NOT DOTS. A circle can carry a colour and a radius
 * and nothing else, so every reading of the old graph meant crossing to a label
 * and back. A card states the entity's name, what kind of thing it is and how
 * many rows are behind it in one glance, which is the whole reason this screen
 * exists. Circles are kept for the radial view, where a ring of cards would not
 * fit.
 *
 * PATH HIGHLIGHTING IS THE POINT OF THE SCREEN. Hovering or selecting a node
 * lights the chain from the organization down to it and mutes everything else.
 * That chain is the spanning-tree ancestry, and because the spanning tree is
 * BFS it is also the SHORTEST route from the organization — so the highlight
 * answers "where did this come from" with the most direct real answer, not a
 * decorative one. Nothing is hidden: muted branches stay in place, because
 * removing them would misrepresent the shape of what is connected.
 */

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootKey: string | null;
  mode: LayoutMode;
  selectedKey: string | null;
  dimmedKeys: Set<string>;
  expandedKeys: Set<string>;
  busyKey: string | null;
  onSelect: (node: GraphNode) => void;
  onExpand: (node: GraphNode) => void;
  /** Bumped by the screen to request a re-fit (after load, or "Fit"). */
  fitToken: number;
  /**
   * Bumped by the screen to centre on the selected node ("Focus"), which is the
   * ONLY thing that moves the viewport apart from an explicit fit. Selecting a
   * node on its own deliberately does not.
   */
  focusToken?: number;
  /**
   * The organization's display name. Preferred over the root node's title,
   * which falls back to a generated "Organization 1000010" when the source
   * table records no name — an internal id is the wrong thing to put on the
   * most important card on the screen.
   */
  organizationName?: string;
}

/*
 * ZOOM RANGE AND STEPS.
 *
 * The old range bottomed out at 0.12 — a scale at which the graph is a grey
 * smudge — and the wheel multiplied by a fixed 1.12 per EVENT. A trackpad or a
 * high-resolution wheel emits dozens of events per gesture, so one flick ran
 * that multiplier twenty times and the graph leapt from unreadably small to
 * absurdly large. Hence both a tighter range and a per-event cap below.
 */
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

/** The rungs the +/- buttons move between. Predictable, and never a jump. */
const ZOOM_STEPS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];

/** Hard cap on how far ONE wheel event may zoom, whatever delta it reports. */
const MAX_WHEEL_FACTOR = 1.08;

/**
 * Floor for an automatic fit — below this the card text stops being readable.
 *
 * 0.75 puts the 13.5px card title at ~10px, which is the smallest that still
 * reads. Past a certain size READABLE and FULLY-VISIBLE are not both available:
 * 105 cards at 212x62 need more card area than a 1440x760 viewport physically
 * has, whatever the layout does. When they conflict this picks readable and
 * lets the reader pan, because a graph you can see all of but cannot read
 * answers no question at all. Small graphs are unaffected — they fit at 1:1.
 */
const FIT_MIN_SCALE = 0.7;

/**
 * A small graph is allowed to grow into the space rather than sit as a postage
 * stamp in an empty viewport — but not past 1.5, where four cards blown up to
 * fill a monitor look broken rather than generous.
 */
const MAX_FIT_SCALE = 1.5;

/** Margin left around the graph when fitting, as a fraction of the viewport. */
const FIT_MARGIN = 0.06;

interface Viewport { x: number; y: number; scale: number }

export function GraphCanvas({
  nodes, edges, rootKey, mode, selectedKey, dimmedKeys, expandedKeys, busyKey, onSelect, onExpand, fitToken,
  focusToken = 0, organizationName,
}: GraphCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const fitRef = useRef(-1);
  const focusRef = useRef(0);

  const [size, setSize] = useState({ width: 900, height: 620 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Map<string, { x: number; y: number }>>(new Map());

  const dragRef = useRef<{ key: string; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  /* Dragged positions belong to one layout. Switching layout clears them, or a
     node pinned in the hierarchy would sit in the wrong place on the ring. */
  useEffect(() => { setPinned(new Map()); }, [mode]);

  /* --------------------------------------------------------------- sizing */

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const measure = () => {
      /*
       * clientWidth/clientHeight, NOT getBoundingClientRect.
       *
       * getBoundingClientRect returns the BORDER box. Feeding that back in as
       * the SVG's size added the container's two border pixels every tick, and
       * with only a min-height on the container the box grew to fit — the page
       * crept downward for as long as the screen was open. The client
       * dimensions are the content box, which is the space the SVG actually
       * has. The SVG is also out of flow now, so this can no longer feed back
       * at all; measuring the right box keeps it honest regardless.
       */
      const next = {
        width: Math.max(320, host.clientWidth),
        height: Math.max(360, host.clientHeight),
      };
      setSize((c) => (c.width === next.width && c.height === next.height ? c : next));
    };

    measure();
    // ResizeObserver, not a window listener: collapsing the sidebar changes
    // this element's width without the window changing at all.
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* --------------------------------------------------------------- layout */

  const { positions, parents } = useMemo(
    () => computeLayout(nodes, edges, { mode, width: size.width, height: size.height, rootKey, pinned }),
    [nodes, edges, mode, size.width, size.height, rootKey, pinned],
  );

  const isFlow = mode === 'hierarchy';

  /* ------------------------------------------------------ path highlight */

  /* Hover wins over selection, so moving the pointer explores without losing
     the node whose detail panel is open. */
  const focusKey = hovered ?? selectedKey;

  /*
   * THE HIGHLIGHT IS THE WHOLE FLOW THROUGH THE NODE, not just the half above
   * it. Upstream answers "where did this come from"; downstream answers "where
   * does it lead". Hovering an intermediate node lights both, so a reader lands
   * on one card and immediately sees the entire chain it belongs to.
   */
  const pathKeys = useMemo(() => flowThrough(parents, focusKey), [parents, focusKey]);

  /* An edge is "on the path" when both endpoints are in the highlighted flow AND
     they are adjacent in the spanning tree. Testing adjacency as well as
     membership stops a cross-edge between two lit nodes being drawn as part of
     the chain when the tree does not actually route through it. Both directions
     are recorded because the tree and the drawn edge can disagree about which
     end is the parent. */
  const pathPairs = useMemo(() => {
    const pairs = new Set<string>();
    for (const key of pathKeys) {
      const parent = parents.get(key);
      if (!parent || !pathKeys.has(parent)) continue;
      pairs.add(`${parent} ${key}`);
      pairs.add(`${key} ${parent}`);
    }
    return pairs;
  }, [parents, pathKeys]);

  const applyViewport = useCallback((next: Viewport) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  const fit = useCallback(() => {
    const b = layoutBounds(positions, size, mode);
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    /* Proportional, so the graph fills ~88% of whatever viewport it is given
       instead of leaving a fixed 56px gutter that is generous on a laptop and
       invisible on a large monitor. */
    const pad = Math.max(24, Math.min(size.width, size.height) * FIT_MARGIN);

    /*
     * A FIT THAT REFUSES TO GO UNREADABLE.
     *
     * The old bound let this fall to MIN_SCALE (12%), so a large organization
     * "fitted" to a grey smear of unreadable cards — the reported "graph
     * becomes very small". Below FIT_MIN_SCALE it is better to overflow the
     * viewport and let the reader pan than to render text nobody can read, and
     * it never scales PAST 1:1 either, because a four-node graph blown up to
     * fill a wall looks broken rather than generous.
     */
    const raw = Math.min((size.width - pad * 2) / w, (size.height - pad * 2) / h);
    const scale = Math.min(MAX_FIT_SCALE, Math.max(FIT_MIN_SCALE, raw));

    applyViewport({
      x: size.width / 2 - ((b.minX + b.maxX) / 2) * scale,
      y: size.height / 2 - ((b.minY + b.maxY) / 2) * scale,
      scale,
    });
  }, [positions, size, mode, applyViewport]);

  // Re-fit whenever the screen asks, and whenever the layout changes shape.
  // No timer is needed any more: the positions are final the moment they exist.
  useEffect(() => {
    if (fitToken === fitRef.current) return;
    fitRef.current = fitToken;
    fit();
  }, [fitToken, fit]);

  useEffect(() => { fit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  /**
   * Centre the viewport on one node. Called ONLY when the screen explicitly
   * asks (the "focus" control and search-result selection), never as a side
   * effect of selecting.
   *
   * IT USED TO RUN ON EVERY SELECTION, and that was the single most visible
   * cause of "the graph keeps moving": clicking any node slid the whole picture
   * under the pointer, so the thing you just clicked was no longer where you
   * clicked it. Selection is now a purely visual change — the layout and the
   * viewport both hold still.
   */
  const centreOn = useCallback((key: string) => {
    const p = positions.get(key);
    if (!p) return;
    const { scale } = viewportRef.current;
    applyViewport({ x: size.width / 2 - p.x * scale, y: size.height / 2 - p.y * scale, scale });
  }, [positions, size, applyViewport]);

  useEffect(() => {
    if (focusToken === focusRef.current) return;
    focusRef.current = focusToken;
    if (selectedKey) centreOn(selectedKey);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [focusToken]);

  /* ------------------------------------------------------- zoom and pan */

  /** Zoom to an explicit scale, keeping the anchor point fixed on screen. */
  const zoomTo = useCallback((target: number, anchorX?: number, anchorY?: number) => {
    const current = viewportRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, target));
    if (Math.abs(scale - current.scale) < 1e-4) return;

    const ax = anchorX ?? size.width / 2;
    const ay = anchorY ?? size.height / 2;

    applyViewport({
      x: ax - ((ax - current.x) / current.scale) * scale,
      y: ay - ((ay - current.y) / current.scale) * scale,
      scale,
    });
  }, [applyViewport, size]);

  /** One rung up or down the ladder — what the + and − buttons do. */
  const stepZoom = useCallback((direction: 1 | -1) => {
    const current = viewportRef.current.scale;
    const next = direction > 0
      ? ZOOM_STEPS.find((s) => s > current + 1e-4) ?? MAX_SCALE
      : [...ZOOM_STEPS].reverse().find((s) => s < current - 1e-4) ?? MIN_SCALE;
    zoomTo(next);
  }, [zoomTo]);

  const zoomBy = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    const current = viewportRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    if (scale === current.scale) return;

    const ax = anchorX ?? size.width / 2;
    const ay = anchorY ?? size.height / 2;

    applyViewport({
      x: ax - ((ax - current.x) / current.scale) * scale,
      y: ay - ((ay - current.y) / current.scale) * scale,
      scale,
    });
  }, [applyViewport, size]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    // Non-passive so the page does not scroll behind the graph. React's onWheel
    // is passive and cannot preventDefault.
    const onWheel = (event: WheelEvent) => {
      // Stops the PAGE scrolling while the pointer is over the graph.
      event.preventDefault();
      event.stopPropagation();

      const rect = svg.getBoundingClientRect();

      /*
       * Scale the step by how much the device actually reported, then cap it.
       * A mouse notch reports ~100, a trackpad reports a stream of small
       * deltas; both end up moving a similar, small amount, and neither can
       * leap more than 8% in a single event.
       */
      const magnitude = Math.min(Math.abs(event.deltaY), 100) / 100;
      const factor = 1 + magnitude * (MAX_WHEEL_FACTOR - 1);

      zoomBy(
        event.deltaY < 0 ? factor : 1 / factor,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const { x, y, scale } = viewportRef.current;
    return { x: (clientX - (rect?.left ?? 0) - x) / scale, y: (clientY - (rect?.top ?? 0) - y) / scale };
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
      setPinned((current) => new Map(current).set(drag.key, world));
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
      // A press that never moved is a click. A press that DID move leaves the
      // node exactly where the user let go of it.
      if (!drag.moved) {
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

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 60;
    const c = viewportRef.current;

    switch (event.key) {
      case 'ArrowLeft': applyViewport({ ...c, x: c.x + step }); break;
      case 'ArrowRight': applyViewport({ ...c, x: c.x - step }); break;
      case 'ArrowUp': applyViewport({ ...c, y: c.y + step }); break;
      case 'ArrowDown': applyViewport({ ...c, y: c.y - step }); break;
      case '+': case '=': zoomBy(1.2); break;
      case '-': case '_': zoomBy(1 / 1.2); break;
      case '0': fit(); break;
      default: return;
    }

    event.preventDefault();
  };

  /* -------------------------------------------------------------- render */

  const showLabels = viewport.scale > 0.42;

  /* The relationship that reaches the hovered node from its parent in the
     spanning tree. This is what the tooltip explains, and its provenance is the
     server's own clause naming the column the edge came from — nothing here
     invents a description. */
  const focusEdge = useMemo(() => {
    if (!hovered) return null;
    const parent = parents.get(hovered);
    if (!parent) return null;
    return edges.find(
      (e) => (e.from === parent && e.to === hovered) || (e.from === hovered && e.to === parent),
    ) ?? null;
  }, [hovered, parents, edges]);

  return (
    <div className={`gx-canvas${isFlow ? ' gx-canvas--flow' : ''}`} ref={hostRef}>
      <svg
        ref={svgRef}
        className="gx-svg"
        width={size.width}
        height={size.height}
        role="application"
        aria-label="Organization graph. Tab moves between nodes, Enter selects, arrow keys pan, plus and minus zoom."
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
          {/* A second marker, because a marker cannot inherit the stroke of the
              path that uses it — the active arrowhead has to be its own shape. */}
          <marker id="gx-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--gx-path)" />
          </marker>
        </defs>

        <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`}>
          <g className="gx-edges">
            {edges.map((edge) => {
              const a = positions.get(edge.from);
              const b = positions.get(edge.to);
              if (!a || !b) return null;

              const onPath = pathPairs.has(`${edge.from} ${edge.to}`);
              const dimmed = dimmedKeys.has(edge.from) || dimmedKeys.has(edge.to)
                || (!!focusKey && !onPath);

              const { path, midX, midY } = isFlow
                ? flowLink(a, b)
                : straightLink(a, b);

              return (
                <g
                  key={edge.id}
                  className={`gx-edge${onPath ? ' gx-edge--path' : ''}${dimmed ? ' gx-edge--dim' : ''}`}
                >
                  <path
                    d={path}
                    fill="none"
                    markerEnd={onPath ? 'url(#gx-arrow-active)' : 'url(#gx-arrow)'}
                  />
                  {onPath && showLabels && (
                    <text className="gx-edge__label" x={midX} y={midY - 7} textAnchor="middle">
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <g className="gx-nodes">
            {nodes.map((node) => {
              const p = positions.get(node.key);
              if (!p) return null;

              const colour = FAMILY_COLOR[node.family];
              const selected = node.key === selectedKey;
              const onPath = pathKeys.has(node.key);
              const dimmed = dimmedKeys.has(node.key) || (!!focusKey && !onPath);
              const isRoot = node.key === rootKey;
              const expanded = expandedKeys.has(node.key);
              const busy = busyKey === node.key;

              /* The same name the card shows, so the accessible label and the
                 visible text cannot disagree — the root card in particular
                 shows the organization's real name rather than its id. */
              const shownTitle = isRoot ? (organizationName?.trim() || node.title) : node.title;

              const name = node.count !== null && node.count !== undefined
                ? `${shownTitle}, ${node.count.toLocaleString()} ${node.groupOf ?? node.label}`
                : `${node.label}: ${shownTitle}`;

              return (
                <g
                  key={node.key}
                  className={[
                    'gx-node', `gx-node--${node.family}`,
                    node.kind === 'group' ? 'gx-node--group' : '',
                    selected ? 'gx-node--selected' : '',
                    dimmed ? 'gx-node--dim' : '',
                    onPath && !!focusKey ? 'gx-node--path' : '',
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
                      event.preventDefault(); event.stopPropagation(); onSelect(node);
                    }
                    if (event.key === 'e' && node.expandable) {
                      event.preventDefault(); event.stopPropagation(); onExpand(node);
                    }
                  }}
                >
                  {isFlow
                    ? (
                      <NodeCard
                        node={node}
                        colour={colour}
                        selected={selected}
                        showLabels={showLabels}
                        displayTitle={shownTitle}
                      />
                    )
                    : <NodeDot node={node} colour={colour} selected={selected} showLabels={showLabels} />}

                  {node.expandable && (
                    <circle
                      className={`gx-node__pip${expanded ? ' gx-node__pip--open' : ''}${busy ? ' gx-node__pip--busy' : ''}`}
                      cx={isFlow ? CARD_W / 2 - 10 : nodeRadius(node) * 0.72}
                      cy={isFlow ? -CARD_H / 2 + 10 : -nodeRadius(node) * 0.72}
                      r={4.5}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="gx-zoom" role="group" aria-label="Graph view controls">
        <button type="button" onClick={() => stepZoom(1)} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={() => stepZoom(-1)} aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" onClick={fit} aria-label="Reset and fit graph to view" title="Reset / fit">⌂</button>
        <span className="gx-zoom__level">{Math.round(viewport.scale * 100)}%</span>
      </div>

      {hovered && nodeByKey.get(hovered) && (
        <NodeTooltip node={nodeByKey.get(hovered)!} edge={focusEdge} depth={pathKeys.size - 1} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── node art ── */

/**
 * The flow view's node: a rounded card with a family stripe down its left edge.
 *
 * The stripe carries the colour so the card body can stay near-white and the
 * TEXT can hold the contrast — which is what makes a wall of these readable at
 * a glance. Colour states what family the node belongs to and nothing else.
 */
function NodeCard({
  node, colour, selected, showLabels, displayTitle,
}: {
  node: GraphNode; colour: string; selected: boolean; showLabels: boolean; displayTitle?: string;
}) {
  const x = -CARD_W / 2;
  const y = -CARD_H / 2;

  return (
    <>
      {selected && (
        <rect className="gx-card__halo" x={x - 5} y={y - 5} width={CARD_W + 10} height={CARD_H + 10} rx={13} />
      )}

      <rect className="gx-card__body" x={x} y={y} width={CARD_W} height={CARD_H} rx={9} />

      {/* The stripe is clipped to the card's own rounded corner by drawing it as
          a rounded rect the same radius and covering its right half. */}
      <path className="gx-card__stripe" d={stripePath(x, y, CARD_H)} fill={colour} />

      {showLabels && (
        <>
          <text className="gx-card__title" x={x + 16} y={y + 21}>
            {truncate(displayTitle ?? node.title, 22)}
          </text>
          <text className="gx-card__meta" x={x + 16} y={y + 38}>
            {truncate(
              node.kind === 'group'
                ? `${node.count?.toLocaleString() ?? '—'} ${node.groupOf ?? 'records'}`
                : node.subtitle || node.label,
              24,
            )}
          </text>
        </>
      )}

      {node.kind === 'group' && node.count !== null && node.count !== undefined && (
        <g className="gx-card__badge" transform={`translate(${CARD_W / 2 - 8},${y + 10})`}>
          <rect className="gx-card__badge-bg" x={-badgeWidth(node.count)} y={0} width={badgeWidth(node.count)} height={17} rx={8.5} />
          <text className="gx-card__badge-text" x={-badgeWidth(node.count) / 2} y={12} textAnchor="middle">
            {compact(node.count)}
          </text>
        </g>
      )}
    </>
  );
}

/** The radial view's node: the original circle, unchanged in meaning. */
function NodeDot({
  node, colour, selected, showLabels,
}: { node: GraphNode; colour: string; selected: boolean; showLabels: boolean }) {
  const r = nodeRadius(node);

  return (
    <>
      {selected && <circle className="gx-node__halo" r={r + 9} />}

      <circle
        className="gx-node__body"
        r={r}
        fill={colour}
        // A group is an aggregate and is drawn as one: hollow, with a dashed
        // rim, so it can never be read as a single record.
        fillOpacity={node.kind === 'group' ? 0.16 : 0.9}
        stroke={colour}
        strokeDasharray={node.kind === 'group' ? '5 4' : undefined}
      />

      {node.kind === 'group' && node.count !== null && node.count !== undefined && (
        <text className="gx-node__count" textAnchor="middle" dy="4">{compact(node.count)}</text>
      )}

      {showLabels && (
        <text className="gx-node__label" textAnchor="middle" y={r + 15}>
          {truncate(node.title, node.label === 'Organization' ? 30 : 18)}
        </text>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────── links ── */

/**
 * A smooth horizontal connector between two cards.
 *
 * A cubic with both control points on the horizontal mid-line: the curve leaves
 * the parent going straight right and arrives at the child going straight right,
 * so a fan of siblings reads as a fan rather than as a bundle of diagonals.
 * This is d3's linkHorizontal shape, written out rather than imported so the
 * endpoints can sit on the card EDGES instead of their centres.
 */
function flowLink(
  a: { x: number; y: number; w: number },
  b: { x: number; y: number; w: number },
) {
  const rightward = b.x >= a.x;
  const x1 = a.x + (rightward ? a.w / 2 : -a.w / 2);
  const x2 = b.x - (rightward ? b.w / 2 + 8 : -(b.w / 2 + 8));
  const mid = (x1 + x2) / 2;

  return {
    path: `M ${x1} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${x2} ${b.y}`,
    midX: mid,
    midY: (a.y + b.y) / 2,
  };
}

/** The radial view's connector: centre to centre, trimmed to the circle rims. */
function straightLink(
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const x1 = a.x + (dx / dist) * a.r;
  const y1 = a.y + (dy / dist) * a.r;
  const x2 = b.x - (dx / dist) * (b.r + 6);
  const y2 = b.y - (dy / dist) * (b.r + 6);

  return { path: `M ${x1} ${y1} L ${x2} ${y2}`, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
}

/** The family stripe: rounded on the left, square where it meets the card. */
function stripePath(x: number, y: number, h: number): string {
  const w = 5;
  const r = 9;
  return [
    `M ${x + w} ${y}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 0 ${x} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 0 ${x + r} ${y + h}`,
    `H ${x + w}`,
    'Z',
  ].join(' ');
}

/* ──────────────────────────────────────────────────────────────── tooltip ── */

/**
 * The hover card, fixed to a corner rather than following the pointer: a card
 * chasing the cursor covers the very nodes the reader is comparing.
 *
 * When the node has a parent in the spanning tree, the card also states the
 * relationship that reaches it and the PROVENANCE the server published for that
 * relationship — the clause naming the column the edge came from. That sentence
 * is the difference between "these two things are connected" and "these two
 * things are connected BECAUSE of this column".
 */
function NodeTooltip({ node, edge, depth }: { node: GraphNode; edge: GraphEdge | null; depth: number }) {
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

      {edge && (
        <span className="gx-tooltip__rel">
          <em>{edge.label}</em>
          {edge.provenance && <span className="gx-tooltip__why">{edge.provenance}</span>}
        </span>
      )}

      {depth > 0 && (
        <span className="gx-tooltip__depth">{depth} {depth === 1 ? 'step' : 'steps'} from the organization</span>
      )}

      {node.expandable && <span className="gx-tooltip__hint">Click to inspect · double-click to expand</span>}
    </div>
  );
}

function badgeWidth(value: number): number {
  return Math.max(24, compact(value).length * 7 + 12);
}

function compact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value / 100_000) / 10}M`;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
