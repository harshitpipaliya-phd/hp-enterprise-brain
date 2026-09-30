import { request } from './client.js';

export const aiApi = {
  providers: () => request('/ai/providers'),
  executions: (tenantId: string) => request(`/ai/executions/${tenantId}`),
  /**
   * POST /ai/evidence/summarize — a billed provider call, so the server requires `create`. It
   * summarises the evidence attached to a SIGNAL (`signalId`) and answers with a VerbResult:
   * `{ state: 'DECIDED', value: { summary }, evidenceRefs }` or `{ state: 'UNDETERMINED', gaps }`.
   */
  summarizeEvidence: (signalId: string) =>
    request('/ai/evidence/summarize', { method: 'POST', body: JSON.stringify({ signalId }) }),
};
