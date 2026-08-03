import { request } from './client';

export async function listFeatureFlags(tenantId: string): Promise<any[]> {
  return request(`/feature-flags/${tenantId}`);
}

export async function getFeatureFlag(tenantId: string, id: string): Promise<any> {
  return request(`/feature-flags/${tenantId}/${id}`);
}

export async function createFeatureFlag(_tenantId: string, data: any): Promise<any> {
  return request(`/feature-flags`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateFeatureFlag(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/feature-flags/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteFeatureFlag(tenantId: string, id: string): Promise<void> {
  await request(`/feature-flags/${tenantId}/${id}`, { method: 'DELETE' });
}
