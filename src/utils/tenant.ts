/**
 * Local-development tenant resolver.
 *
 * The backend JWT issued by /auth/dev-token contains tenantId = demo-tenant.
 * All protected routes require the URL tenant segment to match the JWT tenantId.
 * This helper centralizes the fallback so components do not hardcode 't1',
 * 'default', or any other mismatched value.
 */

export function getTenantId(): string {
  return import.meta.env.VITE_TENANT_ID || 'demo-tenant';
}
