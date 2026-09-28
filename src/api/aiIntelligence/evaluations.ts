/**
 * Client for AI Evaluation — `/ai-intelligence/evaluations`.
 *
 * Ported from G2G's lib/intelligence/ai-evaluations.ts (`sub_institute_id` is
 * `tenant_id` here; ids are UUID strings).
 *
 * An evaluation is a named set of cases against one published template. Each case
 * supplies the variables the template needs and declares what a correct answer must
 * contain and must not contain; running it calls the configured provider once per
 * case and scores by assertion.
 *
 * `run` is the only call here that costs money, and it is synchronous — one provider
 * call per case with the request held open. `max_cases` from `options()` is the
 * ceiling, and a screen should say so rather than let somebody write a test set that
 * times out.
 */

import { aiRequest } from './client';

export interface EvaluationTemplateOption {
  template_key: string;
  name: string;
  version: number;
  module_key: string;
  module_label: string;
  /** Which grounding placeholders a case must supply for this template. */
  grounding_variables: string[];
}

export interface EvaluationSummary {
  id: string;
  name: string;
  description: string | null;
  template_key: string | null;
  template_version: number | null;
  module_key: string | null;
  provider: string | null;
  model: string | null;
  status: 'draft' | 'running' | 'completed' | 'failed' | string;
  case_count: number;
  passed_count: number;
  failed_count: number;
  /** Mean of the per-case scores, 0–1. Null until a run finishes. */
  score: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  duration_ms: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}

export interface EvaluationCase {
  id: string;
  label: string;
  variables: Record<string, unknown>;
  expect_contains: string[];
  expect_absent: string[];
  output: string | null;
  score: number | null;
  passed: boolean | null;
  /** Which assertion decided it, in words. */
  verdict: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  error: string | null;
}

export interface EvaluationCasePayload {
  label: string;
  variables?: Record<string, string>;
  expect_contains?: string[];
  expect_absent?: string[];
}

export interface EvaluationPayload {
  name: string;
  description?: string | null;
  template_key: string;
  template_version?: number | null;
  cases: EvaluationCasePayload[];
}

export function fetchEvaluationOptions(): Promise<{
  templates: EvaluationTemplateOption[];
  max_cases: number;
  statuses: string[];
}> {
  return aiRequest('/evaluations/options');
}

export function fetchEvaluations(): Promise<{
  tenant_id: string;
  evaluations: EvaluationSummary[];
}> {
  return aiRequest('/evaluations');
}

export function fetchEvaluation(id: string): Promise<{
  evaluation: EvaluationSummary;
  cases: EvaluationCase[];
}> {
  return aiRequest(`/evaluations/${encodeURIComponent(id)}`);
}

export function createEvaluation(payload: EvaluationPayload): Promise<{
  evaluation: EvaluationSummary;
}> {
  return aiRequest('/evaluations', 'POST', payload);
}

/** One provider call per case, synchronously. Expect this to take a while. */
export function runEvaluation(id: string): Promise<{ evaluation: EvaluationSummary }> {
  return aiRequest(`/evaluations/${encodeURIComponent(id)}/run`, 'POST', {});
}

export function deleteEvaluation(id: string): Promise<{ id: string }> {
  return aiRequest(`/evaluations/${encodeURIComponent(id)}`, 'DELETE');
}
