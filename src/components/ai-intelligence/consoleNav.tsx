import React from 'react';

/**
 * Navigation inside the AI & Intelligence console.
 *
 * G2G gets this from the Next router: `/ai`, `/ai/providers`, `/ai/prompts/12/edit`.
 * HP Brain has no URL router — App.tsx holds a `view` in state — so the console is
 * one view ('ai') and carries its own sub-route string in the same shapes G2G's
 * URLs have, minus the `/ai` prefix: '', 'providers', 'prompts/new?module=signals',
 * 'prompts/12', 'prompts/12/edit'. Screens ported from G2G swap `router.push('/ai/x')`
 * for `go('x')` and otherwise read the same.
 */

export interface ConsoleRoute {
  /** Path segments after the console root, e.g. ['prompts', '12', 'edit']. */
  segments: string[];
  /** Query parameters, e.g. { module: 'signals' }. */
  query: Record<string, string>;
}

export function parseConsoleRoute(route: string): ConsoleRoute {
  const [path, search = ''] = route.replace(/^\/+/, '').split('?');
  const segments = path.split('/').filter(Boolean);
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(search)) query[k] = v;
  return { segments, query };
}

export interface ConsoleNav {
  route: ConsoleRoute;
  /** Go to a console sub-route: '' for the index, 'prompts/new?module=x', … */
  go: (route: string) => void;
  /** Leave the console for another HP Brain screen, such as 'agents'. */
  openView: (view: string) => void;
}

const ConsoleNavContext = React.createContext<ConsoleNav | null>(null);

export const ConsoleNavProvider = ConsoleNavContext.Provider;

export function useConsoleNav(): ConsoleNav {
  const nav = React.useContext(ConsoleNavContext);
  if (!nav) throw new Error('useConsoleNav must be used inside the AI & Intelligence console.');
  return nav;
}
