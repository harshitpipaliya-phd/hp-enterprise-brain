const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export { API_BASE };

let refreshInFlight: Promise<boolean> | null = null;
let sessionExpiredCallback: (() => void) | null = null;

/**
 * Authentication polish: automatic token refresh on 401. Previously, every
 * one of the 8 API client files had its own copy of request() with no
 * refresh handling at all — a 401 just threw, and the user was silently
 * logged out mid-session. Now a single 401 triggers one refresh attempt
 * (deduplicated via refreshInFlight so 5 simultaneous requests don't each
 * fire their own refresh call), and the original request retries once with
 * the new token. Only if refresh itself fails does the user get logged out.
 */
async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const tokens = await res.json();
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Registered once by App.tsx to redirect to login when refresh itself fails. */
export function onSessionExpired(callback: () => void): void {
  sessionExpiredCallback = callback;
}

export async function request(path: string, options: RequestInit = {}, _isRetry = false): Promise<any> {
  const token = localStorage.getItem('accessToken') || 'dev-bypass';
  const isFormData = options.body instanceof FormData;
  const hasBody = options.body !== undefined && options.body !== null && !isFormData;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'content-type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !_isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request(path, options, true);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    sessionExpiredCallback?.();
    throw new Error('session_expired');
  }

  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : null;
}
