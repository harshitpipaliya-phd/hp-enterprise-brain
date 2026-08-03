import { request } from './client';

const P = '/ai';

export async function listQuotas(tenantId: string): Promise<any[]> {
  return request(`${P}/quotas/${tenantId}`);
}

export async function getQuota(tenantId: string, id: string): Promise<any> {
  return request(`${P}/quotas/${tenantId}/${id}`);
}

export async function createQuota(_tenantId: string, data: any): Promise<any> {
  return request(`${P}/quotas`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateQuota(tenantId: string, id: string, data: any): Promise<any> {
  return request(`${P}/quotas/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function resetQuota(tenantId: string, id: string): Promise<any> {
  return request(`${P}/quotas/${tenantId}/${id}/reset`, { method: 'POST' });
}
