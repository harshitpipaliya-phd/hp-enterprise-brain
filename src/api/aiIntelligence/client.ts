import { ApiError, request } from '../client';

/**
 * The one HTTP client for HP Brain's AI & Intelligence API.
 *
 * Ported from G2G's lib/intelligence/client.ts, with one deliberate difference:
 * it rides on HP Brain's own `request()` rather than a second fetch wrapper, so
 * the JWT, the refresh-on-401 and the session-expired handling are the ones every
 * other screen already uses.
 *
 * NOTHING HERE NAMES AN ORGANISATION. The tenant is derived on the server from the
 * signed JWT (EnsureTenantScope), so the only thing sent is the token that
 * `request()` already attaches. There is no tenant id in any path and there must
 * never be one — a fallback tenant is how one organisation's console ends up
 * showing another's rows.
 *
 * The envelope is G2G's `{success, message, data, errors}`, because the screens
 * above this are ported from there and a second envelope would mean rewriting
 * every one of them.
 */

export interface AiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors?: Record<string, string[]> | null;
}

/**
 * A failed AI API call. `fieldErrors` carries Laravel's per-field validator
 * messages so a form can mark its own inputs.
 */
export class AiApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'AiApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const PREFIX = '/ai-intelligence';

export async function aiRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  let payload: AiEnvelope<T> | null;

  try {
    payload = await request(`${PREFIX}${path}`, {
      method,
      // An administration console reads what it just wrote. The shared 15s GET
      // cache would show the row from before the save.
      cacheTtlMs: 0,
      camelAliases: false,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    if (cause instanceof ApiError) {
      const json = (cause.responseJson ?? {}) as Partial<AiEnvelope<unknown>>;
      throw new AiApiError(
        json.message || cause.message || `The request failed (${cause.status}).`,
        cause.status ?? 0,
        (json.errors as Record<string, string[]>) ?? {},
      );
    }
    throw cause;
  }

  if (!payload || payload.success === false) {
    throw new AiApiError(payload?.message || 'The request failed.', 200, payload?.errors ?? {});
  }

  return payload.data as T;
}

/**
 * The most useful sentence an error carries: the first field error where there
 * is one, because Laravel puts the reason there and a generic `message` above it.
 */
export function describeAiError(cause: unknown, fallback = 'The request failed.'): string {
  if (cause instanceof AiApiError) {
    const first = Object.values(cause.fieldErrors ?? {}).flat()[0];
    return first || cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}
