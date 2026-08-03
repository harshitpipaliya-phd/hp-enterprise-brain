import { request } from './client';

export async function listBranding(tenantId: string, orgId?: string): Promise<any[]> {
  const url = orgId ? `/branding/${tenantId}?org_id=${orgId}` : `/branding/${tenantId}`;
  return request(url);
}

export async function getBranding(tenantId: string, id: string): Promise<any> {
  return request(`/branding/${tenantId}/${id}`);
}

export async function createBranding(_tenantId: string, data: any): Promise<any> {
  return request(`/branding`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBranding(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/branding/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBranding(tenantId: string, id: string): Promise<void> {
  await request(`/branding/${tenantId}/${id}`, { method: 'DELETE' });
}
