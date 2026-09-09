/**
 * The server-to-server half of the API bridge.
 *
 * The AI routes under `src/app/api/` no longer do the work themselves — they forward to
 * the Spring Boot service in `backend/`. They stay in place rather than being deleted so
 * the browser keeps calling one origin: twelve call sites across the workspace post to
 * `/api/sketcher/…`, none of them need to know where the API lives, and no request from
 * the browser is subject to CORS or has to carry a backend URL.
 *
 * What each route still owns is the part that cannot move: the block catalogue and the
 * schema that validates a canvas operation against it. Both are generated from the same
 * TypeScript modules the canvas editor is drawn from, so they stay on this side and the
 * catalogue travels to the API with the request. Restating it in Java would be a second
 * definition of what a block is, drifting out of step with the first.
 *
 * Server-only. `API_INTERNAL_URL` is read at request time, not build time, so the same
 * image runs against a different API by changing one environment variable.
 */
import { readApiError, readJson } from './errors';

/** Sent by the browser to spend a personal Claude quota instead of the organisation's. */
const CLAUDE_TOKEN_HEADER = 'x-claude-token';

/** The header the API reads that same key from. */
const ANTHROPIC_KEY_HEADER = 'X-Anthropic-Api-Key';

/**
 * Where the API is, from the server's point of view.
 *
 * Separate from `NEXT_PUBLIC_API_BASE_URL` on purpose: inside a container network the API
 * is reachable at a name the browser cannot resolve (`http://api:8080`), and the two
 * values are genuinely different in every deployment that has more than one host.
 */
export function backendUrl(path: string): string {
  const base = (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:8080'
  ).replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Headers for a forwarded request.
 *
 * The caller's bearer token is passed straight through when there is one, so the API sees
 * the person who made the request rather than the proxy. `WEADK_API_TOKEN` is the fallback
 * for a deployment where the browser has no token of its own — a service credential for
 * this one hop, never sent to the browser.
 */
export function backendHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers.Authorization = authorization;
  } else if (process.env.WEADK_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.WEADK_API_TOKEN}`;
  }

  // The workspace has always let a user bring their own Claude credential; this is the
  // same header it has always sent, renamed on the way through to what the API reads.
  const claudeToken = request.headers.get(CLAUDE_TOKEN_HEADER)?.trim();
  if (claudeToken) {
    headers[ANTHROPIC_KEY_HEADER] = claudeToken;
  }
  return headers;
}

/** What a forwarded call came back with: parsed body, or the sentence that went wrong. */
export type Forwarded<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/**
 * Posts to the API and reads the answer.
 *
 * Errors are flattened to one sentence here. The API answers failures as RFC 9457 problem
 * details, and every caller in the workspace reads `payload.error` — so the translation
 * happens once, at the boundary, rather than in twelve components.
 */
export async function forward<T>(
  request: Request,
  path: string,
  body: unknown,
): Promise<Forwarded<T>> {
  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      method: 'POST',
      headers: backendHeaders(request),
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: request.signal,
    });
  } catch (error) {
    // An abort is the user pressing escape, not a failure worth reporting as one.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, status: 499, error: 'Cancelled.' };
    }
    return {
      ok: false,
      status: 503,
      error: `Could not reach the WE-ADK API at ${backendUrl(path)}. Is it running?`,
    };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    return { ok: false, status: response.status, error: readApiError(payload, response.status) };
  }
  return { ok: true, data: payload as T };
}

/**
 * Posts to the API and hands the response body back untouched, for streaming routes.
 *
 * The body is passed through rather than read, so the first token reaches the browser as
 * soon as the API produces it. Buffering here would make the streaming pointless.
 */
export async function forwardStream(
  request: Request,
  path: string,
  body: unknown,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      method: 'POST',
      headers: { ...backendHeaders(request), Accept: 'application/x-ndjson' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: request.signal,
      // Node's fetch buffers a request body without this; the response is unaffected but
      // it keeps a large chat payload from being copied twice.
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    return Response.json(
      { error: `Could not reach the WE-ADK API at ${backendUrl(path)}. Is it running?` },
      { status: 503 },
    );
  }

  if (!response.ok || !response.body) {
    const payload = await readJson(response);
    return Response.json(
      { error: readApiError(payload, response.status) },
      { status: response.status },
    );
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
