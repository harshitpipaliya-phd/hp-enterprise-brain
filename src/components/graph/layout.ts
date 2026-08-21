import type { GraphEdge, GraphNode } from './graphTypes';
import { nodeRadius } from './graphTypes';

/**
 * The graph layout. A force simulation, written out rather than imported.
 *
 * WHY NOT A LIBRARY. The project ships two runtime dependencies for the whole
 * SPA — react and lucide-react, plus recharts for charts — and the smallest
 * credible graph package (d3-force alone, before any renderer) is larger than
 * all of this file. What is needed here is four forces and a cooling schedule
 * over at most a couple of hundred nodes, which is the code below. Nothing is
 * abstracted for a second caller because there is no second caller.
 *
 * THE FOUR FORCES, and what each is for:
 *
 *   REPULSION   every node pushes every other away, so labels do not stack.
 *               Capped at a radius, which also makes it O(n·k) rather than
 *               O(n²) in practice for the clustered graphs this produces.
 *   SPRINGS     every edge pulls its ends toward a rest length. Rest length
 *               grows with the radii of the two ends, so a big organization
 *               node does not swallow its neighbours.
 *   GRAVITY     a weak pull toward the centre, so a disconnected branch cannot
 *               drift off-canvas.
 *   ANCHORING   the root is pinned at the centre and a dragged node is pinned
 *               under the pointer. Everything else settles around them.
 *
 * IT RUNS TO A STOP. Alpha decays geometrically and the simulation halts below
 * a threshold, so an idle graph costs nothing — a permanently running rAF loop
 * behind a screen the user has stopped looking at is a battery bug, not an
 * animation.
 *
 * POSITIONS SURVIVE A RELOAD OF THE DATA. `seed` carries the previous positions
 * in, so expanding a node grows the graph outward from where the user was
 * looking instead of rearranging everything they had just made sense of.
 */

export interface Positioned {
  key: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Pinned nodes are moved by the user or by the layout's own anchoring. */
  fixed: boolean;
}

export interface LayoutOptions {
  width: number;
  height: number;
  /** Pinned at the centre. Usually the organization. */
  rootKey?: string | null;
  /** Previous positions, so an expansion does not reshuffle the whole canvas. */
  seed?: Map<string, { x: number; y: number }>;
}

const REPULSION = 5200;
const REPULSION_RANGE = 420;
const SPRING = 0.045;
const GRAVITY = 0.014;
const DAMPING = 0.86;
const ALPHA_DECAY = 0.965;
const ALPHA_MIN = 0.006;

/**
 * Place new nodes near the neighbour that introduced them.
 *
 * A node dropped at a random point flies across the canvas on the first tick,
 * which reads as the graph exploding every time anything is expanded. Starting
 * it just outside its parent means expansion looks like growth.
 */
function seedPositions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions,
): Map<string, Positioned> {
  const cx = options.width / 2;
  const cy = options.height / 2;
  const placed = new Map<string, Positioned>();

  const neighbours = new Map<string, string[]>();
  for (const edge of edges) {
    if (!neighbours.has(edge.to)) neighbours.set(edge.to, []);
    if (!neighbours.has(edge.from)) neighbours.set(edge.from, []);
    neighbours.get(edge.to)!.push(edge.from);
    neighbours.get(edge.from)!.push(edge.to);
  }

  // Index-derived angles rather than Math.random(): the same graph laid out
  // twice looks the same, which matters when a reader reloads to check a figure.
  nodes.forEach((node, i) => {
    const previous = options.seed?.get(node.key);
    const r = nodeRadius(node);

    if (previous) {
      placed.set(node.key, { key: node.key, x: previous.x, y: previous.y, vx: 0, vy: 0, r, fixed: false });
      return;
    }

    const anchor = (neighbours.get(node.key) ?? [])
      .map((k) => options.seed?.get(k))
      .find(Boolean);

    const angle = (i * 2.399963) % (Math.PI * 2); // golden angle — even spread
    const spread = anchor ? 90 : Math.min(options.width, options.height) * 0.3;
    const originX = anchor ? anchor.x : cx;
    const originY = anchor ? anchor.y : cy;

    placed.set(node.key, {
      key: node.key,
      x: originX + Math.cos(angle) * spread,
      y: originY + Math.sin(angle) * spread,
      vx: 0,
      vy: 0,
      r,
      fixed: false,
    });
  });

  const root = options.rootKey ? placed.get(options.rootKey) : undefined;
  if (root) {
    root.x = cx;
    root.y = cy;
    root.fixed = true;
  }

  return placed;
}

/**
 * One simulation, ticked by the caller.
 *
 * Stateful on purpose: the canvas drives it from a rAF loop and drags a node
 * mid-flight, neither of which a pure function expresses well.
 */
export class GraphLayout {
  private positions: Map<string, Positioned>;

  private edges: GraphEdge[];

  private alpha = 1;

  private options: LayoutOptions;

  constructor(nodes: GraphNode[], edges: GraphEdge[], options: LayoutOptions) {
    this.options = options;
    this.edges = edges;
    this.positions = seedPositions(nodes, edges, options);
  }

  /**
   * Replace the graph without losing where the user was.
   *
   * Nodes that survive keep their exact position; nodes that arrived are seeded
   * beside a neighbour. The simulation is only partly reheated — a full reset
   * would fling the settled part of the graph apart to accommodate three new
   * circles.
   */
  update(nodes: GraphNode[], edges: GraphEdge[], options: LayoutOptions): void {
    const seed = new Map<string, { x: number; y: number }>();
    for (const [key, p] of this.positions) seed.set(key, { x: p.x, y: p.y });

    const dragged = [...this.positions.values()].filter((p) => p.fixed && p.key !== options.rootKey);

    this.options = options;
    this.edges = edges;
    this.positions = seedPositions(nodes, edges, { ...options, seed });

    // A node the user is holding stays held across a data change.
    for (const p of dragged) {
      const next = this.positions.get(p.key);
      if (next) {
        next.x = p.x;
        next.y = p.y;
        next.fixed = true;
      }
    }

    this.alpha = Math.max(this.alpha, 0.55);
  }

  resize(width: number, height: number): void {
    this.options = { ...this.options, width, height };
    const root = this.options.rootKey ? this.positions.get(this.options.rootKey) : undefined;
    if (root) {
      root.x = width / 2;
      root.y = height / 2;
    }
    this.alpha = Math.max(this.alpha, 0.35);
  }

  get settled(): boolean {
    return this.alpha < ALPHA_MIN;
  }

  reheat(to = 0.9): void {
    this.alpha = Math.max(this.alpha, to);
  }

  position(key: string): Positioned | undefined {
    return this.positions.get(key);
  }

  all(): Positioned[] {
    return [...this.positions.values()];
  }

  snapshot(): Map<string, { x: number; y: number }> {
    const out = new Map<string, { x: number; y: number }>();
    for (const [key, p] of this.positions) out.set(key, { x: p.x, y: p.y });
    return out;
  }

  pin(key: string, x: number, y: number): void {
    const p = this.positions.get(key);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.fixed = true;
    this.reheat(0.35);
  }

  release(key: string): void {
    const p = this.positions.get(key);
    if (!p || key === this.options.rootKey) return;
    p.fixed = false;
  }

  /** One step. Returns false once the graph has stopped moving. */
  tick(): boolean {
    if (this.settled) return false;

    const nodes = [...this.positions.values()];
    const cx = this.options.width / 2;
    const cy = this.options.height / 2;

    for (const node of nodes) {
      node.vx *= DAMPING;
      node.vy *= DAMPING;
    }

    // Repulsion. Capped range, and a floor on the distance so two nodes landing
    // on the same point produce a nudge rather than a division by zero.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > REPULSION_RANGE) continue;

        if (dist < 0.01) {
          dx = (i - j) * 0.5 || 0.5;
          dy = 0.5;
          dist = Math.sqrt(dx * dx + dy * dy);
        }

        // Scaled by the radii, so large nodes claim proportionate space.
        const strength = (REPULSION * (a.r + b.r)) / (34 * dist * dist);
        const fx = (dx / dist) * strength;
        const fy = (dy / dist) * strength;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Springs.
    for (const edge of this.edges) {
      const a = this.positions.get(edge.from);
      const b = this.positions.get(edge.to);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
      const rest = a.r + b.r + 78;
      const force = (dist - rest) * SPRING;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Gravity, and integration.
    for (const node of nodes) {
      if (node.fixed) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      node.vx += (cx - node.x) * GRAVITY;
      node.vy += (cy - node.y) * GRAVITY;
      node.x += node.vx * this.alpha;
      node.y += node.vy * this.alpha;
    }

    this.alpha *= ALPHA_DECAY;

    return true;
  }

  /**
   * The bounding box of everything placed, padded by the node radii.
   *
   * Used by "fit to view", which is the control that rescues a reader who has
   * zoomed or panned into empty space.
   */
  bounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const nodes = [...this.positions.values()];

    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: this.options.width, maxY: this.options.height };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.r);
      minY = Math.min(minY, n.y - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }

    return { minX, minY, maxX, maxY };
  }
}
