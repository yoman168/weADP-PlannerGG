'use client';

/**
 * The browser's half of the OAuth2 flow.
 *
 * Authorization code with PKCE, against the authorization server in `backend/`. The
 * password is never typed here: this module sends the browser to the server's own sign-in
 * page and takes delivery of a code afterwards, which is the property the redirect buys.
 *
 * There is no refresh token, deliberately. Spring will not issue one to a public client on
 * this grant, and it is right not to — a refresh token is a long-lived credential and
 * browser storage is readable by any injected script. Renewal goes back through
 * `/oauth2/authorize` instead, where the long-lived credential is an http-only session
 * cookie that no script can read. An expired access token therefore costs a redirect the
 * user does not see rather than a password prompt.
 */
import { API_BASE_URL, apiUrl } from './base';
import { clearApiSession, setApiSession, type ApiUser } from './session';

/** Where the browser comes back to. Must match a redirect URI the server has registered. */
export const CALLBACK_PATH = '/auth/callback';

const SCOPES = 'openid profile weadk.api';

/*
 * The verifier and the page to return to, kept in `sessionStorage` for the length of the
 * redirect. sessionStorage rather than localStorage on purpose: this is per-tab, in-flight
 * state, and two tabs starting a sign-in at once must not overwrite each other's verifier.
 */
const VERIFIER_KEY = 'we-adk:oauth-verifier';
const RETURN_KEY = 'we-adk:oauth-return-to';
const STATE_KEY = 'we-adk:oauth-state';

function clientId(): string {
  return process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID ?? 'we-adk-workspace';
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/* ------------------------------------------------------------------ */
/* Starting                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sends the browser to the server's sign-in page.
 *
 * `prompt: 'none'` is the silent case: it asks the server to answer from the existing
 * session or fail, rather than showing a page. That is what a renewal after an expired
 * access token uses, so the user never sees it when their session is still good.
 */
export async function startSignIn(options?: {
  returnTo?: string;
  silent?: boolean;
}): Promise<void> {
  const verifier = randomString();
  const state = randomString();
  const returnTo = options?.returnTo ?? `${window.location.pathname}${window.location.search}`;

  try {
    window.sessionStorage.setItem(VERIFIER_KEY, verifier);
    window.sessionStorage.setItem(STATE_KEY, state);
    window.sessionStorage.setItem(RETURN_KEY, returnTo);
  } catch {
    // Private mode with storage blocked. The flow cannot complete without the verifier,
    // so say so rather than bouncing the user through a redirect that must fail.
    throw new Error('This browser is blocking storage, so signing in cannot complete.');
  }

  const authorize = new URL(`${API_BASE_URL}/oauth2/authorize`);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
    scope: SCOPES,
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    ...(options?.silent ? { prompt: 'none' } : {}),
  }).toString();

  window.location.assign(authorize.toString());
}

/* ------------------------------------------------------------------ */
/* Finishing                                                           */
/* ------------------------------------------------------------------ */

export interface Completed {
  user: ApiUser;
  returnTo: string;
}

/**
 * Where a sign-in already under way was headed.
 *
 * A silent renewal that the server declines comes back to the callback, which has to hand
 * the browser on to the visible sign-in screen — and that screen starts a fresh flow, which
 * overwrites the stored destination with its own. So the callback reads the original out
 * first and passes it along, or someone whose session expired three levels into a project
 * gets returned to the project list.
 */
export function pendingReturnTo(): string | null {
  return read(RETURN_KEY);
}

/**
 * Redeems the code for a token, and reads who it belongs to.
 *
 * The verifier proves this is the same browser that started the flow; without it, an
 * intercepted code is useless, which is the whole reason PKCE exists for a client that
 * cannot hold a secret.
 */
export async function completeSignIn(params: URLSearchParams): Promise<Completed> {
  const error = params.get('error');
  if (error) {
    throw new Error(describeError(error, params.get('error_description')));
  }
  const code = params.get('code');
  if (!code) {
    throw new Error('The sign-in came back without an authorization code.');
  }

  const verifier = read(VERIFIER_KEY);
  const expectedState = read(STATE_KEY);
  if (!verifier) {
    throw new Error('This sign-in was started in another tab or has already been used.');
  }
  // A state that does not match means the response is not the one this tab asked for.
  if (expectedState && params.get('state') !== expectedState) {
    throw new Error('The sign-in response did not match the request. Please try again.');
  }

  const response = await fetch(apiUrl('/oauth2/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
      client_id: clientId(),
      code_verifier: verifier,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  } | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ?? describeError(payload?.error ?? 'invalid_grant', null),
    );
  }

  // Single use. Leaving it behind would let a replayed callback URL start a second exchange.
  forget();

  const user = await fetchAccount(payload.access_token);
  setApiSession(payload.access_token, user);
  return { user, returnTo: read(RETURN_KEY) ?? '/we-adk' };
}

async function fetchAccount(token: string): Promise<ApiUser> {
  const response = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Signed in, but the API would not say who you are.');
  }
  const account = (await response.json()) as {
    id?: string;
    email?: string;
    name?: string;
    roles?: string[];
  };
  return {
    id: account.id ?? '',
    email: account.email ?? '',
    name: account.name ?? account.email ?? '',
    roles: account.roles ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Signing out                                                         */
/* ------------------------------------------------------------------ */

/**
 * Drops the token here, then ends the session on the server.
 *
 * Both halves are needed. Clearing only the token would leave the server's session alive,
 * so the next sign-in would complete silently and look like it had never happened.
 */
export function signOut(): void {
  clearApiSession();
  forget();
  const logout = new URL(`${API_BASE_URL}/logout`);
  window.location.assign(logout.toString());
}

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function forget(): void {
  for (const key of [VERIFIER_KEY, STATE_KEY]) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* nothing to clean up */
    }
  }
}

/** The server's error codes, as sentences. */
function describeError(code: string, description: string | null): string {
  if (code === 'login_required' || code === 'interaction_required') {
    return 'Your session has expired. Please sign in again.';
  }
  if (code === 'access_denied') {
    return 'Sign-in was cancelled.';
  }
  if (code === 'invalid_grant') {
    return 'That sign-in could not be completed. Please try again.';
  }
  return description ?? `Sign-in failed (${code}).`;
}
