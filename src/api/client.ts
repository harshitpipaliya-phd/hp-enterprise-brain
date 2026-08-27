import { globalLoading, type GlobalLoaderMode } from '../ui/globalLoading';
import { clearAuthTokens, getAccessToken, getRefreshToken, updateAccessTokens } from '../utils/authTokens';

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
  return getAccessToken();
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
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const tokens = await res.json();
      updateAccessTokens(tokens.accessToken, tokens.refreshToken);
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
  cacheTtlMs?: number;
};

type CachedGet = {
  expiresAt: number;
  value?: any;
  inFlight?: Promise<any>;
};

const DEFAULT_GET_CACHE_TTL_MS = 15_000;
const getCache = new Map<string, CachedGet>();

function resolveGlobalLoaderMode(options: ApiRequestOptions): GlobalLoaderMode {
  const requested = options.globalLoader ?? 'auto';
  if (requested !== 'auto') return requested;

  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return globalLoading.isNavigationPending() ? 'page' : 'none';
  }

  return 'mutation';
}

export function clearRequestCache(): void {
  getCache.clear();
}

export async function request(path: string, options: ApiRequestOptions = {}, _isRetry = false): Promise<any> {
  const loaderMode = resolveGlobalLoaderMode(options);
  globalLoading.requestStarted(loaderMode);
  try {
    const { globalLoader: _globalLoader, cacheTtlMs, ...requestOptions } = options;
    const isFormData = requestOptions.body instanceof FormData;
    const url = `${API_BASE}${path}`;
    const method = requestOptions.method || 'GET';
    const normalizedMethod = method.toUpperCase();
    const cacheKey = `${authToken()} ${url}`;
    const ttl = cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;

    if (normalizedMethod !== 'GET') {
      getCache.clear();
    } else if (ttl > 0) {
      const cached = getCache.get(cacheKey);
      if (cached?.value !== undefined && cached.expiresAt > Date.now()) return cached.value;
      if (cached?.inFlight) return cached.inFlight;
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(requestOptions.headers as Record<string, string>),
      Authorization: `Bearer ${authToken()}`,
    };

    const execute = async (): Promise<any> => {
      let res: Response;
      try {
        res = await fetch(url, { ...requestOptions, headers });
      } catch {
        throw new Error(`Cannot reach the API at ${API_ORIGIN}. Is the Laravel server running?`);
      }

      if (res.status === 401 && !_isRetry) {
        const refreshed = await tryRefresh();
        if (refreshed) return request(path, options, true);
        clearAuthTokens();
        sessionExpiredCallback?.();
        throw new Error('session_expired');
      }

      if (res.status === 204) return null;

      const text = await res.text();

      if (!res.ok) {
        try {
          const body = parseResponseJson(text) as Record<string, any> | null;
          if (!body || typeof body !== 'object') throw new SyntaxError('Response body is not JSON');
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
    };

    if (normalizedMethod === 'GET' && ttl > 0) {
      const inFlight = execute()
        .then((value) => {
          getCache.set(cacheKey, { value, expiresAt: Date.now() + ttl });
          return value;
        })
        .catch((error) => {
          getCache.delete(cacheKey);
          throw error;
        });
      getCache.set(cacheKey, { inFlight, expiresAt: Date.now() + ttl });
      return inFlight;
    }

    return execute();
  } finally {
    globalLoading.requestFinished(loaderMode);
  }
}
