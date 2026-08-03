import { request } from './client';

export async function listTerminology(tenantId: string, industryCode?: string, entityType?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (industryCode) params.set('industry_code', industryCode);
  if (entityType) params.set('entity_type', entityType);
  return request(`/terminology/${tenantId}?${params.toString()}`);
}

export async function getTerminology(tenantId: string, id: string): Promise<any> {
  return request(`/terminology/${tenantId}/${id}`);
}

export async function createTerminology(_tenantId: string, data: any): Promise<any> {
  return request(`/terminology`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTerminology(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/terminology/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTerminology(tenantId: string, id: string): Promise<void> {
  await request(`/terminology/${tenantId}/${id}`, { method: 'DELETE' });
}
