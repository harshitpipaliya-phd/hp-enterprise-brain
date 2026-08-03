import { request } from './client';

export async function listDashboards(tenantId: string, orgId?: string): Promise<any[]> {
  const url = orgId ? `/dashboards/${tenantId}?org_id=${orgId}` : `/dashboards/${tenantId}`;
  return request(url);
}

export async function getDashboard(tenantId: string, id: string): Promise<any> {
  return request(`/dashboards/${tenantId}/${id}`);
}

export async function createDashboard(_tenantId: string, data: any): Promise<any> {
  return request(`/dashboards`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDashboard(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/dashboards/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteDashboard(tenantId: string, id: string): Promise<void> {
  await request(`/dashboards/${tenantId}/${id}`, { method: 'DELETE' });
}
