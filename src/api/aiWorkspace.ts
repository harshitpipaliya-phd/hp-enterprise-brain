import { request } from './client';

const P = '/ai';

export async function listWorkspaceSessions(_tenantId: string): Promise<any[]> {
  return request(`${P}/workspace/sessions`);
}

export async function createWorkspaceSession(_tenantId: string, title: string): Promise<any> {
  return request(`${P}/workspace/sessions`, { method: 'POST', body: JSON.stringify({ title }) });
}

export async function getSessionMessages(_tenantId: string, sessionId: string): Promise<any[]> {
  return request(`${P}/workspace/sessions/${sessionId}/messages`);
}

export async function sendMessage(_tenantId: string, sessionId: string, message: string): Promise<any> {
  return request(`${P}/workspace/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ message }) });
}

export async function regenerateMessage(_tenantId: string, sessionId: string, messageId: string): Promise<any> {
  return request(`${P}/workspace/sessions/${sessionId}/messages/${messageId}/regenerate`, { method: 'POST' });
}

export async function explainMessage(_tenantId: string, sessionId: string, messageId: string): Promise<any> {
  return request(`${P}/workspace/sessions/${sessionId}/messages/${messageId}/explain`, { method: 'POST' });
}

export async function getFollowUpQuestions(_tenantId: string, sessionId: string, messageId: string): Promise<string[]> {
  return request(`${P}/workspace/sessions/${sessionId}/messages/${messageId}/follow-up`);
}
