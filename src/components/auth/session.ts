import { persistAuthTokens } from '../../utils/authTokens';

/**
 * What Signup and Login both produce, and what both do with it.
 *
 * Distinct from utils/session.ts, which persists the WORKSPACE session — the
 * selected organization, the current view, the role the sidebar filters on.
 * This is narrower: the credential half, plus the shape the two auth screens
 * hand back to App so it has exactly one thing to react to.
 *
 * The API returns the same envelope from /auth/signup as from /auth/login, so
 * one type covers both and the client needs no second bootstrap path.
 */

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationLogo?: string | null;
  role: string;
}

/**
 * Store the tokens the rest of the app reads.
 *
 * api/client.ts and utils/tenant.ts both read the token through the shared
 * auth-token helper, so this is where the auth screens agree on that contract
 * rather than each writing it themselves.
 */
export function persistTokens(session: AuthSession): void {
  persistAuthTokens(session.accessToken, session.refreshToken);
}

/**
 * Build a session from an /auth/login or /auth/signup response body.
 *
 * Shared so the two screens cannot disagree about which field of the envelope
 * means what — the bug this prevents is a signup that lands in the workspace
 * with an empty organization name because it read `data.org` instead.
 */
export function sessionFromResponse(data: any, fallbackEmail = ''): AuthSession {
  const user = data?.user ?? {};
  const org = data?.organization ?? {};

  return {
    accessToken: data?.accessToken ?? '',
    refreshToken: data?.refreshToken ?? '',
    email: user.email || fallbackEmail,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.email ||
      fallbackEmail,
    organizationId: String(org.id ?? ''),
    organizationName: String(org.name ?? ''),
    organizationLogo: org.logo ?? null,
    role: String(user.role ?? ''),
  };
}
