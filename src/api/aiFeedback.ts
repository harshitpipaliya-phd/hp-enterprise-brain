import { request } from './client';

const P = '/ai';

export async function listFeedback(tenantId: string, executionId?: string): Promise<any[]> {
  const url = executionId ? `${P}/feedback/${tenantId}?execution_id=${executionId}` : `${P}/feedback/${tenantId}`;
  return request(url);
}

export async function getFeedback(tenantId: string, id: string): Promise<any> {
  return request(`${P}/feedback/${tenantId}/${id}`);
}

export async function createFeedback(_tenantId: string, data: { executionId: string; rating: string; feedbackText?: string; feedbackType?: string }): Promise<any> {
  return request(`${P}/feedback`, { method: 'POST', body: JSON.stringify(data) });
}
