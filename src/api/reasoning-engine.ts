import { request } from './client.js';

export const reasoningEngineApi = {
  missingEvidence: (tenantId: string) => request(`/reasoning-engine/${tenantId}/missing-evidence`),
  duplicateSignals: (tenantId: string) => request(`/reasoning-engine/${tenantId}/duplicate-signals`),
  earlyWarnings: (tenantId: string) => request(`/reasoning-engine/${tenantId}/early-warnings`),
};
