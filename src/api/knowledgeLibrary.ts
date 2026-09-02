import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

/* ==========================================================================
 *  KNOWLEDGE LIBRARY — THE RETRIEVE SURFACE, AS THE SERVER COMPOSES IT
 *
 *  Mirrors App\Domain\Knowledge\KnowledgeLibraryService. The browser formats
 *  and lays out; it grades nothing. Freshness, confidence and provenance are
 *  decided once, server-side, from config/knowledge.php — so this screen and
 *  Organizational Memory can never disagree about what "stale" means.
 *
 *  THREE STATES THIS CONTRACT ENCODES:
 *
 *  1. UNDETERMINED IS A VALUE, typed as a literal below so the compiler makes
 *     every reader handle it before touching a number. It renders as the word
 *     plus what is missing — never as 0%, a dash, or a hidden row.
 *
 *  2. PROVENANCE IS NOT QUALITY. `SEEDED` says a row was written to
 *     demonstrate the shape of the product; `OBSERVED` says the organization
 *     produced it. Both are shown. Only one may look like experience.
 *
 *  3. FILTERS AND PAGING LIVE IN SQL. Everything below is one page of one
 *     filter, so the screen stays usable at ten thousand assets.
 * ========================================================================== */

export type FreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'UNDETERMINED';
export type ConfidenceState = 'CONFIRMED' | 'SUPPORTED' | 'INFERRED' | 'UNDETERMINED';
export type ProvenanceState = 'OBSERVED' | 'SEEDED' | 'UNDETERMINED';

export interface Freshness {
  state: FreshnessState;
  /** Days since the last update. Null only when no timestamp is on file. */
  days: number | null;
  since: string | null;
}

export interface Confidence {
  state: ConfidenceState;
  /** 0..1, or null when nothing was recorded — never a zero standing in for it. */
  value: number | null;
  /** One sentence naming what the grade was based on. Always present. */
  basis: string;
}

export interface Provenance {
  state: ProvenanceState;
  actor: string | null;
  detail: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface KnowledgeCardData {
  id: string;
  title: string;
  type: string;
  /** The source's own first sentence. Null when the body says nothing. */
  purpose: string | null;
  tags: string[];
  status: string;
  reuseCount: number;
  freshness: Freshness;
  confidence: Confidence;
  provenance: Provenance;
  owner: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  department: { id: string; name: string } | null;
  capabilityCount: number;
  personCount: number;
}

/**
 * A relationship the schema cannot currently answer.
 *
 * `supported: false` is not "there are none" — it is "no table records this".
 * The reason and the unlock travel with it so the UI can say which, rather
 * than rendering an empty list that reads as an absence of activity.
 */
export interface UnsupportedRelation {
  supported: false;
  reason: string;
  unlock: string;
  items: never[];
}

export interface RelatedKnowledge {
  id: string;
  title: string;
  type: string;
  reuseCount: number;
  relation: string;
}

export interface KnowledgeDetailData extends KnowledgeCardData {
  content: string;
  relatedCapabilities: NamedRef[];
  relatedPeople: NamedRef[];
  relatedKnowledge: RelatedKnowledge[];
  usedIn: UnsupportedRelation;
}

export interface Facet {
  value: string;
  label?: string;
  count: number;
}

export interface KnowledgeSummary {
  total: number;
  recentlyAdded: number;
  frequentlyReused: number;
  stale: number;
  fresh: number;
  withEvidence: number;
  seeded: number;
  observed: number;
  categories: Facet[];
  owners: Facet[];
  departments: Facet[];
}

export interface KnowledgePage {
  items: KnowledgeCardData[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

export interface KnowledgeFilters {
  q?: string;
  category?: string;
  department?: string;
  owner?: string;
  status?: string;
  freshness?: FreshnessState;
  provenance?: ProvenanceState;
  hasEvidence?: boolean;
  sort?: 'recent' | 'reused' | 'oldest' | 'title';
  page?: number;
  pageSize?: number;
}

function qs(filters: KnowledgeFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params.set(key, String(value));
  }

  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * The tenant the SERVER will scope to is read from the token, not from this
 * argument — `EnsureTenantScope` overrides whatever a caller puts in the path.
 * The local read only keeps the URL honest about which workspace is open.
 */
function scoped(tenantId: string): string {
  return encodeURIComponent(getAuthTenantId() || tenantId);
}

export const knowledgeLibraryApi = {
  /** GET /knowledge-library/{tenantId} — one page of one filter. */
  list: (tenantId: string, filters: KnowledgeFilters = {}): Promise<KnowledgePage> =>
    request(`/knowledge-library/${scoped(tenantId)}${qs(filters)}`) as Promise<KnowledgePage>,

  /** GET /knowledge-library/{tenantId}/summary — counters and filter vocabulary. */
  summary: (tenantId: string): Promise<KnowledgeSummary> =>
    request(`/knowledge-library/${scoped(tenantId)}/summary`) as Promise<KnowledgeSummary>,

  /** GET /knowledge-library/{tenantId}/{id} — one asset, relationships resolved. */
  detail: (tenantId: string, id: string): Promise<KnowledgeDetailData> =>
    request(`/knowledge-library/${scoped(tenantId)}/${encodeURIComponent(id)}`) as Promise<KnowledgeDetailData>,

  create: (body: Record<string, unknown>): Promise<unknown> =>
    request('/knowledge-library', { method: 'POST', body: JSON.stringify(body) }),

  markReused: (tenantId: string, id: string): Promise<unknown> =>
    request(`/knowledge-library/${scoped(tenantId)}/${encodeURIComponent(id)}/reuse`, { method: 'POST' }),
};
