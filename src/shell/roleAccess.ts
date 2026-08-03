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

const TENANT_ADMIN: View[] = [
  'home', 'commandcenter', 'list', 'departments', 'people', 'capabilities',
  'signals', 'evidence', 'deliberation', 'workspace', 'executions',
  'executive', 'analytics', 'decisionintel', 'mentalmodels', 'graph',
  'kasbaexplorer', 'search', 'copilot', 'aiworkspace', 'knowledgelibrary',
  'memory', 'esolibrary', 'tasks', 'policies', 'settings',
];

const MANAGER: View[] = [
  'home', 'commandcenter', 'departments', 'people', 'capabilities',
  'signals', 'evidence', 'deliberation', 'workspace', 'executions',
  'executive', 'analytics', 'decisionintel', 'tasks', 'settings',
];

const ANALYST: View[] = [
  'home', 'commandcenter', 'departments', 'people', 'capabilities',
  'signals', 'evidence', 'deliberation', 'workspace', 'analytics',
  'decisionintel', 'mentalmodels', 'graph', 'search', 'copilot',
  'aiworkspace', 'knowledgelibrary', 'memory', 'settings',
];

const VIEWER: View[] = [
  'home', 'commandcenter', 'departments', 'people', 'capabilities',
  'executive', 'analytics', 'decisionintel', 'graph', 'search', 'settings',
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
