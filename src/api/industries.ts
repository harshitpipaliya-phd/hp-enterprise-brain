import { request } from './client';

export async function listIndustries(tenantId: string): Promise<any[]> {
  return request(`/industries/${tenantId}`);
}

export async function getIndustry(tenantId: string, id: string): Promise<any> {
  return request(`/industries/${tenantId}/${id}`);
}

export async function createIndustry(_tenantId: string, data: any): Promise<any> {
  return request(`/industries`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateIndustry(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/industries/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteIndustry(tenantId: string, id: string): Promise<void> {
  await request(`/industries/${tenantId}/${id}`, { method: 'DELETE' });
}
