import { request } from './client';

const P = '/ai';

export async function listProviders(_tenantId: string): Promise<any[]> {
  return request(`${P}/providers`);
}

export async function createProvider(_tenantId: string, data: any): Promise<any> {
  return request(`${P}/providers`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProvider(tenantId: string, id: string, data: any): Promise<any> {
  return request(`${P}/providers/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteProvider(tenantId: string, id: string): Promise<void> {
  await request(`${P}/providers/${tenantId}/${id}`, { method: 'DELETE' });
}

export async function testProvider(tenantId: string, id: string): Promise<any> {
  return request(`${P}/providers/${tenantId}/${id}/test`, { method: 'POST' });
}

export async function setActiveProvider(tenantId: string, id: string): Promise<any> {
  return request(`${P}/providers/${tenantId}/${id}/activate`, { method: 'POST' });
}
