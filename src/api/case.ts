import { request } from './client.js';

export const caseApi = {
  createCase: (body: Record<string, unknown>) => request('/cases', { method: 'POST', body: JSON.stringify(body) }),
  listCases: (tenantId: string, status?: string) => request(`/cases/${tenantId}${status ? `?status=${status}` : ''}`),
  getCase: (tenantId: string, id: string) => request(`/cases/${tenantId}/${id}`),
  transition: (tenantId: string, id: string, status: string, resolvedHypothesisId?: string) =>
    request(`/cases/${tenantId}/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ status, resolvedHypothesisId }) }),
  attachEvidence: (tenantId: string, id: string, evidenceId: string) =>
    request(`/cases/${tenantId}/${id}/evidence`, { method: 'POST', body: JSON.stringify({ evidenceId }) }),
  getCaseEvidence: (tenantId: string, id: string) => request(`/cases/${tenantId}/${id}/evidence`),

  proposeHypothesis: (body: Record<string, unknown>) => request('/hypotheses', { method: 'POST', body: JSON.stringify(body) }),
  getLedger: (tenantId: string, caseId: string) => request(`/hypotheses/${tenantId}/case/${caseId}`),
  rejectHypothesis: (tenantId: string, caseId: string, id: string, reason: string) =>
    request(`/hypotheses/${tenantId}/case/${caseId}/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  supportHypothesis: (tenantId: string, caseId: string, id: string) =>
    request(`/hypotheses/${tenantId}/case/${caseId}/${id}/support`, { method: 'POST', body: JSON.stringify({}) }),
  confirmHypothesis: (tenantId: string, caseId: string, id: string) =>
    request(`/hypotheses/${tenantId}/case/${caseId}/${id}/confirm`, { method: 'POST', body: JSON.stringify({}) }),
};
