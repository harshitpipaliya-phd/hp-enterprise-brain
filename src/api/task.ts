import { request } from './client.js';

export const taskApi = {
  listRegistry: () => request('/tasks/registry'),
  /** GET /tasks/schedule — routes/console.php as `schedule:list --json` resolves it. */
  schedule: () => request('/tasks/schedule'),
  runSequence: (tenantId: string, steps: Array<{ taskName: string; input?: Record<string, unknown>; maxRetries?: number }>, stopOnFailure = true) =>
    request('/tasks/run', { method: 'POST', body: JSON.stringify({ tenantId, steps, stopOnFailure }) }),
};
