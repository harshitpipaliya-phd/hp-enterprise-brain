import { request } from './client';

export async function listOrganizationConfigs(tenantId: string, orgId?: string): Promise<any[]> {
  const url = orgId ? `/organization-configs/${tenantId}?org_id=${orgId}` : `/organization-configs/${tenantId}`;
  return request(url);
}

export async function getOrganizationConfig(tenantId: string, id: string): Promise<any> {
  return request(`/organization-configs/${tenantId}/${id}`);
}

export async function createOrganizationConfig(_tenantId: string, data: any): Promise<any> {
  return request(`/organization-configs`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOrganizationConfig(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/organization-configs/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteOrganizationConfig(tenantId: string, id: string): Promise<void> {
  await request(`/organization-configs/${tenantId}/${id}`, { method: 'DELETE' });
}
