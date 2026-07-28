import { request } from './client.js';

export const taskApi = {
  listRegistry: () => request('/tasks/registry'),
  runSequence: (tenantId: string, steps: Array<{ taskName: string; input?: Record<string, unknown>; maxRetries?: number }>, stopOnFailure = true) =>
    request('/tasks/run', { method: 'POST', body: JSON.stringify({ tenantId, steps, stopOnFailure }) }),
};
