import { request } from './client';

export async function listEntityMappings(tenantId: string, sourceSystem?: string): Promise<any[]> {
  const url = sourceSystem ? `/entity-mappings/${tenantId}?source_system=${sourceSystem}` : `/entity-mappings/${tenantId}`;
  return request(url);
}

export async function getEntityMapping(tenantId: string, id: string): Promise<any> {
  return request(`/entity-mappings/${tenantId}/${id}`);
}

export async function createEntityMapping(_tenantId: string, data: any): Promise<any> {
  return request(`/entity-mappings`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEntityMapping(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/entity-mappings/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteEntityMapping(tenantId: string, id: string): Promise<void> {
  await request(`/entity-mappings/${tenantId}/${id}`, { method: 'DELETE' });
}
