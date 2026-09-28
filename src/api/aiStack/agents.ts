
import { AiApiError, aiRequest } from '../aiIntelligence/client';

import type { Agent, AgentRun, AgentStatus, CreateAgentInput, RunAgentInput } from './agentTypes';

/**
 * Browser client for AI Stack tool agents.
 *
 * Same exports and signatures as LMS_K12's `lib/agents/client.ts`, because the shared
 * Automations / Agent Management / Run Agent screens call these by name. The difference
 * is where they go: LMS_K12 talks to an agent engine inside its own Next app; G2G talks
 * to `/api/ai/tool-agents*` in hp_erp, which stores agents and runs in G2G's own Agentic
 * AI tables (`agentic_agents` / `agentic_agent_runs`). Identity and organisation come
 * from the Sanctum token `aiRequest` sends — never from a request body.
 */

export class AgentApiError extends Error {
  readonly status: number;
  /** For a refused run, the `denied` row the server wrote. */
  readonly run: AgentRun | null;

  constructor(message: string, status: number, run: AgentRun | null = null) {
    super(message);
    this.name = 'AgentApiError';
    this.status = status;
    this.run = run;
  }
}

async function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
  try {
    return await aiRequest<T>(path, method, body);
  } catch (cause) {
    if (cause instanceof AiApiError) throw new AgentApiError(cause.message, cause.status);
    throw cause;
  }
}

export function fetchAgents(filter: { module?: string; status?: AgentStatus } = {}): Promise<Agent[]> {
  const params = new URLSearchParams();
  if (filter.module) params.set('module', filter.module);
  if (filter.status) params.set('status', filter.status);
  const query = params.toString();
  return call<{ agents: Agent[] }>(`/tool-agents${query ? `?${query}` : ''}`).then((result) => result.agents);
}

/** Totals over EVERY run the filters match for this tenant — counted in SQL, not over the fetched page. */
export interface AgentRunsSummary {
  total: number;
  today: number;
  succeeded: number;
  failed: number;
  denied: number;
  distinct_users: number;
  avg_duration_ms: number | null;
}

export interface AgentRunsIndex {
  runs: AgentRun[];
  summary: AgentRunsSummary;
}

function runsQuery(filter: { module?: string; agentId?: string; limit?: number }): string {
  const params = new URLSearchParams();
  if (filter.module) params.set('module', filter.module);
  if (filter.agentId) params.set('agent_id', filter.agentId);
  if (filter.limit) params.set('limit', String(filter.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fetchRuns(filter: { module?: string; agentId?: string; limit?: number } = {}): Promise<AgentRun[]> {
  return call<{ runs: AgentRun[] }>(`/tool-agent-runs${runsQuery(filter)}`).then((result) => result.runs);
}

/**
 * The same runs, alongside the backend's own totals over every run the filters
 * match — not just the (capped) page fetched. Use this wherever a screen shows
 * "runs today", "success rate" or similar: computing those from the fetched page
 * silently under-counts once there are more runs than the page holds.
 */
export function fetchRunsIndex(filter: { module?: string; agentId?: string; limit?: number } = {}): Promise<AgentRunsIndex> {
  return call<AgentRunsIndex>(`/tool-agent-runs${runsQuery(filter)}`);
}

export function createAgent(input: CreateAgentInput): Promise<Agent> {
  return call<{ agent: Agent }>('/tool-agents', 'POST', input).then((result) => result.agent);
}

export function setAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
  return call<{ agent: Agent }>(`/tool-agents/${encodeURIComponent(agentId)}`, 'PATCH', { status }).then(
    (result) => result.agent,
  );
}

/**
 * Run one tool. A refused run is still written (so it is in the log), and — as in
 * LMS_K12 — surfaces as an `AgentApiError` carrying that `denied` row.
 */
export async function runAgent(agentId: string, input: RunAgentInput = {}): Promise<AgentRun> {
  const { run } = await call<{ run: AgentRun }>(`/tool-agents/${encodeURIComponent(agentId)}/run`, 'POST', input);

  if (run.status === 'denied') {
    throw new AgentApiError(run.error ?? 'The run was refused.', 403, run);
  }

  return run;
}
