import { request } from './client.js';

export const kasbaApi = {
  /** GET /api/v1/kasba/assessment/{tenantId}/assignment/{assignmentId}/{capabilityId} */
  assessment: (tenantId: string, assignmentId: string, capabilityId: string) =>
    request(`/kasba/assessment/${tenantId}/assignment/${assignmentId}/${capabilityId}`),

  /** POST /api/v1/kasba/proficiency */
  recordProficiency: (body: Record<string, unknown>) =>
    request('/kasba/proficiency', { method: 'POST', body: JSON.stringify(body) }),

  /** GET /api/v1/kasba/heatmap/{tenantId} */
  heatmap: (tenantId: string) => request(`/kasba/heatmap/${tenantId}`),

  /** GET /api/v1/kasba/tasks/{tenantId}/capability/{capabilityId} */
  tasksForCapability: (tenantId: string, capabilityId: string) =>
    request(`/kasba/tasks/${tenantId}/capability/${capabilityId}`),

  /** POST /api/v1/kasba/tasks */
  createTask: (body: Record<string, unknown>) =>
    request('/kasba/tasks', { method: 'POST', body: JSON.stringify(body) }),

  /** GET /api/v1/kasba/proficiency/{tenantId}/assignment/{assignmentId}/history */
  proficiencyHistory: (tenantId: string, assignmentId: string) =>
    request(`/kasba/proficiency/${tenantId}/assignment/${assignmentId}/history`),

  /** GET /api/v1/kasba/proficiency/{tenantId}/assignment/{assignmentId}/trend */
  proficiencyTrend: (tenantId: string, assignmentId: string) =>
    request(`/kasba/proficiency/${tenantId}/assignment/${assignmentId}/trend`),
};
