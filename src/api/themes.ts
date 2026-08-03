import { request } from './client';

export async function listThemes(tenantId: string): Promise<any[]> {
  return request(`/themes/${tenantId}`);
}

export async function getTheme(tenantId: string, id: string): Promise<any> {
  return request(`/themes/${tenantId}/${id}`);
}

export async function createTheme(_tenantId: string, data: any): Promise<any> {
  return request(`/themes`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTheme(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/themes/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTheme(tenantId: string, id: string): Promise<void> {
  await request(`/themes/${tenantId}/${id}`, { method: 'DELETE' });
}
