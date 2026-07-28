import { request } from './client.js';

export const conversationApi = {
  createSession: (body: Record<string, unknown>) => request('/conversations/sessions', { method: 'POST', body: JSON.stringify(body) }),
  listSessions: (tenantId: string) => request(`/conversations/sessions/${tenantId}`),
  searchSessions: (tenantId: string, q: string) => request(`/conversations/sessions/${tenantId}/search?q=${encodeURIComponent(q)}`),
  getSession: (tenantId: string, id: string) => request(`/conversations/sessions/${tenantId}/${id}`),
  getMessages: (tenantId: string, id: string) => request(`/conversations/sessions/${tenantId}/${id}/messages`),
  sendMessage: (tenantId: string, id: string, content: string) =>
    request(`/conversations/sessions/${tenantId}/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  setPinned: (tenantId: string, id: string, pinned: boolean) =>
    request(`/conversations/sessions/${tenantId}/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ pinned }) }),
  rename: (tenantId: string, id: string, title: string) =>
    request(`/conversations/sessions/${tenantId}/${id}/rename`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteSession: (tenantId: string, id: string) =>
    request(`/conversations/sessions/${tenantId}/${id}`, { method: 'DELETE' }),

  createPromptTemplate: (body: Record<string, unknown>) => request('/conversations/prompt-templates', { method: 'POST', body: JSON.stringify(body) }),
  listPromptTemplates: (tenantId: string) => request(`/conversations/prompt-templates/${tenantId}`),
};
