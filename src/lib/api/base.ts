/**
 * Where the WE-ADK API lives.
 *
 * The Spring Boot service (see `backend/`) is a separate deploy target from this
 * Next.js app, so every call goes to an absolute origin rather than a same-origin
 * `/api/...` path. `NEXT_PUBLIC_API_BASE_URL` is inlined at build time; unset, it
 * points at the backend's default dev port.
 */
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '');

/** Absolute URL for an API path — `apiUrl('/api/projects')`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
