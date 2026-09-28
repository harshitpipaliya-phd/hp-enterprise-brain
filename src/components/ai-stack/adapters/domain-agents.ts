/**
 * The bound-domain-agent half of LMS_K12's intelligence client, as the shared Automations
 * screen imports it.
 *
 * WHY THESE DO NOT CALL ANYTHING IN HP BRAIN
 *
 * LMS_K12 has backend "domain agents" (e.g. `k12_academic_risk`) with a case store and a
 * workflow approval queue; a module bound to one gets the Automations "bound agent"
 * panel. HP Brain, like G2G, has no such bound agent for any AI Stack module, so every
 * descriptor sets `boundAgent: null` with a stated `noAgentReason`, and the shared screen
 * never renders that panel or calls these. They exist so the unchanged screen compiles;
 * if one were ever reached it says exactly why rather than returning invented rows. HP
 * Brain's AI Stack agents — read-only tool agents in hpbrain_ai_tool_agents — are on the
 * same tab, through api/aiStack/agents.ts.
 */

export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface IntelligenceContext {
  token?: string | null;
  baseUrl?: string | null;
  instituteId?: string | number | null;
  academicYear?: string | number | null;
  termId?: string | number | null;
}

export interface AgentRunResult {
  run_id: number | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'rejected' | 'timed_out' | 'cancelled';
  summary: string;
  result: {
    students_at_risk?: number;
    signals_detected?: number;
    confidence?: number;
    message?: string;
    cases?: unknown[];
  };
  counters: {
    signals_detected: number;
    evidence_collected: number;
    cases_opened: number;
    recommendations_drafted: number;
  };
  error: string | null;
}

export interface PendingApproval {
  id: number;
  run_id: number;
  workflow_key: string;
  step_key: string | null;
  approver_role: string | null;
  assigned_to: number | null;
  subject_entity_key: string | null;
  subject_id: number | string | null;
  recommendation_id: number | null;
  case_id: number | null;
  expires_at: string | null;
  created_at: string | null;
}

export interface WorkflowRunSummary {
  run_id: number | null;
  status: string;
  message: string;
  current_step: string | null;
}

const NOT_IN_HP_BRAIN =
  'HP Brain has no backend domain agent or approval workflow for this module. Use the tool agents on this tab, which run in HP Brain.';

export function listAgents(_context: IntelligenceContext, _domain?: string): Promise<{ agents: Array<Record<string, unknown>> }> {
  return Promise.reject(new Error(NOT_IN_HP_BRAIN));
}

export function runAgent(
  _context: IntelligenceContext,
  _agentKey: string,
  _input: Record<string, unknown> = {},
): Promise<AgentRunResult> {
  return Promise.reject(new Error(NOT_IN_HP_BRAIN));
}

export function listAgentRuns(
  _context: IntelligenceContext,
  _agentKey?: string,
  _limit = 50,
): Promise<{ runs: Array<Record<string, unknown>> }> {
  return Promise.reject(new Error(NOT_IN_HP_BRAIN));
}

export function listPendingApprovals(_context: IntelligenceContext, _limit = 50): Promise<{ approvals: PendingApproval[] }> {
  return Promise.reject(new Error(NOT_IN_HP_BRAIN));
}

export function resolveApproval(
  _context: IntelligenceContext,
  _approvalId: number,
  _decision: 'approved' | 'rejected',
  _comment?: string,
): Promise<WorkflowRunSummary> {
  return Promise.reject(new Error(NOT_IN_HP_BRAIN));
}
