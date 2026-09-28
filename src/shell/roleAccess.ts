import type { View } from '../App';
import { NAV_VIEWS, VIEW_META } from './viewMeta';

/**
 * Which views each role may see in the navigation.
 *
 * LIFTED VERBATIM from the previous Sidebar.tsx. Not re-derived, not tidied,
 * not "improved" — the allow-lists below are character-for-character the ones
 * that were shipping, because this controls what users can reach and a
 * redesign is not the place to quietly widen or narrow it. Any change here is a
 * product decision, not a styling one.
 *
 * ADVISORY ONLY. This decides which menu items are drawn. It is not an
 * authorization boundary: the API re-checks permissions from the signed JWT on
 * every request, so a view reached by other means still 403s.
 */

/** Every Platform Services view, in menu order — derived, so VIEW_META stays the one definition. */
export const PLATFORM_SERVICES: View[] = (Object.keys(VIEW_META) as View[])
  .filter((v) => VIEW_META[v].section === 'Platform Services');

const TENANT_ADMIN: View[] = [
  'home', 'commandcenter', 'list', 'departments', 'people', 'capabilities',
  // Ingestion writes real Signals under a provenance record, and its four
  // routes all carry permission:settings.manage. Kept out of the other role
  // lists to match that, rather than widened here where the API would 403.
  'ingestion',
  'signals', 'evidence', 'cases', 'deliberation', 'memory', 'workspace', 'executions',
  'executive', 'analytics', 'decisionintel', 'mentalmodels', 'graph',
  'kasbaexplorer', 'aiassistant', 'globalsearch', 'knowledgelibrary', 'esolibrary', 'tasks',
  'policies', 'settings',
  // Platform Services. RBAC, Scheduler, Document and Integration read routes
  // carrying settings.manage; Audit and Event Bus expose tenant-wide history.
  ...PLATFORM_SERVICES,
  // AI & Intelligence: every /ai-intelligence route carries
  // permission:settings.manage, which only admin and tenant_admin hold.
  'ai',
];

const MANAGER: View[] = [
  'home', 'commandcenter', 'departments', 'people', 'capabilities',
  'signals', 'evidence', 'cases', 'deliberation', 'workspace', 'executions',
  'executive', 'analytics', 'decisionintel', 'tasks', 'settings',
  // Managers hold decision.approve, so the approval queue is theirs to work.
  'workflow', 'notifications',
];

const ANALYST: View[] = [
  'home', 'commandcenter', 'departments', 'people', 'capabilities',
  'signals', 'evidence', 'deliberation', 'memory', 'workspace', 'analytics',
  'decisionintel', 'mentalmodels', 'graph', 'aiassistant', 'knowledgelibrary',
  'settings', 'notifications',
];

const VIEWER: View[] = [
  'home', 'commandcenter', 'departments', 'people', 'capabilities',
  'executive', 'analytics', 'decisionintel', 'graph', 'aiassistant', 'settings',
  'notifications',
];

const MEMBER: View[] = ['home', 'commandcenter', 'settings'];

/**
 * The set of views this role may navigate to.
 *
 * An unknown or absent role falls through to MEMBER, matching the previous
 * behaviour exactly — including the case that caused the "my menu collapsed
 * after a refresh" report, where a null role silently became a member.
 */
export function visibleViewsForRole(role: string | null): Set<View> {
  if (role === 'admin') {
    // Admin sees everything the nav declares, rather than a hand-maintained
    // list that has to be extended every time a view is added.
    return new Set(Object.keys(VIEW_META) as View[]);
  }

  const allowed =
    role === 'tenant_admin' ? TENANT_ADMIN
      : role === 'manager' ? MANAGER
        : role === 'analyst' ? ANALYST
          : role === 'viewer' ? VIEWER
            : MEMBER;

  return new Set(allowed);
}

/** Nav items this role may see, in declaration order. */
export function navViewsForRole(role: string | null): View[] {
  const visible = visibleViewsForRole(role);
  return NAV_VIEWS.filter((v) => visible.has(v));
}
