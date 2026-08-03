import { request } from './client';

export async function listConfigVersions(tenantId: string, configType?: string, configKey?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (configType) params.set('config_type', configType);
  if (configKey) params.set('config_key', configKey);
  return request(`/config-versions/${tenantId}?${params.toString()}`);
}

export async function getConfigVersion(tenantId: string, id: string): Promise<any> {
  return request(`/config-versions/${tenantId}/${id}`);
}

export async function createConfigVersion(_tenantId: string, data: any): Promise<any> {
  return request(`/config-versions`, { method: 'POST', body: JSON.stringify(data) });
}

export async function activateConfigVersion(tenantId: string, id: string): Promise<any> {
  return request(`/config-versions/${tenantId}/${id}/activate`, { method: 'POST' });
}

export async function rollbackConfigVersion(tenantId: string, id: string): Promise<any> {
  return request(`/config-versions/${tenantId}/${id}/rollback`, { method: 'POST' });
}
