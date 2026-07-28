import { request } from './client.js';

export const kasbaApi = {
  heatmap: (tenantId: string) => request(`/kasba/heatmap/${tenantId}`),
  tasksForCapability: (tenantId: string, capabilityId: string) => request(`/kasba/tasks/${tenantId}/capability/${capabilityId}`),
  createTask: (body: Record<string, unknown>) => request('/kasba/tasks', { method: 'POST', body: JSON.stringify(body) }),
  proficiencyHistory: (tenantId: string, assignmentId: string) => request(`/kasba/proficiency/${tenantId}/assignment/${assignmentId}/history`),
  proficiencyTrend: (tenantId: string, assignmentId: string) => request(`/kasba/proficiency/${tenantId}/assignment/${assignmentId}/trend`),
  assessment: (tenantId: string, assignmentId: string, capabilityId: string) => request(`/kasba/assessment/${tenantId}/assignment/${assignmentId}/${capabilityId}`),
};
