import { request } from './client';

export async function listForms(tenantId: string, orgId?: string, entityType?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId);
  if (entityType) params.set('entity_type', entityType);
  return request(`/forms/${tenantId}?${params.toString()}`);
}

export async function getForm(tenantId: string, id: string): Promise<any> {
  return request(`/forms/${tenantId}/${id}`);
}

export async function createForm(_tenantId: string, data: any): Promise<any> {
  return request(`/forms`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateForm(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/forms/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteForm(tenantId: string, id: string): Promise<void> {
  await request(`/forms/${tenantId}/${id}`, { method: 'DELETE' });
}
