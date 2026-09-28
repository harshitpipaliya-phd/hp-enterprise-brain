/**
 * HP Brain's answer to LMS_K12's `app/hooks/usePermission.ts` and G2G's adapter, with
 * the same exports and shapes, because the shared AI Stack screens import them by name.
 *
 * WHAT THE FLAGS MEAN HERE
 *
 * Every endpoint these screens call sits behind `permission:settings.manage`
 * (routes/api.php, the ai-intelligence group), which only the `admin` and
 * `tenant_admin` roles hold. So "may this person create, run or remove an AI Stack
 * agent" is exactly "is their JWT role one of those". The server enforces the same
 * rule; this hook only lets a screen say so before a request is refused.
 */

import { useMemo } from 'react';

import { getAuthRole } from '../../../utils/tenant';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export type ModulePermissions = Record<PermissionAction, boolean>;

export type PermissionsState = {
  permissions: Record<string, ModulePermissions> | undefined;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  refresh: () => void;
};

/** The roles that hold settings.manage (app/Domain/Authorization/Role.php). */
export const AI_STACK_ROLES: readonly string[] = ['admin', 'tenant_admin'];

export function canUseAiStack(role: string | null | undefined): boolean {
  return !!role && AI_STACK_ROLES.includes(role);
}

const noop = () => undefined;

export function usePermissions(modules: string[]): PermissionsState {
  const role = getAuthRole();
  const key = modules.join(',');

  return useMemo(() => {
    if (!role) {
      return { permissions: undefined, loading: false, authenticated: false, error: null, refresh: noop };
    }

    const allowed = canUseAiStack(role);
    const flags: ModulePermissions = { view: allowed, create: allowed, update: allowed, delete: allowed };

    return {
      permissions: Object.fromEntries(key.split(',').filter(Boolean).map((module) => [module, flags])),
      loading: false,
      authenticated: true,
      error: null,
      refresh: noop,
    };
  }, [role, key]);
}

export function usePermission(module: string, action: PermissionAction): boolean | undefined {
  const modules = useMemo(() => [module], [module]);
  const { permissions, authenticated } = usePermissions(modules);

  if (!authenticated || !permissions) return undefined;

  return permissions[module]?.[action] ?? false;
}
