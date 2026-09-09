/**
 * One sentence out of any API failure.
 *
 * The API answers errors as RFC 9457 problem details (`title`, `detail`,
 * `status`); the older Next.js bridge routes answered `{ error }`. Callers
 * across the UI read a single string, so both shapes resolve here.
 */
export function readApiError(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null) {
    const body = payload as {
      error?: unknown;
      detail?: unknown;
      title?: unknown;
      message?: unknown;
    };
    for (const candidate of [body.error, body.detail, body.message, body.title]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
  }
  if (status === 401) return 'Sign in to the WE-ADK API first.';
  if (status === 403) return 'You do not have access to that.';
  if (status === 0) return 'Could not reach the WE-ADK API.';
  return `Request failed (${status}).`;
}

/** Reads the body as JSON when there is one; `null` for empty or non-JSON bodies. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
