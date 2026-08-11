
import { request } from './client.js';

export const api = {
  // Search (Sprint 7) — Postgres business-object search
  search: (tenantId: string, q: string, types?: string[]) =>
    request(`/search/${tenantId}?q=${encodeURIComponent(q)}${types?.length ? `&types=${types.join(',')}` : ''}`),

  // Workspace (Story 9)
  getWorkspace: (tenantId: string) => request(`/workspace/${tenantId}`),
  getSignalChain: (tenantId: string, signalId: string) => request(`/workspace/${tenantId}/signal/${signalId}/chain`),
  getHomeMetrics: (tenantId: string) => request(`/workspace/${tenantId}/home-metrics`),

  // Evidence (Story 2)
  listEvidence: (tenantId: string) => request(`/evidence/${tenantId}`),
  collectEvidence: (body: Record<string, unknown>) => request('/evidence', { method: 'POST', body: JSON.stringify(body) }),

  // Reasoning (Story 3)
  reason: (body: Record<string, unknown>) => request('/reasoning', { method: 'POST', body: JSON.stringify(body) }),
  getReasoningForSignal: (tenantId: string, signalId: string) => request(`/reasoning/${tenantId}/signal/${signalId}`),

  // Recommendations (Story 4)
  listRecommendations: (tenantId: string, status?: string) =>
    request(`/recommendations/${tenantId}${status ? `?status=${status}` : ''}`),
  generateRecommendation: (body: Record<string, unknown>) => request('/recommendations', { method: 'POST', body: JSON.stringify(body) }),

  // Decisions (Story 6, Executor Resolver)
  listDecisions: (tenantId: string) => request(`/decisions/${tenantId}`),
  /** POST /api/v1/decisions — records the decision to act on a recommendation. */
  approveRecommendation: (tenantId: string, recommendationId: string, rationale: string) =>
    request('/decisions', { method: 'POST', body: JSON.stringify({ tenantId, recommendationId, rationale }) }),
  /**
   * POST /api/v1/decisions/{tenantId}/{id}/approve — the governance act on an
   * already-recorded decision. Distinct from creating one, and gated on the
   * decision.approve permission rather than plain create.
   */
  approveDecision: (tenantId: string, id: string, body: Record<string, unknown> = {}) =>
    request(`/decisions/${tenantId}/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),

  // Outcomes (Story 7)
  listOutcomes: (tenantId: string) => request(`/outcomes/${tenantId}`),
  captureOutcome: (body: Record<string, unknown>) => request('/outcomes', { method: 'POST', body: JSON.stringify(body) }),

  // Learnings (Story 8)
  listLearnings: (tenantId: string) => request(`/learnings/${tenantId}`),
  /** GET /api/v1/learnings/{tenantId}/reusable — the subset flagged for reuse. */
  listReusableLearnings: (tenantId: string) => request(`/learnings/${tenantId}/reusable`),
  extractLearning: (body: Record<string, unknown>) => request('/learnings', { method: 'POST', body: JSON.stringify(body) }),
};

export const decisionIntelligenceApi = {
  // Risks (Sprint 4 Story 6)
  listRisks: (tenantId: string) => request(`/risks/${tenantId}`),
  assessRisk: (body: Record<string, unknown>) => request('/risks', { method: 'POST', body: JSON.stringify(body) }),
  mitigateRisk: (tenantId: string, id: string, mitigation: string) =>
    request(`/risks/${tenantId}/${id}/mitigate`, { method: 'POST', body: JSON.stringify({ mitigation }) }),

  // Policies (Sprint 4 Story 5)
  listPolicies: (tenantId: string) => request(`/policies/${tenantId}`),

  // Analytics (Sprint 4 Story 9)
  getAnalytics: (tenantId: string) => request(`/analytics/${tenantId}`),
  getExecutiveSummary: (tenantId: string) => request(`/analytics/${tenantId}/executive-summary`),
  getDecisionIntelligence: (tenantId: string) => request(`/analytics/${tenantId}/decision-intelligence`),
  getDeliberationOverview: (tenantId: string, page = 1, pageSize = 8) =>
    request(`/analytics/${tenantId}/deliberation-overview?page=${page}&pageSize=${pageSize}`),
  getEnterpriseOverview: (tenantId: string) => request(`/analytics/${tenantId}/enterprise-overview`),
  getExecutionOverview: (tenantId: string, page = 1, pageSize = 12, status = 'active') =>
    request(`/analytics/${tenantId}/execution-overview?page=${page}&pageSize=${pageSize}&status=${encodeURIComponent(status)}`),
  getTrend: (tenantId: string, metric: string, days = 180, dimension?: string) =>
    request(
      `/analytics/${tenantId}/trend?metric=${encodeURIComponent(metric)}&days=${days}${dimension ? `&dimension=${encodeURIComponent(dimension)}` : ''}`,
      { globalLoader: 'none' },
    ),

  // Executors (Sprint 3) — the real data behind the Multi-Agent Monitor
  listExecutors: (tenantId: string) => request(`/executors/${tenantId}`),
  /** POST /api/v1/executors */
  createExecutor: (body: Record<string, unknown>) =>
    request('/executors', { method: 'POST', body: JSON.stringify(body) }),

  // Evidence (Sprint 2) — the api object already has listEvidence/collectEvidence; this is the one genuinely missing method
  getEvidenceForSignal: (tenantId: string, signalId: string) => request(`/evidence/${tenantId}/signal/${signalId}`),
};
