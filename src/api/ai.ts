import { request } from './client.js';

export const aiApi = {
  providers: () => request('/ai/providers'),
  executions: (tenantId: string) => request(`/ai/executions/${tenantId}`),
  summarizeEvidence: (content: string, entityId?: string) =>
    request('/ai/evidence/summarize', { method: 'POST', body: JSON.stringify({ content, entityId }) }),
};
