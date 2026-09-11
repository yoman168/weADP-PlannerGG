/**
 * The WE-ADK API client.
 *
 * Types come from `schema.d.ts`, generated from `openapi/openapi.json`, exported from the
 * Java controllers in `backend/`. Regenerate with `pnpm api:export && pnpm api:types`;
 * `pnpm api:check` is what CI runs to fail a build where either file has fallen behind.
 */
export { API_BASE_URL, apiUrl } from './base';
export { api, unwrap, ApiError, type Schema } from './client';
export { readApiError, readJson } from './errors';
export {
  authHeaders,
  clearApiSession,
  getApiToken,
  getApiUser,
  setApiSession,
  useApiSession,
  type ApiUser,
} from './session';
export { signIn, fetchMe, type LoginResponse, type UserView } from './auth';
export * as projects from './projects';
export * as meetings from './meetings';
export * as requests from './requests';
export * as ai from './ai';
