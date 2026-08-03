import { request } from './client';

export async function listModules(tenantId: string): Promise<any[]> {
  return request(`/modules/${tenantId}`);
}

export async function getModule(tenantId: string, id: string): Promise<any> {
  return request(`/modules/${tenantId}/${id}`);
}

export async function createModule(_tenantId: string, data: any): Promise<any> {
  return request(`/modules`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateModule(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/modules/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteModule(tenantId: string, id: string): Promise<void> {
  await request(`/modules/${tenantId}/${id}`, { method: 'DELETE' });
}
