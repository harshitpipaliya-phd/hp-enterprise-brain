import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';
import type { Confidence, Facet, Provenance } from './knowledgeLibrary';

/* ==========================================================================
 *  ORGANIZATIONAL MEMORY — THE LEARN SURFACE
 *
 *  Mirrors App\Domain\Knowledge\OrganizationalMemoryService, which walks one
 *  chain of real foreign keys:
 *
 *      evidence → decision → execution → outcome → learning → reuse
 *
 *  EVERY LINK MAY BE ABSENT, AND SAYS SO. `outcome` and `decision` are
 *  discriminated unions on `present`, so a reader cannot reach a result
 *  without first handling the case where the chain is broken. A screen that
 *  always renders a complete chain teaches nothing about the one time it
 *  wasn't complete — and it is exactly the incomplete ones a manager needs.
 *
 *  THE MAGNITUDE FIELD IS WHY THIS TYPE EXISTS.
 *
 *  Every outcome in this installation is stored as result="improved". Most
 *  carry metrics of {baseline:0, observed:0, changePercent:0} and no evidence.
 *  `magnitude.state` grades that as UNDETERMINED, and the UI must render the
 *  word rather than the stored result — printing "Improved" for a change that
 *  was never measured is the fabrication this whole contract exists to stop.
 * ========================================================================== */

export type MagnitudeState = 'MEASURED' | 'REPORTED' | 'UNDETERMINED';

export interface OutcomeMagnitude {
  state: MagnitudeState;
  changePercent: number | null;
  baseline: number | null;
  observed: number | null;
  unit: string | null;
  /** Why it is graded this way, in words the reader can act on. */
  detail: string;
}

export type MemoryOutcome =
  | { present: false; reason: string }
  | {
      present: true;
      id: string;
      result: string;
      feedback: string | null;
      magnitude: OutcomeMagnitude;
      confidence: Confidence;
      evidenceCount: number;
    };

export type MemoryDecision =
  | { present: false; reason: string }
  | {
      present: true;
      id: string;
      status: string;
      rationale: string | null;
      explanation: string | null;
      decidedBy: string | null;
      confidence: Confidence;
    };

export interface MemoryCardData {
  id: string;
  /** The stored slug, e.g. "workload-redistribution-improves-load". */
  pattern: string;
  /** The slug made readable. Slugs are identifiers, not headings. */
  title: string;
  lesson: string;
  domain: string | null;
  reusable: boolean;
  createdDate: string | null;
  confidence: Confidence;
  provenance: Provenance;
  /** How many times this organization reached this same named conclusion. */
  patternReuseCount: number;
  outcome: MemoryOutcome;
  decision: MemoryDecision;
}

export interface MemoryEvidence {
  id: string;
  source: string;
  type: string;
  statement: string | null;
  status: string;
  observedDate: string | null;
  confidence: Confidence;
  provenance: Provenance;
  derivedFrom: string | null;
  method: string | null;
}

export interface MemoryExecution {
  id: string;
  esoId: string | null;
  esoName: string | null;
  status: string;
  executedBy: string | null;
  executorType: string | null;
  note: string | null;
  result: string | null;
  error: string | null;
  completedDate: string | null;
}

export interface SimilarMemory {
  id: string;
  title: string;
  lesson: string;
  createdDate: string | null;
  relation: string;
}

/**
 * What this learning went on to change.
 *
 * `supported` is false because no column ties a later decision back to the
 * learning that informed it. `observedReuse` is the part the data CAN show —
 * the same pattern being reached again — so the screen reports real reuse and
 * names the missing link rather than inferring influence from timing.
 */
export interface InfluencedRelation {
  supported: false;
  reason: string;
  unlock: string;
  observedReuse: number;
  observedReuseDetail: string;
  items: never[];
}

export interface MemoryEvidenceBlock {
  supported: boolean;
  reason: string | null;
  items: MemoryEvidence[];
}

export interface MemoryDetailData extends MemoryCardData {
  evidence: MemoryEvidenceBlock;
  executions: MemoryExecution[];
  similarMemories: SimilarMemory[];
  influenced: InfluencedRelation;
}

export interface MemorySummary {
  total: number;
  successfulInterventions: number;
  failedInterventions: number;
  /** Outcomes labelled but never measured. Counted apart, never as success. */
  unmeasuredInterventions: number;
  lessonsLearned: number;
  reusableLessons: number;
  reusedLearnings: number;
  distinctPatterns: number;
  recentLearning: number;
  seeded: number;
  observed: number;
  domains: Facet[];
  patterns: Facet[];
}

export interface MemoryPage {
  items: MemoryCardData[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

export interface MemoryFilters {
  q?: string;
  domain?: string;
  pattern?: string;
  reusable?: boolean;
  provenance?: 'OBSERVED' | 'SEEDED';
  page?: number;
  pageSize?: number;
}

function qs(filters: MemoryFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const s = params.toString();
  return s ? `?${s}` : '';
}

function scoped(tenantId: string): string {
  return encodeURIComponent(getAuthTenantId() || tenantId);
}

export const organizationalMemoryApi = {
  /** GET /organizational-memory/{tenantId} — the feed, newest first. */
  list: (tenantId: string, filters: MemoryFilters = {}): Promise<MemoryPage> =>
    request(`/organizational-memory/${scoped(tenantId)}${qs(filters)}`) as Promise<MemoryPage>,

  summary: (tenantId: string): Promise<MemorySummary> =>
    request(`/organizational-memory/${scoped(tenantId)}/summary`) as Promise<MemorySummary>,

  /** GET /organizational-memory/{tenantId}/{id} — the full learning chain. */
  detail: (tenantId: string, id: string): Promise<MemoryDetailData> =>
    request(`/organizational-memory/${scoped(tenantId)}/${encodeURIComponent(id)}`) as Promise<MemoryDetailData>,
};
