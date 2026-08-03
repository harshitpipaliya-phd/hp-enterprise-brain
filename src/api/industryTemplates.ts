import { request } from './client';

export async function listIndustryTemplates(tenantId: string): Promise<any[]> {
  return request(`/industry-templates/${tenantId}`);
}

export async function getIndustryTemplate(tenantId: string, id: string): Promise<any> {
  return request(`/industry-templates/${tenantId}/${id}`);
}

export async function createIndustryTemplate(_tenantId: string, data: any): Promise<any> {
  return request(`/industry-templates`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateIndustryTemplate(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/industry-templates/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteIndustryTemplate(tenantId: string, id: string): Promise<void> {
  await request(`/industry-templates/${tenantId}/${id}`, { method: 'DELETE' });
}
