const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Auth tokens are an active browser-tab session, not a durable preference.
 * Workspace chrome may remember UI context separately, but it is ignored until
 * these tokens exist in sessionStorage after an explicit login.
 */
export function getAccessToken(): string {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getRefreshToken(): string {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function persistAuthTokens(accessToken: string, refreshToken: string): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    clearLegacyPersistentTokens();
  } catch {
    clearAuthTokens();
  }
}

export function updateAccessTokens(accessToken: string, refreshToken?: string): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    clearLegacyPersistentTokens();
  } catch {
    clearAuthTokens();
  }
}

export function clearAuthTokens(): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing useful to do; callers still clear local UI session state.
  }
  clearLegacyPersistentTokens();
}

export function clearLegacyPersistentTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Local persistence is legacy only. Failing to clear it must not crash login.
  }
}
