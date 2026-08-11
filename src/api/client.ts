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
import { globalLoading, type GlobalLoaderMode } from '../ui/globalLoading';

export { API_ORIGIN, API_BASE };

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly method: string;
  readonly responseText: string;
  readonly responseJson: unknown;

  constructor(message: string, details: {
    status: number;
    statusText: string;
    url: string;
    method: string;
    responseText: string;
    responseJson: unknown;
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = details.status;
    this.statusText = details.statusText;
    this.url = details.url;
    this.method = details.method;
    this.responseText = details.responseText;
    this.responseJson = details.responseJson;
  }
}

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

function parseResponseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const objectStart = text.indexOf('{');
    if (objectStart >= 0) {
      try {
        return JSON.parse(text.slice(objectStart));
      } catch {
        return null;
      }
    }
    return null;
  }
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

export type ApiRequestOptions = RequestInit & {
  globalLoader?: GlobalLoaderMode | 'auto';
};

function resolveGlobalLoaderMode(options: ApiRequestOptions): GlobalLoaderMode {
  const requested = options.globalLoader ?? 'auto';
  if (requested !== 'auto') return requested;

  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return globalLoading.isNavigationPending() ? 'page' : 'none';
  }

  return 'mutation';
}

export async function request(path: string, options: ApiRequestOptions = {}, _isRetry = false): Promise<any> {
  const loaderMode = resolveGlobalLoaderMode(options);
  globalLoading.requestStarted(loaderMode);
  try {
  const { globalLoader: _globalLoader, ...requestOptions } = options;
  const isFormData = requestOptions.body instanceof FormData;
  const url = `${API_BASE}${path}`;
  const method = requestOptions.method || 'GET';

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(requestOptions.headers as Record<string, string>),
    Authorization: `Bearer ${authToken()}`,
  };

  let res: Response;
  try {
    res = await fetch(url, { ...requestOptions, headers });
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
      const body = parseResponseJson(text) as Record<string, any> | null;
      if (!body || typeof body !== 'object') throw new SyntaxError('Response body is not JSON');
      // A 422 carries the useful detail in `errors`, keyed by field name —
      // "The source id field is required." names what to fix, where the
      // status line alone ("Unprocessable Content") names only that something
      // was wrong. Falls through to the old order when there is no such key.
      const fieldError =
        body.errors && typeof body.errors === 'object'
          ? (Object.values(body.errors as Record<string, string[]>).flat()[0] as string | undefined)
          : undefined;
      throw new ApiError(fieldError || body.error || body.message || res.statusText, {
        status: res.status,
        statusText: res.statusText,
        url,
        method,
        responseText: text,
        responseJson: body,
      });
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        throw new ApiError(res.statusText || `HTTP ${res.status}`, {
          status: res.status,
          statusText: res.statusText,
          url,
          method,
          responseText: text,
          responseJson: null,
        });
      }
      throw e;
    }
  }

  return text ? addCamelAliases(JSON.parse(text)) : null;
  } finally {
    globalLoading.requestFinished(loaderMode);
  }
}
