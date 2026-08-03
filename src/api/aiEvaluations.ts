import { request } from './client';

const P = '/ai';

export async function listEvaluations(tenantId: string): Promise<any[]> {
  return request(`${P}/evaluations/${tenantId}`);
}

export async function getEvaluation(tenantId: string, id: string): Promise<any> {
  return request(`${P}/evaluations/${tenantId}/${id}`);
}

export async function createEvaluation(_tenantId: string, data: any): Promise<any> {
  return request(`${P}/evaluations`, { method: 'POST', body: JSON.stringify(data) });
}

export async function runEvaluation(tenantId: string, id: string, model?: string): Promise<any> {
  return request(`${P}/evaluations/${tenantId}/${id}/run`, { method: 'POST', body: JSON.stringify({ model }) });
}

export async function getEvaluationResults(tenantId: string, id: string): Promise<any> {
  return request(`${P}/evaluations/${tenantId}/${id}/results`);
}
