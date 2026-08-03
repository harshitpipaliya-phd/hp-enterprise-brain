import { request } from './client';

/**
 * A node in the tenant's navigation tree.
 *
 * NavigationItem.tsx already imported this type; it had simply never been
 * declared, so the component did not compile. The shape mirrors what
 * NavigationController returns and what NavigationBuilder assembles.
 */
export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  /** Present only on branch nodes; leaves omit it entirely. */
  children?: NavigationItem[];
}

export async function listNavigation(tenantId: string, industryCode?: string, roleKey?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (industryCode) params.set('industry_code', industryCode);
  if (roleKey) params.set('role_key', roleKey);
  return request(`/navigation/${tenantId}?${params.toString()}`);
}

export async function getNavigationItem(tenantId: string, id: string): Promise<any> {
  return request(`/navigation/${tenantId}/${id}`);
}

export async function createNavigationItem(_tenantId: string, data: any): Promise<any> {
  return request(`/navigation`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateNavigationItem(tenantId: string, id: string, data: any): Promise<any> {
  return request(`/navigation/${tenantId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteNavigationItem(tenantId: string, id: string): Promise<void> {
  await request(`/navigation/${tenantId}/${id}`, { method: 'DELETE' });
}
