/**
 * Client for the Recommendation Engine — `/ai-intelligence/recommendations`.
 *
 * Ported from G2G's lib/intelligence/ai-recommendations.ts (`sub_institute_id` is
 * `tenant_id` here; ids are UUID strings).
 *
 * `show` returns the whole chain (recommendation, the reasoning step that produced
 * it, and the evidence behind that) in one call rather than three. That is not a
 * round-trip optimisation: it stops a screen from rendering an approve button beside
 * an explanation that failed to load, which is the one state this capability must
 * not have.
 */

import { aiRequest } from './client';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  urgency: string;
  confidence: number | null;
  expected_roi: number | null;
  /** Prose, not a label — these columns hold sentences. */
  impact: string;
  cost: string;
  risk: string;
  status: string;
  /** Whether it can still be decided. Stated by the API so the button and the guard agree. */
  is_pending: boolean;
  reasoning_step_id: string | null;
  created_date: string | null;
  updated_date: string | null;
}

export interface ReasoningStep {
  id: string;
  description: string;
  step_order: number | null;
  confidence: number | null;
  case_id: string | null;
  signal_id: string | null;
  created_date: string | null;
}

export interface EvidenceRecord {
  id: string;
  evidence_type: string;
  source: string;
  /** Truncated server-side — evidence content is an arbitrary payload. */
  content: string;
  confidence: number | null;
  status: string;
  observed_date: string | null;
}

export interface RecommendationCounts {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  deferred: number;
}

export interface RecommendationChain {
  recommendation: Recommendation | null;
  reasoning: ReasoningStep | null;
  evidence: EvidenceRecord[];
}

export function fetchPendingRecommendations(): Promise<{
  tenant_id: string;
  counts: RecommendationCounts;
  recommendations: Recommendation[];
}> {
  return aiRequest('/recommendations/pending');
}

export function fetchRecommendations(status?: string | null): Promise<{
  tenant_id: string;
  status: string | null;
  counts: RecommendationCounts;
  recommendations: Recommendation[];
}> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';

  return aiRequest(`/recommendations${query}`);
}

export function fetchRecommendationChain(id: string): Promise<RecommendationChain> {
  return aiRequest(`/recommendations/${encodeURIComponent(id)}`);
}

export type RecommendationDecision = 'approve' | 'reject' | 'defer';

export function decideRecommendation(
  id: string,
  decision: RecommendationDecision,
  note?: string,
): Promise<{ recommendation: Recommendation; counts: RecommendationCounts }> {
  return aiRequest(
    `/recommendations/${encodeURIComponent(id)}/${decision}`,
    'POST',
    note ? { note } : {},
  );
}
