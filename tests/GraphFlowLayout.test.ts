import { describe, expect, it } from 'vitest';
import {
  CARD_H, CARD_W, computeLayout, flowThrough, layoutBounds, rootPath, subtreeKeys,
} from '../src/components/graph/layout';
import type { GraphEdge, GraphNode } from '../src/components/graph/graphTypes';

/**
 * The flow layout and its path highlighting.
 *
 * These assert the three claims the redesigned Graph Explorer rests on: that a
 * level reads as a level (every node at the same depth shares an x, and siblings
 * never overlap); that the layout is a pure function of the DATA, so the picture
 * cannot move when the canvas resizes; and that the highlighted chain is the
 * real flow through a node — everything upstream AND everything downstream. All
 * are pure functions of nodes and edges, so they are testable without a DOM, a
 * server or a tenant.
 *
 * The fixture mirrors the shape the API actually returns for a school — an
 * organization, a department, a staff group, a student group and a signal —
 * rather than an abstract a/b/c tree, so a change that breaks the real payload
 * breaks this too.
 */

function node(key: string, label: string, extra: Partial<GraphNode> = {}): GraphNode {
  return {
    key,
    label,
    labels: [label],
    id: key.split(':')[1] ?? key,
    title: key,
    subtitle: null,
    family: 'organization',
    kind: 'entity',
    count: null,
    expandable: true,
    properties: {},
    deepLink: null,
    ...extra,
  } as GraphNode;
}

function edge(from: string, to: string, type = 'has_department'): GraphEdge {
  return {
    id: `${from}|${type}|${to}`,
    from,
    to,
    type,
    label: type.replace(/_/g, ' '),
    family: 'organizational',
    provenance: 'test fixture',
    note: null,
  };
}

const ORG = 'Organization:76';

const nodes: GraphNode[] = [
  node(ORG, 'Organization'),
  node('Department:157', 'Department'),
  node('Department:158', 'Department'),
  node('Group:person@Organization:76', 'Group', { kind: 'group', count: 374, groupOf: 'Person', family: 'people' }),
  node('Group:student@Organization:76', 'Group', { kind: 'group', count: 4321, groupOf: 'Student', family: 'student' }),
  node('Signal:abc', 'Signal', { family: 'intelligence' }),
];

const edges: GraphEdge[] = [
  edge(ORG, 'Department:157'),
  edge(ORG, 'Department:158'),
  edge(ORG, 'Group:person@Organization:76', 'employs'),
  edge(ORG, 'Group:student@Organization:76', 'enrolls'),
  edge('Group:student@Organization:76', 'Signal:abc', 'raised_signal'),
];

const options = { mode: 'hierarchy' as const, width: 1000, height: 700, rootKey: ORG };

describe('flow layout', () => {
  it('puts the organization on the left and every branch strictly right of it', () => {
    const { positions } = computeLayout(nodes, edges, options);

    const org = positions.get(ORG)!;
    expect(org).toBeDefined();

    for (const [key, p] of positions) {
      if (key === ORG) continue;
      expect(p.x).toBeGreaterThan(org.x);
    }
  });

  /*
   * A level owns an x band. It is usually one column, but a wide level wraps
   * into sub-columns so it does not become a ribbon taller than any screen —
   * so the assertion is that the bands stay SEPARATE, not that each is a single
   * column. Overlapping bands would be what actually breaks the reading.
   */
  it('keeps each depth in its own x band, never overlapping the next', () => {
    const { positions, depths } = computeLayout(nodes, edges, options);

    const band = new Map<number, { min: number; max: number }>();
    for (const [key, p] of positions) {
      const d = depths.get(key)!;
      const b = band.get(d);
      if (!b) band.set(d, { min: p.x, max: p.x });
      else { b.min = Math.min(b.min, p.x); b.max = Math.max(b.max, p.x); }
    }

    const ordered = [...band.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ordered.length; i += 1) {
      // The next level starts at least a full card clear of the previous one.
      expect(ordered[i][1].min - ordered[i - 1][1].max).toBeGreaterThanOrEqual(CARD_W);
    }
  });

  it('never overlaps two cards anywhere', () => {
    const { positions } = computeLayout(nodes, edges, options);
    const all = [...positions.values()];

    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const apart = Math.abs(all[i].x - all[j].x) >= CARD_W
          || Math.abs(all[i].y - all[j].y) >= CARD_H;
        expect(apart).toBe(true);
      }
    }
  });

  /*
   * The layout must not depend on the canvas it is drawn into. Centring is a
   * viewport concern; when it leaked into the positions, opening the 372px
   * detail panel narrowed the canvas and slid the whole graph sideways.
   */
  it('produces identical positions at any container size', () => {
    const narrow = computeLayout(nodes, edges, { ...options, width: 600, height: 400 });
    const wide = computeLayout(nodes, edges, { ...options, width: 1900, height: 1200 });

    for (const [key, p] of narrow.positions) {
      const q = wide.positions.get(key)!;
      expect(q.x).toBe(p.x);
      expect(q.y).toBe(p.y);
    }
  });

  it('reports card geometry, not just a radius', () => {
    const { positions } = computeLayout(nodes, edges, options);
    const p = positions.get('Department:157')!;
    expect(p.w).toBe(CARD_W);
    expect(p.h).toBe(CARD_H);
  });

  it('places every node it was given, including a disconnected island', () => {
    const island = node('Signal:orphan', 'Signal', { family: 'intelligence' });
    const { positions } = computeLayout([...nodes, island], edges, options);

    expect(positions.size).toBe(nodes.length + 1);
    expect(positions.get('Signal:orphan')).toBeDefined();
  });
});

describe('root path highlighting', () => {
  it('walks a node back to the organization', () => {
    const { parents } = computeLayout(nodes, edges, options);

    expect(rootPath(parents, 'Signal:abc')).toEqual([
      ORG,
      'Group:student@Organization:76',
      'Signal:abc',
    ]);
  });

  it('gives the root a path of just itself', () => {
    const { parents } = computeLayout(nodes, edges, options);
    expect(rootPath(parents, ORG)).toEqual([ORG]);
  });

  it('returns nothing for a node that is not on the graph', () => {
    const { parents } = computeLayout(nodes, edges, options);
    expect(rootPath(parents, 'Student:nope')).toEqual([]);
    expect(rootPath(parents, null)).toEqual([]);
  });

  it('takes the shortest route when a node is reachable two ways', () => {
    // The signal hangs off the student group AND directly off the organization.
    // BFS must prefer the one-hop route, because the highlight claims to be the
    // most direct path from the organization.
    const { parents } = computeLayout(
      nodes,
      [...edges, edge(ORG, 'Signal:abc', 'generated')],
      options,
    );

    expect(rootPath(parents, 'Signal:abc')).toEqual([ORG, 'Signal:abc']);
  });
});

describe('downstream highlighting', () => {
  it('finds everything below a node', () => {
    const { parents } = computeLayout(nodes, edges, options);
    expect(subtreeKeys(parents, 'Group:student@Organization:76')).toEqual(['Signal:abc']);
  });

  it('gives a leaf no descendants', () => {
    const { parents } = computeLayout(nodes, edges, options);
    expect(subtreeKeys(parents, 'Signal:abc')).toEqual([]);
  });

  it('lights the whole chain through an intermediate node, both directions', () => {
    const { parents } = computeLayout(nodes, edges, options);
    const lit = flowThrough(parents, 'Group:student@Organization:76');

    // upstream, self and downstream
    expect(lit.has(ORG)).toBe(true);
    expect(lit.has('Group:student@Organization:76')).toBe(true);
    expect(lit.has('Signal:abc')).toBe(true);

    // an unrelated branch stays dark
    expect(lit.has('Department:157')).toBe(false);
  });

  it('lights the entire graph from the root', () => {
    const { parents, positions } = computeLayout(nodes, edges, options);
    expect(flowThrough(parents, ORG).size).toBe(positions.size);
  });
});

describe('fit to view', () => {
  it('bounds cards by their box in the flow view', () => {
    const { positions } = computeLayout(nodes, edges, options);
    const b = layoutBounds(positions, { width: 1000, height: 700 }, 'hierarchy');

    const org = positions.get(ORG)!;
    expect(b.minX).toBeLessThanOrEqual(org.x - CARD_W / 2);
    expect(b.maxX - b.minX).toBeGreaterThanOrEqual(CARD_W);
  });

  it('falls back to the canvas when there is nothing placed', () => {
    const b = layoutBounds(new Map(), { width: 800, height: 600 });
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 800, maxY: 600 });
  });
});
