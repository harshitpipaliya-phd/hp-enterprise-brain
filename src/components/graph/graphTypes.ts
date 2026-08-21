/**
 * The shapes GraphController publishes, restated once for the client.
 *
 * These mirror app/Domain/Graph/GraphBuilder.php and GraphVocabulary.php. They
 * are deliberately narrow: the graph carries only what it needs to draw and to
 * explain itself, never a row dump.
 */

/** What a node IS, which is how the graph is coloured and filtered. */
export type NodeFamily = 'organization' | 'people' | 'student' | 'academic' | 'intelligence';

/** What an edge MEANS, which is how relationships are filtered. */
export type EdgeFamily = 'organizational' | 'people' | 'academic' | 'intelligence';

export interface GraphNode {
  /** `Label:id` — stable, and the identity the whole client keys on. */
  key: string;
  label: string;
  labels: string[];
  id: string;
  title: string;
  subtitle: string | null;
  family: NodeFamily;
  /**
   * 'entity' is one real row. 'group' is N rows of one label standing behind a
   * single circle, with `count` being a COUNT over exactly the rows it expands
   * into. The two are drawn differently on purpose: nobody should be able to
   * mistake an aggregate for a record.
   */
  kind: 'entity' | 'group';
  /** Present on group nodes: the label of the rows inside it. */
  groupOf?: string;
  count: number | null;
  expandable: boolean;
  properties: Record<string, unknown>;
  /** The existing screen that owns this entity, for "open the full record". */
  deepLink: string | null;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  /** "works in", "supported by" — never "connected to". */
  label: string;
  family: EdgeFamily;
  /** The column or derivation that produces this edge. Shown to the reader. */
  provenance: string;
  /** A sentence about THIS edge, where one exists. Usually null. */
  note: string | null;
}

/** Recorded whenever the graph returned fewer rows than exist. */
export interface GraphTruncation {
  kind: string;
  shown: number;
  total: number;
  reason: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: GraphTruncation[];
  nodeCount: number;
  edgeCount: number;
  nodeBudget: number;
  /** Present instead of data when the read failed; see GraphController::failed. */
  error?: string;
  message?: string;
}

export interface GraphSummary {
  departments: number;
  /** 'hr' | 'academic' | 'none' — what `departments` counted. */
  departmentSource: string;
  /** 'staff' | 'students' | 'none' — what a department's members are. */
  memberType: string;
  people: number;
  students: number;
  records: number;
  datasets: number;
  signals: number;
  evidence: number;
  cases: number;
  recommendations: number;
  decisions: number;
  capabilities: number;
}

/** Which branches this organization has at all. Drives which filters are offered. */
export interface GraphAvailability {
  departments: boolean;
  people: boolean;
  students: boolean;
  academic: boolean;
  fees: boolean;
  datasets: boolean;
  signals: boolean;
  evidence: boolean;
  cases: boolean;
  recommendations: boolean;
  decisions: boolean;
  capabilities: boolean;
}

export interface GraphOverview extends GraphPayload {
  root: { label: string; id: string; key: string | null };
  depth: number;
  summary: GraphSummary;
  available: GraphAvailability;
  labels: string[];
  tenantId: string;
}

export interface GraphExpansion extends GraphPayload {
  origin: { label: string; id: string; key: string };
  offset: number;
  tenantId: string;
}

export interface GraphFact {
  label: string;
  value: string | number | null;
  hint?: string | null;
}

export interface GraphConnection {
  label: string;
  relationship: string;
  count: number;
  provenance: string;
}

export interface GraphNodeDetail {
  node: GraphNode;
  facts: GraphFact[];
  connections: GraphConnection[];
  tenantId: string;
  error?: string;
}

export interface GraphSearchResponse {
  query: string;
  count: number;
  results: GraphNode[];
  error?: string;
}

export interface GraphVocabulary {
  labels: Record<string, NodeFamily>;
  relationships: { type: string; label: string; family: EdgeFamily; provenance: string }[];
  relationshipFamilies: EdgeFamily[];
}

/** A node the user asked to open the graph on, handed in from another screen. */
export interface GraphFocus {
  label: string;
  id: string;
}

/* ---------------------------------------------------------------- palette --- */

/**
 * One colour per FAMILY, not per label.
 *
 * Five colours the eye can hold apart beats fourteen it cannot, and the family
 * is the thing a reader actually reasons about: "that cluster is intelligence",
 * "that cluster is people". Every value is a design token, so the graph follows
 * the theme including the dark instrument — a hex here would have to be
 * duplicated per theme and would drift the first time one changed.
 *
 * These deliberately agree with GRAPH_NODE_COLOR in ui/palette.ts, which the
 * older list-based explorer used, so a Signal is the same colour in both.
 */
export const FAMILY_COLOR: Record<NodeFamily, string> = {
  organization: 'var(--chart-2)',
  people:       'var(--chart-6)',
  student:      'var(--chart-4)',
  academic:     'var(--chart-3)',
  intelligence: 'var(--chart-1)',
};

export const FAMILY_LABEL: Record<NodeFamily, string> = {
  organization: 'Organization',
  people:       'People',
  student:      'Students',
  academic:     'Academic data',
  intelligence: 'Intelligence',
};

export const EDGE_FAMILY_LABEL: Record<EdgeFamily, string> = {
  organizational: 'Organizational',
  people:         'People',
  academic:       'Academic',
  intelligence:   'Intelligence',
};

/**
 * Node radius by importance, so the eye finds the organization first.
 *
 * A group's radius grows very slightly with its count — enough that a section of
 * 3,000 students reads as bigger than one of 40, not enough that it dominates
 * the canvas.
 */
export function nodeRadius(node: GraphNode): number {
  if (node.label === 'Organization') return 34;
  if (node.kind === 'group') return Math.min(26, 17 + Math.log10(Math.max(1, node.count ?? 1)) * 3);
  if (node.label === 'Department' || node.label === 'Dataset') return 20;
  return 15;
}
