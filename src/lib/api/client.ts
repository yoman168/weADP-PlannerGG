/**
 * The typed client.
 *
 * Every request and response shape here comes from `schema.d.ts`, which is generated from
 * `openapi/openapi.json`, which is exported from the Java controllers. So a DTO that
 * changes shape on the API fails this build rather than a user's afternoon — which is the
 * whole reason the generation step exists and why CI fails when either file is stale.
 *
 *   pnpm api:export   # running API → openapi/openapi.json
 *   pnpm api:types    # openapi/openapi.json → src/lib/api/schema.d.ts
 *
 * Browser-side. It talks to the API directly, so `NEXT_PUBLIC_API_BASE_URL` must be a host
 * the browser can reach and that host must allow this origin (`weadk.cors.allowed-origins`
 * on the API). The AI routes are the exception: those go through the proxies under
 * `src/app/api/`, so they stay same-origin and carry no CORS requirement.
 */
import createClient, { type Middleware } from 'openapi-fetch';
import { API_BASE_URL } from './base';
import { readApiError } from './errors';
import type { paths } from './schema';
import { clearApiSession, getApiToken } from './session';

/**
 * Attaches the bearer token, and drops a session the API has stopped accepting.
 *
 * The clear on 401 matters: without it a token that expired overnight leaves the app
 * looking signed in and failing every request, which reads as the API being broken.
 */
const session: Middleware = {
  onRequest({ request }) {
    const token = typeof window === 'undefined' ? null : getApiToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401 && typeof window !== 'undefined' && getApiToken()) {
      clearApiSession();
    }
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: API_BASE_URL });
api.use(session);

/** Shorthand for the generated schema types: `Schema<'ProjectView'>`. */
export type Schema<K extends keyof Components> = Components[K];
type Components = NonNullable<import('./schema').components['schemas']>;

/**
 * Unwraps an `openapi-fetch` result into the value or a thrown error.
 *
 * The library returns `{ data, error }` rather than throwing, which is right for a
 * library and tiring at every call site. This is the adapter for the common case: give me
 * the value, or throw something with a sentence in it I can show.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined || !response.ok) {
    throw new ApiError(readApiError(error, response.status), response.status);
  }
  // A 204 legitimately has no body; callers of those use `void` as T.
  return data as T;
}

/** A failed API call, carrying the sentence to show and the status it came with. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
