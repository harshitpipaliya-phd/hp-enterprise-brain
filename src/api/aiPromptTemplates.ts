import { request } from './client';

const P = '/ai';

export async function listPromptTemplates(tenantId: string): Promise<any[]> {
  return request(`${P}/prompt-templates/${tenantId}`);
}

export async function getPromptTemplate(tenantId: string, id: string): Promise<any> {
  return request(`${P}/prompt-templates/${tenantId}/${id}`);
}

export async function createPromptTemplate(_tenantId: string, data: any): Promise<any> {
  return request(`${P}/prompt-templates`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePromptTemplate(tenantId: string, id: string, data: any): Promise<any> {
  return request(`${P}/prompt-templates/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deletePromptTemplate(tenantId: string, id: string): Promise<void> {
  await request(`${P}/prompt-templates/${tenantId}/${id}`, { method: 'DELETE' });
}

export async function getPromptTemplateVersions(tenantId: string, id: string): Promise<any[]> {
  return request(`${P}/prompt-templates/${tenantId}/${id}/versions`);
}

export async function renderPromptTemplate(tenantId: string, id: string, context: Record<string, string>): Promise<any> {
  return request(`${P}/prompt-templates/${tenantId}/${id}/render?context=${encodeURIComponent(JSON.stringify(context))}`);
}
