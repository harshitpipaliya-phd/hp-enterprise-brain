import { request } from './client.js';

export const api = {
  // Search (Sprint 7) — Postgres business-object search
  search: (tenantId: string, q: string, types?: string[]) =>
    request(`/search/${tenantId}?q=${encodeURIComponent(q)}${types?.length ? `&types=${types.join(',')}` : ''}`),

  // Workspace (Story 9)
  getWorkspace: (tenantId: string) => request(`/workspace/${tenantId}`),
  getSignalChain: (tenantId: string, signalId: string) => request(`/workspace/${tenantId}/signal/${signalId}/chain`),

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
  approveRecommendation: (tenantId: string, recommendationId: string, rationale: string) =>
    request('/decisions', { method: 'POST', body: JSON.stringify({ tenantId, recommendationId, rationale }) }),

  // Outcomes (Story 7)
  listOutcomes: (tenantId: string) => request(`/outcomes/${tenantId}`),
  captureOutcome: (body: Record<string, unknown>) => request('/outcomes', { method: 'POST', body: JSON.stringify(body) }),

  // Learnings (Story 8)
  listLearnings: (tenantId: string) => request(`/learnings/${tenantId}`),
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

  // Executors (Sprint 3) — the real data behind the Multi-Agent Monitor
  listExecutors: (tenantId: string) => request(`/executors/${tenantId}`),

  // Evidence (Sprint 2) — the api object already has listEvidence/collectEvidence; this is the one genuinely missing method
  getEvidenceForSignal: (tenantId: string, signalId: string) => request(`/evidence/${tenantId}/signal/${signalId}`),
};
