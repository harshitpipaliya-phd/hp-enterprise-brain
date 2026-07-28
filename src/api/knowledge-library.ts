import { request } from './client.js';

export const knowledgeLibraryApi = {
  create: (body: Record<string, unknown>) => request('/knowledge-library', { method: 'POST', body: JSON.stringify(body) }),
  list: (tenantId: string, category?: string) => request(`/knowledge-library/${tenantId}${category ? `?category=${category}` : ''}`),
  search: (tenantId: string, q: string) => request(`/knowledge-library/${tenantId}/search?q=${encodeURIComponent(q)}`),
  markReused: (tenantId: string, id: string) => request(`/knowledge-library/${tenantId}/${id}/reuse`, { method: 'POST' }),
};
