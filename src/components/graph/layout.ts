import { hierarchy, tree } from 'd3-hierarchy';
import type { GraphEdge, GraphNode } from './graphTypes';
import { nodeRadius } from './graphTypes';

/**
 * Where each node sits. A PURE FUNCTION, computed once per data change.
 *
 * WHAT THIS REPLACES AND WHY. The first version ran a force simulation: nodes
 * repelled each other, edges pulled them back, and a rAF loop ticked until it
 * cooled. It never really cooled — every expansion reheated it, gravity dragged
 * the whole picture toward the centre while new nodes pushed it back, and the
 * graph visibly crept down the screen. Worse, the same organization laid out
 * twice looked different both times, so a reader could not build any memory of
 * where things were.
 *
 * A relationship graph is read, not watched. These layouts are deterministic:
 * the same nodes and edges always produce the same picture, nothing animates,
 * and a node stays exactly where the reader last saw it until they drag it.
 *
 * BOTH LAYOUTS ARE BUILT ON ONE SPANNING TREE. The graph has cross-edges — a
 * student reached from their section and from a signal — and a tree layout needs
 * a single parent per node. BFS from the root assigns each node the shortest
 * path to it, which is also the most meaningful one: a node's depth is then
 * literally "how many hops from the organization". Every edge is still DRAWN,
 * including the ones the tree does not use; only the positions come from it.
 *
 * THE HIERARCHY IS A TIDY TREE, NOT A COLUMN COUNTER. The previous pass gave
 * every leaf the next free column and put each parent above the midpoint of its
 * children. That is the right idea but it spaces by ORDINAL, so a level holding
 * four nodes and a level holding forty were drawn at the same pitch and the wide
 * one ran off the canvas. d3-hierarchy's tree() is the Reingold-Tilford
 * algorithm: it packs subtrees against each other by real width, which is what
 * keeps a 4,321-student organization legible without crossing lines.
 *
 * POSITIONS ARE CARD GEOMETRY, NOT RADII. Nodes render as rounded cards in the
 * flow view, so a position carries `w`/`h`. `r` is still computed because the
 * radial view draws circles and "fit to view" needs a bound for both.
 */

export type LayoutMode = 'hierarchy' | 'radial';

export interface NodePosition {
  key: string;
  /** Centre of the node, in graph space. */
  x: number;
  y: number;
  /** Circle radius — the radial view, and the fit-to-view bound. */
  r: number;
  /** Card size — the flow view. */
  w: number;
  h: number;
  /** Hops from the root. Drives the level bands and the ring radii. */
  depth: number;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  /**
   * Spanning-tree parent of each node. This is what path highlighting walks:
   * following it from any node reaches the root, and that chain IS the
   * "how did the organization get to this" answer the screen is for.
   */
  parents: Map<string, string | null>;
  /** Depth of each node, exposed so callers can band or indent without re-deriving. */
  depths: Map<string, number>;
}

export interface LayoutOptions {
  mode: LayoutMode;
  width: number;
  height: number;
  rootKey: string | null;
  /** Nodes the user has dragged. These win over the computed position. */
  pinned?: Map<string, { x: number; y: number }>;
}

/** Card footprint in the flow view. Wide enough for a title and a subtitle. */
export const CARD_W = 212;

export const CARD_H = 62;

/**
 * Gaps between cards.
 *
 * GAP_ALONG separates one level from the next (horizontally, since the flow
 * runs left to right); GAP_ACROSS separates siblings within a level. The
 * along-axis gap is generous because that is where the connectors live and a
 * cramped one turns a fan of edges into a smear.
 */
const GAP_ALONG = 96;

const GAP_ACROSS = 22;

/**
 * The shape a graph is aimed at: roughly as wide as a screen is wide.
 *
 * WHY WRAPPING EXISTS AT ALL. A tidy tree gives one column per hop, which is
 * perfect until one hop is wide: a real tenant put 16 nodes at depth 2, so the
 * picture came out 828 x 1633 — a ribbon four times taller than any screen with
 * most of the canvas empty either side. Fitting that meant scaling to 0.55 and
 * rendering 7px text, which is the "graph is tiny and too light" complaint.
 *
 * WHY THE LIMIT IS COMPUTED AND NOT A CONSTANT. A fixed cap only ever suits one
 * size of organization. Nine rows squared up a 28-node tenant beautifully and
 * left a 105-node one 3,604px wide and 734 tall — the same unreadable 0.55 fit,
 * just on the other axis. The cap is therefore chosen per graph, by trying each
 * candidate and keeping whichever lands closest to this ratio.
 *
 * IT IS DERIVED FROM THE DATA, NEVER FROM THE CONTAINER. Reading the viewport
 * here would put the container back into the layout and bring back the "graph
 * moves when the detail panel opens" bug. A constant target means two different
 * canvases still produce identical positions.
 */
const TARGET_ASPECT = 1.9;

/** Sub-columns of one level sit closer together than two different levels do. */
const SUBCOLUMN_STEP = CARD_W + GAP_ALONG * 0.42;

/** Distance between rings in the radial layout. */
const RING = 168;

interface TreeNode {
  key: string;
  depth: number;
  children: string[];
}

/**
 * A spanning tree by breadth-first search, plus every node's depth.
 *
 * Nodes with no path to the root — which happens when a filter or a collapse
 * leaves an island — become their own small tree, laid out beside the main one,
 * rather than dropped. A node that is on screen must have a position.
 */
function spanningTree(nodes: GraphNode[], edges: GraphEdge[], rootKey: string | null) {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.key, []);
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  }

  const treeMap = new Map<string, TreeNode>();
  const parents = new Map<string, string | null>();
  const root = rootKey && adjacency.has(rootKey) ? rootKey : nodes[0]?.key ?? null;
  if (!root) return { tree: treeMap, roots: [] as string[], parents };

  const roots: string[] = [];
  const seen = new Set<string>();

  const walk = (start: string) => {
    roots.push(start);
    treeMap.set(start, { key: start, depth: 0, children: [] });
    parents.set(start, null);
    seen.add(start);

    const queue = [start];
    while (queue.length) {
      const key = queue.shift()!;
      const here = treeMap.get(key)!;

      // Sorted, so sibling order is stable across renders and the picture does
      // not reshuffle when the same data arrives in a different order.
      for (const neighbour of [...(adjacency.get(key) ?? [])].sort()) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        treeMap.set(neighbour, { key: neighbour, depth: here.depth + 1, children: [] });
        parents.set(neighbour, key);
        here.children.push(neighbour);
        queue.push(neighbour);
      }
    }
  };

  walk(root);

  // Islands: each becomes its own small tree, laid out beside the main one.
  for (const node of nodes) {
    if (!seen.has(node.key)) walk(node.key);
  }

  return { tree: treeMap, roots, parents };
}

/**
 * Tidy-tree columns via d3-hierarchy, one run per root.
 *
 * Each island is laid out independently and then shifted clear of the one
 * before it, so separate trees read as separate instead of interleaving.
 */
function tidyColumns(treeMap: Map<string, TreeNode>, roots: string[]): Map<string, number> {
  const lane = new Map<string, number>();
  const layout = tree<string>()
    // The flow runs left to right, so the tidy pass spaces nodes ACROSS the
    // flow — down the screen — and one lane is a card height plus its gap.
    .nodeSize([CARD_H + GAP_ACROSS, 1])
    // Siblings sit a full gap apart; cousins get a little more air so the eye
    // can find the subtree boundary without a separator line.
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.35));

  let cursor = 0;

  for (const rootKey of roots) {
    const root = hierarchy<string>(rootKey, (key) => treeMap.get(key)?.children ?? []);
    const laid = layout(root);

    let min = Infinity;
    let max = -Infinity;
    laid.each((d) => {
      min = Math.min(min, d.x);
      max = Math.max(max, d.x);
    });
    if (!Number.isFinite(min)) continue;

    const shift = cursor - min;
    laid.each((d) => lane.set(d.data, d.x + shift));

    cursor = max + shift + CARD_H + GAP_ACROSS * 2;
  }

  return lane;
}

/**
 * Rows per column for THIS graph: the candidate whose resulting extent sits
 * closest to TARGET_ASPECT.
 *
 * The extent is computed arithmetically rather than by laying the graph out
 * once per candidate, so trying every option costs a few dozen multiplications.
 */
function chooseRowsPerColumn(levelSizes: number[]): number {
  const widest = Math.max(1, ...levelSizes);
  if (widest <= 1) return 1;

  let best = widest;
  let bestErr = Infinity;

  for (let rows = 1; rows <= widest; rows += 1) {
    let width = 0;
    let height = 0;

    for (const n of levelSizes) {
      const subColumns = Math.max(1, Math.ceil(n / rows));
      const used = Math.ceil(n / subColumns);
      width += (subColumns - 1) * SUBCOLUMN_STEP + CARD_W + GAP_ALONG;
      height = Math.max(height, used * (CARD_H + GAP_ACROSS));
    }

    if (height <= 0) continue;

    // Compared in log space so "twice too wide" and "twice too tall" are
    // penalised equally — in linear space the wide side dominates.
    const err = Math.abs(Math.log(width / height) - Math.log(TARGET_ASPECT));
    if (err < bestErr) {
      bestErr = err;
      best = rows;
    }
  }

  return best;
}

export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions,
): LayoutResult {
  const positions = new Map<string, NodePosition>();
  const depths = new Map<string, number>();
  if (nodes.length === 0) return { positions, parents: new Map(), depths };

  const { tree: treeMap, roots, parents } = spanningTree(nodes, edges, options.rootKey);
  const column = tidyColumns(treeMap, roots);

  const byKey = new Map(nodes.map((n) => [n.key, n]));

  for (const [key, node] of treeMap) depths.set(key, node.depth);

  if (options.mode === 'hierarchy') {
    /*
     * LEFT TO RIGHT, AND ANCHORED TO A FIXED ORIGIN — NOT TO THE CONTAINER.
     *
     * The previous version centred the tree on options.width, which made every
     * position a function of how wide the canvas happened to be. Two things
     * followed, and both were reported as "the graph keeps moving": selecting a
     * node opens the 372px detail panel, which narrows the canvas, which
     * recomputed every x and slid the whole picture sideways; and expanding a
     * branch changed the tree's own spread, which slid it again.
     *
     * Layout is now a pure function of the DATA. Centring is a viewport
     * concern, handled once by fit(), so resizing the window or opening the
     * panel changes what you are looking through, never where anything is.
     */
    /*
     * Group by depth, keeping the tidy pass's ordering. That ordering is what
     * keeps siblings next to each other and subtrees contiguous, so wrapping a
     * level into sub-columns splits it between subtrees rather than through
     * the middle of one.
     */
    const byDepth = new Map<number, string[]>();
    for (const [key, node] of treeMap) {
      if (!byKey.has(key)) continue;
      if (!byDepth.has(node.depth)) byDepth.set(node.depth, []);
      byDepth.get(node.depth)!.push(key);
    }
    for (const keys of byDepth.values()) {
      keys.sort((a, b) => (column.get(a) ?? 0) - (column.get(b) ?? 0));
    }

    /* Each depth claims an x band as wide as the sub-columns it needs, so two
       levels can never collide however wide either of them is. */
    const depths = [...byDepth.keys()].sort((a, b) => a - b);
    const rowsPerColumn = chooseRowsPerColumn(depths.map((d) => byDepth.get(d)!.length));
    let bandX = CARD_W / 2;

    for (const d of depths) {
      const keys = byDepth.get(d)!;
      const subColumns = Math.max(1, Math.ceil(keys.length / rowsPerColumn));
      const rows = Math.ceil(keys.length / subColumns);

      keys.forEach((key, i) => {
        const graphNode = byKey.get(key)!;
        const sub = Math.floor(i / rows);
        const row = i % rows;

        positions.set(key, {
          // Depth drives the horizontal axis: parents left, downstream right.
          x: bandX + sub * SUBCOLUMN_STEP,
          // Position within the level drives the vertical axis.
          y: CARD_H / 2 + row * (CARD_H + GAP_ACROSS),
          key,
          r: nodeRadius(graphNode),
          w: CARD_W,
          h: CARD_H,
          depth: d,
        });
      });

      bandX += (subColumns - 1) * SUBCOLUMN_STEP + CARD_W + GAP_ALONG;
    }
  } else {
    // Radial: one ring per hop, the root at the centre. A node's angle comes
    // from its tidy-tree column, so siblings stay adjacent and the ordering
    // matches the hierarchy view exactly — switching between the two moves
    // nothing around relative to anything else.
    // Origin-anchored for the same reason the flow view is: fit() centres the
    // viewport, so the ring does not move when the canvas resizes.
    const cx = 0;
    const cy = 0;

    let min = Infinity;
    let max = -Infinity;
    for (const x of column.values()) {
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
    const span = Math.max(1, max - min);

    for (const [key, node] of treeMap) {
      const graphNode = byKey.get(key);
      if (!graphNode) continue;

      const r = nodeRadius(graphNode);

      if (node.depth === 0) {
        positions.set(key, { key, x: cx, y: cy, r, w: CARD_W, h: CARD_H, depth: 0 });
        continue;
      }

      const angle = (((column.get(key) ?? 0) - min) / span) * Math.PI * 2 - Math.PI / 2;
      const radius = node.depth * RING;

      positions.set(key, {
        key,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r,
        w: CARD_W,
        h: CARD_H,
        depth: node.depth,
      });
    }
  }

  // A dragged node stays exactly where it was put.
  for (const [key, at] of options.pinned ?? []) {
    const existing = positions.get(key);
    if (existing) positions.set(key, { ...existing, x: at.x, y: at.y });
  }

  return { positions, parents, depths };
}

/**
 * The chain of nodes from the root down to `key`, inclusive.
 *
 * This is the whole of path highlighting: the answer to "where did this come
 * from" is the spanning-tree ancestry, and the spanning tree is BFS, so the
 * chain is also the SHORTEST route from the organization to the node. Returns
 * an empty array for a key that is not placed.
 */
export function rootPath(parents: Map<string, string | null>, key: string | null): string[] {
  if (!key || !parents.has(key)) return [];

  const path: string[] = [];
  const guard = new Set<string>();

  let cursor: string | null = key;
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    path.push(cursor);
    cursor = parents.get(cursor) ?? null;
  }

  return path.reverse();
}

/**
 * Everything downstream of `key`: its children, their children, and so on.
 *
 * rootPath answers "where did this come from"; this answers "where does it
 * lead". Together they are the full flow through a node, which is what the
 * screen highlights — hovering an intermediate node lights the whole chain in
 * both directions rather than just the half above it.
 *
 * Excludes `key` itself, so callers can union the three pieces explicitly.
 */
export function subtreeKeys(parents: Map<string, string | null>, key: string | null): string[] {
  if (!key) return [];

  // Invert once: the layout stores child -> parent, and this walk needs the
  // other direction.
  const children = new Map<string, string[]>();
  for (const [child, parent] of parents) {
    if (!parent) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(child);
  }

  const out: string[] = [];
  const seen = new Set<string>([key]);
  const queue = [key];

  while (queue.length) {
    const here = queue.shift()!;
    for (const child of children.get(here) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
      queue.push(child);
    }
  }

  return out;
}

/**
 * The complete flow through a node: everything upstream, the node, and
 * everything downstream. This is exactly what click and hover highlight.
 */
export function flowThrough(parents: Map<string, string | null>, key: string | null): Set<string> {
  if (!key) return new Set();
  return new Set([...rootPath(parents, key), ...subtreeKeys(parents, key)]);
}

/** The bounding box of everything placed, for "fit to view". */
export function layoutBounds(
  positions: Map<string, NodePosition>,
  fallback: { width: number; height: number },
  mode: LayoutMode = 'hierarchy',
) {
  if (positions.size === 0) return { minX: 0, minY: 0, maxX: fallback.width, maxY: fallback.height };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of positions.values()) {
    // A card is bounded by its own box; a circle by its radius plus room for
    // the label that hangs below it.
    const halfW = mode === 'hierarchy' ? p.w / 2 : p.r;
    const halfH = mode === 'hierarchy' ? p.h / 2 : p.r;
    const below = mode === 'hierarchy' ? 0 : 22;

    minX = Math.min(minX, p.x - halfW);
    minY = Math.min(minY, p.y - halfH);
    maxX = Math.max(maxX, p.x + halfW);
    maxY = Math.max(maxY, p.y + halfH + below);
  }

  return { minX, minY, maxX, maxY };
}
