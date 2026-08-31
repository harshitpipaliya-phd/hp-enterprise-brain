import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BarChart3, Crosshair, Expand, GitBranch, Loader2, Maximize2, Network, Orbit,
  PieChart, RefreshCw, Search, Shrink, SlidersHorizontal, Target, X,
} from 'lucide-react';
import { graphApi } from '../../api/graph';
import type { View } from '../../App';
import { ErrorState, HeaderActions, HeaderOverflowMenu, PageHeader } from '../../ui';
import { GraphBreakdown } from '../graph/GraphBreakdown';
import { GraphCanvas } from '../graph/GraphCanvas';
import { GraphSunburst } from '../graph/GraphSunburst';
import { GraphDetailPanel } from '../graph/GraphDetailPanel';
import type { LayoutMode } from '../graph/layout';
import type {
  EdgeFamily, GraphAvailability, GraphEdge, GraphFocus, GraphNode, GraphNodeDetail,
  GraphOverview, GraphSummary, NodeFamily,
} from '../graph/graphTypes';
import { EDGE_FAMILY_LABEL, FAMILY_COLOR, FAMILY_LABEL } from '../graph/graphTypes';
import '../graph/graph.css';

/**
 * GRAPH EXPLORER — the visual connection layer.
 *
 * WHAT IT ANSWERS. What is connected to this? Why is it connected? What data
 * produced this intelligence? What evidence supports it? Every answer on this
 * screen is a row or an aggregate over rows belonging to the signed-in
 * organization, read through GraphProjection, which composes the services that
 * already own each figure rather than querying around them. There is no sample
 * data path and no placeholder number anywhere in this file.
 *
 * IT OPENS ON THE ORGANIZATION, NOT ON A SEARCH BOX. The previous version of
 * this screen rendered "Search for an entity to begin exploring the graph" and
 * required the user to already know the name of something before it would show
 * them anything. The graph now loads the caller's own organization and the
 * branches it genuinely has — and only those: an organization with staff and no
 * students has no student branch, because a zero invites the reader to wonder
 * what went wrong with an import that never happened.
 *
 * SIZE IS HANDLED ON THE SERVER, NOT HERE. Populations arrive as GROUP nodes
 * carrying a COUNT and are expanded a page at a time; the projection refuses to
 * exceed its node budget whatever a query returns. A school with 7,445 children
 * opens as fast as one with forty, and the client never receives a cohort.
 *
 * FILTERS DIM, THEY DO NOT DELETE. Hiding a node also hides the edges that
 * explain the ones still on screen, which turns a filtered graph into a
 * misleading one. Filtered nodes stay in place, faded, so the shape of what has
 * been set aside is still visible.
 */

interface GraphExplorerProps {
  tenantId: string;
  organizationName?: string;
  /** A node another screen asked to open on — see "Explore in Graph". */
  focus?: GraphFocus | null;
  /** Navigate to the screen that owns an entity. */
  onNavigate?: (view: View) => void;
}

/**
 * DATA QUALITY — how much of the organization the picture is actually showing.
 *
 * WHY IT IS A PANEL AND NOT A WARNING STRIP. The information here is the single
 * most misreadable thing on the screen: a graph drawing 25 of 4,321 students
 * looks exactly like a graph drawing all of them unless it says so. The old
 * form ran the figures together into one sentence — "25 of 4,321 students drawn
 * / 25 of 15,006 evidence drawn" — which reads as a footnote, and a footnote is
 * the wrong weight for "you are looking at half a percent of this".
 *
 * Each kind now gets its own row with a coverage bar, so the shortfall is
 * legible at a glance and comparable BETWEEN kinds. Nothing is hidden and no
 * figure is rounded away: shown and total are printed exactly as the server
 * reported them.
 */
function DataQualityPanel({ truncations }: { truncations: GraphOverview['truncated'] }) {
  return (
    <section className="gx-dq" aria-labelledby="gx-dq-title">
      <span className="gx-dq__title" id="gx-dq-title">
        <AlertTriangle size={13} aria-hidden="true" />
        Data quality
      </span>

      <ul className="gx-dq__list">
        {truncations.map((t) => {
          const pct = t.total > 0 ? Math.min(100, (t.shown / t.total) * 100) : 0;

          return (
            <li className="gx-dq__item" key={t.kind}>
              <span className="gx-dq__kind">{t.kind}</span>
              <span className="gx-dq__bar" aria-hidden="true">
                <span className="gx-dq__fill" style={{ width: `${Math.max(pct, 2)}%` }} />
              </span>
              <span className="gx-dq__figure">
                <strong>{t.shown.toLocaleString()}</strong>
                <span className="gx-dq__of">/ {t.total.toLocaleString()}</span>
                <span className="gx-dq__pct">{pct < 1 ? '<1' : Math.round(pct)}%</span>
              </span>
            </li>
          );
        })}
      </ul>

      <span className="gx-dq__hint">Expand a node to load more</span>
    </section>
  );
}

/** The intelligence branches the overview may include. Matches the API. */
const INTELLIGENCE_BRANCHES = [
  { key: 'signals', label: 'Signals' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'capabilities', label: 'Capabilities' },
  { key: 'cases', label: 'Cases' },
  { key: 'decisions', label: 'Decisions' },
] as const;

const NODE_FAMILIES: NodeFamily[] = ['organization', 'people', 'student', 'academic', 'intelligence'];
const EDGE_FAMILIES: EdgeFamily[] = ['organizational', 'people', 'academic', 'intelligence'];

export default function GraphExplorer({ tenantId, organizationName, focus, onNavigate }: GraphExplorerProps) {
  /* ------------------------------------------------------------- graph state */

  const [nodes, setNodes] = useState<Map<string, GraphNode>>(new Map());
  const [edges, setEdges] = useState<Map<string, GraphEdge>>(new Map());
  const [rootKey, setRootKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [available, setAvailable] = useState<GraphAvailability | null>(null);
  const [truncations, setTruncations] = useState<GraphOverview['truncated']>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  /* Bumped by the Focus control. Selecting a node no longer moves the viewport
     on its own, so recentring on it is an explicit request. */
  const [focusToken, setFocusToken] = useState(0);

  /* ------------------------------------------------------------- controls */

  /*
    HOW THE GRAPH IS DRAWN, and it is the reader's choice rather than the
    layout engine's.

    'hierarchy' — shown as INTELLIGENCE FLOW — is the default because it is the
    one that answers the question this screen exists for without any training:
    the organization on the LEFT, each hop a column to its right, and the loop's
    own signals and recommendations at the far right where the flow lands. It
    draws cards on a tidy tree, so a column of four and a column of forty are
    both legible. 'radial' — shown as DATA RELATIONSHIPS — is the same tree bent
    into rings, which is more compact when the graph is wide and is the better
    shape for asking what touches what rather than what came from what.
    'sunburst' — shown as COMPOSITION — is the same tree again as nested rings,
    which answers which branch is most of the organization. 'bars' abandons the
    node-link picture entirely for quantities, which is the honest form for "how
    many of each are there" — a question circles and lines answer badly.

    All four read the same nodes, edges and totals, so they cannot disagree.
  */
  const [viewMode, setViewMode] = useState<LayoutMode | 'bars' | 'sunburst'>('hierarchy');
  const [depth, setDepth] = useState(2);
  const [include, setInclude] = useState<string[]>(INTELLIGENCE_BRANCHES.map((b) => b.key));
  const [nodeFilter, setNodeFilter] = useState<Set<NodeFamily>>(new Set(NODE_FAMILIES));
  const [edgeFilter, setEdgeFilter] = useState<Set<EdgeFamily>>(new Set(EDGE_FAMILIES));
  const [showFilters, setShowFilters] = useState(false);

  /* The two node-link views. Bars and the sunburst have no viewport, so the
     zoom / fit / expand controls do not apply to them. */
  const isCanvasView = viewMode === 'hierarchy' || viewMode === 'radial';

  /* ------------------------------------------------------------- selection */

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<GraphNodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  /** True while "Expand all" is working through its round. */
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  /* ------------------------------------------------------------- search */

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GraphNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);

  /* Guards every async write, so a response that arrives after the user has
     changed organization or unmounted the screen cannot land. */
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  /* ------------------------------------------------------------- merging */

  /**
   * Merge a payload into the graph.
   *
   * EXISTING NODES ARE NOT OVERWRITTEN. An expansion response carries a
   * placeholder for the group it came from so its edges have something to hang
   * from; that placeholder has no count. Letting it replace the real node would
   * turn a population of 7,445 into a zero on screen.
   */
  const merge = useCallback((incoming: { nodes: GraphNode[]; edges: GraphEdge[] }, replace = false) => {
    setNodes((current) => {
      const next = replace ? new Map<string, GraphNode>() : new Map(current);
      for (const node of incoming.nodes) {
        const existing = next.get(node.key);
        if (existing && (node.properties as { placeholder?: boolean })?.placeholder) continue;
        if (existing && existing.kind === 'group' && node.kind === 'group' && node.count === 0) continue;
        next.set(node.key, existing ? { ...node, count: node.count ?? existing.count } : node);
      }
      return next;
    });

    setEdges((current) => {
      const next = replace ? new Map<string, GraphEdge>() : new Map(current);
      for (const edge of incoming.edges) next.set(edge.id, edge);
      return next;
    });
  }, []);

  /* ------------------------------------------------------------- loading */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const overview = await graphApi.overview(tenantId, depth, include);
      if (!liveRef.current) return;

      if (overview.error) {
        setError(overview.message || 'The graph could not be built for this organization.');
        setLoading(false);
        return;
      }

      merge(overview, true);
      setRootKey(overview.root?.key ?? null);
      setSummary(overview.summary);
      setAvailable(overview.available);
      setTruncations(overview.truncated ?? []);
      setExpandedKeys(new Set());
      setFitToken((n) => n + 1);
    } catch (e: any) {
      if (!liveRef.current) return;
      setError(e?.message ?? 'Could not reach the server to build the graph.');
    } finally {
      if (liveRef.current) setLoading(false);
    }
  }, [tenantId, depth, include, merge]);

  useEffect(() => { void load(); }, [load]);

  /* ------------------------------------------------------------- expansion */

  const expand = useCallback(async (node: GraphNode, offset = 0) => {
    if (!node.expandable) return;
    setBusyKey(node.key);

    try {
      const expansion = await graphApi.expand(tenantId, node.kind === 'group' ? 'Group' : node.label, node.id, offset, include);
      if (!liveRef.current) return;

      if (expansion.error) {
        setDetailError(expansion.message || 'Those connections could not be read.');
        return;
      }

      merge(expansion);
      setExpandedKeys((current) => new Set(current).add(node.key));
      setTruncations((current) => {
        const byKind = new Map(current.map((t) => [t.kind, t]));
        for (const t of expansion.truncated ?? []) byKind.set(t.kind, t);
        return [...byKind.values()];
      });
    } catch (e: any) {
      if (liveRef.current) setDetailError(e?.message ?? 'Those connections could not be read.');
    } finally {
      if (liveRef.current) setBusyKey(null);
    }
  }, [tenantId, include, merge]);

  /**
   * Collapse: drop everything reachable ONLY through this node.
   *
   * A neighbour that is also reachable from somewhere else stays, because it is
   * still genuinely on the graph — removing it would delete a connection the
   * user never asked to hide. Computed by walking out from the root with this
   * node's own onward edges removed; whatever is no longer reachable goes.
   */
  const collapse = useCallback((node: GraphNode) => {
    if (!rootKey) return;

    const adjacency = new Map<string, string[]>();
    for (const edge of edges.values()) {
      if (edge.from === node.key || edge.to === node.key) continue;
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
      adjacency.get(edge.from)!.push(edge.to);
      adjacency.get(edge.to)!.push(edge.from);
    }

    const keep = new Set<string>([rootKey, node.key]);
    const queue = [rootKey];
    while (queue.length) {
      const key = queue.shift()!;
      for (const neighbour of adjacency.get(key) ?? []) {
        if (keep.has(neighbour)) continue;
        keep.add(neighbour);
        queue.push(neighbour);
      }
    }

    setNodes((current) => new Map([...current].filter(([key]) => keep.has(key))));
    setEdges((current) => new Map([...current].filter(([, edge]) => keep.has(edge.from) && keep.has(edge.to))));
    setExpandedKeys((current) => {
      const next = new Set(current);
      next.delete(node.key);
      return next;
    });
    if (selectedKey && !keep.has(selectedKey)) setSelectedKey(null);
  }, [edges, rootKey, selectedKey]);

  /**
   * Expand all — ONE round, over the nodes that are on screen right now.
   *
   * Deliberately not recursive. Expanding until nothing is expandable would
   * walk a 4,321-student organization node by node and produce exactly the
   * unreadable wall this screen was rebuilt to stop being. One round opens
   * every branch the reader can currently see, which is what they are actually
   * asking for, and it stays bounded however large the organization is.
   *
   * Sequential rather than parallel: each expansion merges into the same node
   * and edge maps, and the server pages a group's members from an offset. A
   * burst of concurrent calls would race on both.
   */
  const expandAll = useCallback(async () => {
    const targets = [...nodes.values()].filter((node) => node.expandable && !expandedKeys.has(node.key));
    if (targets.length === 0) return;

    setBulkBusy(true);
    try {
      for (const node of targets) {
        if (!liveRef.current) return;
        await expand(node);
      }
      if (liveRef.current) setFitToken((n) => n + 1);
    } finally {
      if (liveRef.current) setBulkBusy(false);
    }
  }, [nodes, expandedKeys, expand]);

  /**
   * Collapse all — back to the graph the screen opened on.
   *
   * This is load(), not a client-side prune: the opening graph is the server's
   * answer to "what branches does this organization genuinely have", and
   * re-asking is both simpler and truer than trying to reconstruct it by
   * deleting nodes here.
   */
  const collapseAll = useCallback(() => {
    setSelectedKey(null);
    void load();
  }, [load]);

  /* ------------------------------------------------------------- selection */

  const select = useCallback(async (node: GraphNode) => {
    setSelectedKey(node.key);
    setDetail(null);
    setDetailError(null);

    // A group is an aggregate, not a row: there is nothing to look up, and the
    // panel says what it stands for instead.
    if (node.kind === 'group') return;

    setDetailLoading(true);
    try {
      const loaded = await graphApi.node(tenantId, node.label, node.id);
      if (!liveRef.current) return;
      setDetail(loaded);
    } catch (e: any) {
      if (liveRef.current) setDetailError(e?.message ?? 'This record could not be read.');
    } finally {
      if (liveRef.current) setDetailLoading(false);
    }
  }, [tenantId]);

  const selectByKey = useCallback((key: string) => {
    const node = nodes.get(key);
    if (node) void select(node);
  }, [nodes, select]);

  /* ------------------------------------------------- focus from elsewhere */

  const focusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focus || loading || !rootKey) return;

    const key = `${focus.label}:${focus.id}`;
    if (focusRef.current === key) return;
    focusRef.current = key;

    // "Explore in Graph" hands us a node the overview may not contain — a
    // specific student out of seven thousand. Expanding it brings it and its
    // neighbours in, then it is selected and centred.
    void (async () => {
      const existing = nodes.get(key);

      if (existing) {
        await select(existing);
        await expand(existing);
        return;
      }

      try {
        const expansion = await graphApi.expand(tenantId, focus.label, focus.id, 0, include);
        if (!liveRef.current || expansion.error) return;

        merge(expansion);
        setExpandedKeys((current) => new Set(current).add(key));

        const landed = expansion.nodes.find((n) => n.key === key);
        if (landed) await select(landed);
        setFitToken((n) => n + 1);
      } catch {
        // A focus that cannot be resolved leaves the organization graph as it
        // is. That is the honest outcome: the entity is not this tenant's.
      }
    })();
  }, [focus, loading, rootKey, nodes, tenantId, include, select, expand, merge]);

  /* ------------------------------------------------------------- search */

  useEffect(() => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);

    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const response = await graphApi.search(tenantId, term);
        if (!liveRef.current) return;
        setResults(response.results ?? []);
      } catch {
        if (liveRef.current) setResults([]);
      } finally {
        if (liveRef.current) setSearching(false);
      }
    }, 280);

    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, [query, tenantId]);

  /**
   * Choosing a search result CENTRES the graph on it. It does not navigate
   * away — leaving the screen is the user's decision, taken with "Open full
   * record" in the panel.
   */
  const openResult = useCallback(async (node: GraphNode) => {
    setQuery('');
    setResults(null);

    const existing = nodes.get(node.key);
    if (existing) {
      await select(existing);
      return;
    }

    merge({ nodes: [node], edges: [] });
    await select(node);
    await expand(node);
    setFitToken((n) => n + 1);
  }, [nodes, select, expand, merge]);

  /* ------------------------------------------------------------- derived */

  const nodeList = useMemo(() => [...nodes.values()], [nodes]);
  const edgeList = useMemo(
    () => [...edges.values()].filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
    [edges, nodes],
  );

  const dimmedKeys = useMemo(() => {
    const dimmed = new Set<string>();
    const visibleEdgeFamilies = edgeFilter;

    for (const node of nodeList) {
      if (!nodeFilter.has(node.family)) dimmed.add(node.key);
    }

    // A node reachable only by a filtered-out relationship is dimmed too — the
    // relationship filter would otherwise change nothing visible.
    if (visibleEdgeFamilies.size < EDGE_FAMILIES.length) {
      for (const node of nodeList) {
        if (node.key === rootKey || dimmed.has(node.key)) continue;
        const touching = edgeList.filter((e) => e.from === node.key || e.to === node.key);
        if (touching.length > 0 && !touching.some((e) => visibleEdgeFamilies.has(e.family))) {
          dimmed.add(node.key);
        }
      }
    }

    return dimmed;
  }, [nodeList, edgeList, nodeFilter, edgeFilter, rootKey]);

  const selectedNode = selectedKey ? nodes.get(selectedKey) ?? null : null;
  const selectedEdges = useMemo(
    () => (selectedKey ? edgeList.filter((e) => e.from === selectedKey || e.to === selectedKey) : []),
    [edgeList, selectedKey],
  );

  const toggle = <T,>(set: Set<T>, value: T, apply: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    // Never let the last one be turned off — an empty canvas with every chip
    // grey reads as a broken screen rather than as a filter.
    if (next.size === 0) return;
    apply(next);
  };

  /* ------------------------------------------------------------- render */

  if (error && nodeList.length === 0) {
    return (
      <div className="gx-page">
        <ErrorState message={error} onRetry={() => { void load(); }} />
      </div>
    );
  }

  return (
    <div className="gx-page">
      {/*
        THE DRAWING MODE IS NOT AN ACTION, so it no longer sits in the action
        row. Four mode buttons beside six controls gave this screen ten equally
        loud buttons and no primary; the modes are a view state and belong under
        the title, and the four canvas manipulations that only apply to a canvas
        view moved behind the overflow menu.
      */}
      <PageHeader
        variant="intelligence"
        icon={<Network />}
        title="Graph Explorer"
        description={(
          <>
            {organizationName ? <strong>{organizationName}</strong> : 'This organization'} and everything the connected
            source systems record about it. Every node is a row; every edge names the column that joins them.
          </>
        )}
        actions={(
          <HeaderActions>
            <button
              type="button"
              className={`u-btn u-btn-secondary${showFilters ? ' gx-btn--on' : ''}`}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filters
            </button>
            <button type="button" className="u-btn u-btn-secondary" onClick={() => { setSelectedKey(null); void load(); }}>
              <RefreshCw size={14} aria-hidden="true" />
              Reset
            </button>
            {isCanvasView && (
              <HeaderOverflowMenu
                label="Canvas controls"
                items={[
                  {
                    label: bulkBusy ? 'Expanding…' : 'Expand all',
                    icon: bulkBusy
                      ? <Loader2 size={15} className="gx-spin" aria-hidden="true" />
                      : <Expand size={15} aria-hidden="true" />,
                    disabled: bulkBusy || loading,
                    onSelect: () => { void expandAll(); },
                  },
                  {
                    label: 'Collapse all',
                    icon: <Shrink size={15} aria-hidden="true" />,
                    disabled: bulkBusy || loading,
                    onSelect: collapseAll,
                  },
                  {
                    label: 'Focus selected node',
                    icon: <Target size={15} aria-hidden="true" />,
                    disabled: !selectedKey,
                    onSelect: () => setFocusToken((n) => n + 1),
                  },
                  {
                    label: 'Fit to view',
                    icon: <Maximize2 size={15} aria-hidden="true" />,
                    onSelect: () => setFitToken((n) => n + 1),
                  },
                ]}
              />
            )}
          </HeaderActions>
        )}
      >
        <div className="gx-modes" role="group" aria-label="How to draw the graph">
          {([
            ['hierarchy', 'Intelligence Flow', GitBranch],
            ['radial', 'Data Relationships', Orbit],
            ['sunburst', 'Composition', PieChart],
            ['bars', 'Bar Chart', BarChart3],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              className={`gx-mode${viewMode === value ? ' gx-mode--on' : ''}`}
              onClick={() => setViewMode(value)}
              aria-pressed={viewMode === value}
              title={
                value === 'hierarchy' ? 'Left to right, organization to intelligence — how this data becomes an insight'
                  : value === 'radial' ? 'Rings around the organization — compact for wide graphs'
                    : value === 'sunburst' ? 'One ring per hop — which branch is most of this organization'
                      : 'Counts as bars — for how many rather than what connects to what'
              }
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      {summary && <SummaryStrip summary={summary} nodeCount={nodeList.length} edgeCount={edgeList.length} />}

      <div className="gx-toolbar">
        <div className="gx-search">
          <Search size={15} className="gx-search__icon" aria-hidden="true" />
          <input
            className="gx-search__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this organization — a person, a student, a department, a signal…"
            aria-label="Search entities in this organization"
          />
          {searching && <Loader2 size={14} className="gx-spin gx-search__busy" aria-hidden="true" />}
          {query && !searching && (
            <button type="button" className="gx-search__clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} aria-hidden="true" />
            </button>
          )}

          {results !== null && (
            <ul className="gx-results" role="listbox">
              {results.length === 0 ? (
                <li className="gx-results__empty">
                  Nothing in this organization matches “{query.trim()}”.
                </li>
              ) : results.map((node) => (
                <li key={node.key}>
                  <button type="button" className="gx-result" onClick={() => { void openResult(node); }}>
                    <span className="gx-result__dot" style={{ background: FAMILY_COLOR[node.family] }} aria-hidden="true" />
                    <span className="gx-result__body">
                      <span className="gx-result__title">{node.title}</span>
                      <span className="gx-result__meta">{node.label}{node.subtitle ? ` · ${node.subtitle}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="gx-depth">
          <span>Depth</span>
          <select
            className="u-select"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            aria-label="How many hops from the organization to load"
          >
            <option value={1}>1 — branches</option>
            <option value={2}>2 — a sample of each</option>
            <option value={3}>3 — one level further</option>
          </select>
        </label>
      </div>

      {showFilters && available && (
        <FilterBar
          available={available}
          nodeFilter={nodeFilter}
          edgeFilter={edgeFilter}
          include={include}
          onToggleNode={(f) => toggle(nodeFilter, f, setNodeFilter)}
          onToggleEdge={(f) => toggle(edgeFilter, f, setEdgeFilter)}
          onToggleInclude={(key) => {
            const next = include.includes(key) ? include.filter((k) => k !== key) : [...include, key];
            setInclude(next);
          }}
        />
      )}

      {truncations.length > 0 && <DataQualityPanel truncations={truncations} />}

      <div className={`gx-stage${selectedNode ? ' gx-stage--panelled' : ''}${viewMode === 'bars' ? ' gx-stage--bars' : ''}`}>
        {loading ? (
          <div className="gx-loading" role="status">
            <Loader2 size={22} className="gx-spin" aria-hidden="true" />
            <p>Reading this organization&rsquo;s records…</p>
          </div>
        ) : nodeList.length === 0 ? (
          <div className="gx-empty">
            <Crosshair size={22} aria-hidden="true" />
            <h2>Nothing to draw yet</h2>
            <p>
              No departments, people, students or imported records are recorded for this organization, so there is
              nothing for the graph to connect. Import data or add a department, and it will appear here.
            </p>
          </div>
        ) : viewMode === 'bars' ? (
          summary && (
            <GraphBreakdown
              summary={summary}
              nodes={nodeList}
              edges={edgeList}
              // Clicking a count jumps back to the picture with that kind of
              // node selected, so the two views are one screen rather than two.
              onSelectLabel={(label) => {
                const match = nodeList.find((n) => (n.kind === 'group' ? `${n.groupOf ?? 'Group'} (groups)` : n.label) === label);
                if (match) { setViewMode('hierarchy'); void select(match); }
              }}
            />
          )
        ) : viewMode === 'sunburst' ? (
          <GraphSunburst
            nodes={nodeList}
            edges={edgeList}
            rootKey={rootKey}
            selectedKey={selectedKey}
            dimmedKeys={dimmedKeys}
            organizationName={organizationName}
            onSelect={(node) => { void select(node); }}
          />
        ) : (
          <GraphCanvas
            nodes={nodeList}
            edges={edgeList}
            rootKey={rootKey}
            mode={viewMode}
            selectedKey={selectedKey}
            dimmedKeys={dimmedKeys}
            expandedKeys={expandedKeys}
            busyKey={busyKey}
            onSelect={(node) => { void select(node); }}
            onExpand={(node) => { void expand(node); }}
            fitToken={fitToken}
            focusToken={focusToken}
            organizationName={organizationName}
          />
        )}

        {selectedNode && (
          <GraphDetailPanel
            node={selectedNode}
            detail={detail}
            edges={selectedEdges}
            nodesByKey={nodes}
            loading={detailLoading}
            error={detailError}
            expanded={expandedKeys.has(selectedNode.key)}
            expanding={busyKey === selectedNode.key}
            onClose={() => { setSelectedKey(null); setDetail(null); }}
            onExpand={() => { void expand(selectedNode); }}
            onCollapse={() => collapse(selectedNode)}
            onSelectKey={selectByKey}
            onOpenRecord={(view) => onNavigate?.(view as View)}
          />
        )}
      </div>

      <Legend available={available} />
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * The metric strip.
 *
 * EVERY FIGURE IS THIS ORGANIZATION'S, and each is the same number the screen
 * that owns it publishes — departments from OrganizationStructureService, people
 * and students from FoundationCounts, the rest from COUNTs over the tenant's own
 * loop tables. A metric with nothing behind it is not rendered as a zero; it is
 * not rendered.
 */
function SummaryStrip({ summary, nodeCount, edgeCount }: { summary: GraphSummary; nodeCount: number; edgeCount: number }) {
  const metrics: { label: string; value: number; hint?: string }[] = [
    { label: 'On screen', value: nodeCount, hint: 'Nodes currently drawn. Expand a node to load more.' },
    { label: 'Connections', value: edgeCount, hint: 'Edges currently drawn, each one a real join.' },
    { label: summary.departmentSource === 'academic' ? 'Sections' : 'Departments', value: summary.departments,
      hint: summary.departmentSource === 'academic'
        ? 'Teaching sections derived from the standards this organization’s students are recorded in — its source system records no units.'
        : 'Units this organization’s source system records.' },
    { label: 'People', value: summary.people, hint: 'Active staff on the mapped person table. Never students.' },
    { label: 'Students', value: summary.students, hint: 'One row per enrolment number.' },
    { label: 'Records', value: summary.records, hint: 'Imported source rows.' },
    { label: 'Signals', value: summary.signals },
    { label: 'Evidence', value: summary.evidence },
    { label: 'Recommendations', value: summary.recommendations },
    { label: 'Capabilities', value: summary.capabilities },
  ];

  return (
    <div className="gx-metrics">
      {metrics.filter((m) => m.value > 0).map((metric) => (
        <div className="gx-metric" key={metric.label} title={metric.hint}>
          <span className="gx-metric__value">{metric.value.toLocaleString()}</span>
          <span className="gx-metric__label">{metric.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Filters, offering only what this organization has.
 *
 * A chip for a population the organization does not hold is a promise the graph
 * cannot keep — clicking it would produce an empty canvas with no explanation —
 * so `available` decides what is rendered here.
 */
function FilterBar({
  available, nodeFilter, edgeFilter, include, onToggleNode, onToggleEdge, onToggleInclude,
}: {
  available: GraphAvailability;
  nodeFilter: Set<NodeFamily>;
  edgeFilter: Set<EdgeFamily>;
  include: string[];
  onToggleNode: (family: NodeFamily) => void;
  onToggleEdge: (family: EdgeFamily) => void;
  onToggleInclude: (key: string) => void;
}) {
  const familyAvailable: Record<NodeFamily, boolean> = {
    organization: true,
    people: available.people,
    student: available.students,
    academic: available.academic || available.datasets,
    intelligence: available.signals || available.evidence || available.recommendations || available.capabilities,
  };

  const branches = INTELLIGENCE_BRANCHES.filter((b) => available[b.key as keyof GraphAvailability]);

  return (
    <div className="gx-filters">
      <div className="gx-filters__group">
        <span className="gx-filters__label">Entity</span>
        {NODE_FAMILIES.filter((f) => familyAvailable[f]).map((family) => (
          <button
            key={family}
            type="button"
            className={`gx-chip${nodeFilter.has(family) ? ' gx-chip--on' : ''}`}
            style={nodeFilter.has(family) ? { borderColor: FAMILY_COLOR[family] } : undefined}
            onClick={() => onToggleNode(family)}
            aria-pressed={nodeFilter.has(family)}
          >
            <span className="gx-chip__dot" style={{ background: FAMILY_COLOR[family] }} aria-hidden="true" />
            {FAMILY_LABEL[family]}
          </button>
        ))}
      </div>

      <div className="gx-filters__group">
        <span className="gx-filters__label">Relationship</span>
        {EDGE_FAMILIES.map((family) => (
          <button
            key={family}
            type="button"
            className={`gx-chip${edgeFilter.has(family) ? ' gx-chip--on' : ''}`}
            onClick={() => onToggleEdge(family)}
            aria-pressed={edgeFilter.has(family)}
          >
            {EDGE_FAMILY_LABEL[family]}
          </button>
        ))}
      </div>

      {branches.length > 0 && (
        <div className="gx-filters__group">
          <span className="gx-filters__label">Intelligence</span>
          {branches.map((branch) => (
            <button
              key={branch.key}
              type="button"
              className={`gx-chip${include.includes(branch.key) ? ' gx-chip--on' : ''}`}
              onClick={() => onToggleInclude(branch.key)}
              aria-pressed={include.includes(branch.key)}
            >
              {branch.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The legend, restricted to the families this organization actually produces. */
function Legend({ available }: { available: GraphAvailability | null }) {
  if (!available) return null;

  const shown: NodeFamily[] = NODE_FAMILIES.filter((family) => {
    if (family === 'organization') return true;
    if (family === 'people') return available.people;
    if (family === 'student') return available.students;
    if (family === 'academic') return available.academic || available.datasets;
    return available.signals || available.evidence || available.recommendations || available.capabilities;
  });

  return (
    <div className="gx-legend">
      {shown.map((family) => (
        <span className="gx-legend__item" key={family}>
          <span className="gx-legend__dot" style={{ background: FAMILY_COLOR[family] }} aria-hidden="true" />
          {FAMILY_LABEL[family]}
        </span>
      ))}
      <span className="gx-legend__item gx-legend__item--muted">
        <span className="gx-legend__dot gx-legend__dot--group" aria-hidden="true" />
        Group — an aggregate, expand to load its records
      </span>
    </div>
  );
}
