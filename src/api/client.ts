/**
 * Single HTTP entry point for the SPA. Every api/*.ts module goes through
 * request(), so headers and auth are configured in exactly one place.
 *
 * API_ORIGIN is the bare Laravel origin; the /api/v1 prefix is applied here so
 * callers pass resource-relative paths ('/organizations/demo-tenant') and the
 * route table in routes/api.php stays literally readable in the api modules.
 */
const API_ORIGIN: string = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const API_BASE = `${API_ORIGIN.replace(/\/+$/, '')}/api/v1`;

export { API_ORIGIN, API_BASE };

export function authToken(): string {
  return localStorage.getItem('accessToken') || '';
}

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function addCamelAliases(value: any, depth = 0): any {
  if (depth > 8 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map((v) => addCamelAliases(v, depth + 1));

  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = addCamelAliases(v, depth + 1);
  }
  for (const [k, v] of Object.entries(out)) {
    const camel = toCamel(k);
    // Never overwrite a key the server already sent in camelCase.
    if (camel !== k && !(camel in out)) out[camel] = v;
  }
  return out;
}

let refreshInFlight: Promise<boolean> | null = null;
let sessionExpiredCallback: (() => void) | null = null;

/**
 * Authentication polish: automatic token refresh on 401. A single 401 triggers
 * one refresh attempt (deduplicated via refreshInFlight so 5 simultaneous
 * requests don't each fire their own refresh call), and the original request
 * retries once with the new token. Only if refresh itself fails does the user
 * get logged out.
 */
async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const tokens = await res.json();
      localStorage.setItem('accessToken', tokens.accessToken);
      if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
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
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${authToken()}`,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    // fetch() only rejects on network-layer failure, which for this app means
    // the Laravel server is not running. Surfacing that as-is beats the
    // browser's opaque "Failed to fetch" reaching an error banner.
    throw new Error(`Cannot reach the API at ${API_ORIGIN}. Is the Laravel server running?`);
  }

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

  if (!res.ok) {
    // Laravel returns {"error":"..."} for domain failures and {"message":"..."}
    // for validation/500s. Unwrap either so error banners show the reason
    // rather than a wall of HTML or JSON.
    try {
      const body = JSON.parse(text);
      throw new Error(body.error || body.message || res.statusText);
    } catch (e: any) {
      if (e instanceof SyntaxError) throw new Error(res.statusText || `HTTP ${res.status}`);
      throw e;
    }
  }

  return text ? addCamelAliases(JSON.parse(text)) : null;
}
