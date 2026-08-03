import type { OrganizationRow } from '../api/organization';

/**
 * What survives a page refresh.
 *
 * THE DEFECT THIS EXISTS FOR. The access token was the only thing written to
 * localStorage, so on refresh the app knew the user was signed in but nothing
 * else about them. `userRole` came back as null, and Sidebar's role filter has
 * no null branch — it falls through to 'member', whose allow-list is exactly
 * ['commandcenter', 'settings']. Every other screen vanished from the nav, and
 * the user's own account appeared to have been demoted by pressing F5.
 *
 * The selected organization had the same shape of problem for a different
 * reason: it WAS restored, but only after listOrganizations() came back. Every
 * view in App.tsx is gated on `selected` being non-null, so until that request
 * resolved the content pane rendered nothing at all. Against the remote
 * database in this deployment that is well over a second of blank screen on
 * every refresh, and a permanently blank screen if the request fails.
 *
 * Both are fixed by persisting the answer and reading it back SYNCHRONOUSLY, so
 * the first render after a refresh already knows who the user is and which
 * organization they were looking at. The network is then confirmation rather
 * than a prerequisite.
 *
 * NOT A SECURITY BOUNDARY. Everything here is advisory UI state and the user
 * can edit all of it. The role stored here decides which menu items are drawn,
 * never what the API permits: authorization is re-checked server-side from the
 * signed JWT on every request. A tampered role gets a nav item that 403s.
 */
export interface StoredSession {
  role: string | null;
  organization: OrganizationRow | null;
  view: string | null;
}

const KEY = 'hpbrain-session';

const EMPTY: StoredSession = { role: null, organization: null, view: null };

export function loadSession(): StoredSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw);

    // Field-by-field rather than trusting the parse. This value outlives
    // deploys, so a build that changed the shape must not hand a malformed
    // organization to a component that will crash on it.
    return {
      role: typeof parsed?.role === 'string' ? parsed.role : null,
      organization:
        parsed?.organization && typeof parsed.organization?.id === 'string'
          ? (parsed.organization as OrganizationRow)
          : null,
      view: typeof parsed?.view === 'string' ? parsed.view : null,
    };
  } catch {
    // Corrupt JSON must not brick the app into a permanent white screen. A
    // forgotten session costs one navigation; an exception here costs the
    // whole page, on every load, with no way for the user to recover.
    return EMPTY;
  }
}

export function saveSession(patch: Partial<StoredSession>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadSession(), ...patch }));
  } catch {
    // Quota exceeded or storage disabled (private browsing). The app works
    // without persistence; it just forgets on refresh, which is the behaviour
    // that existed before this file.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do; sign-out clears the tokens regardless.
  }
}
