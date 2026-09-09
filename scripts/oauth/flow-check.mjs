#!/usr/bin/env node
/**
 * Walks the whole OAuth2 flow against a running server, the way the browser does.
 *
 * This exists because the interesting parts of an OAuth2 flow are the parts a unit test
 * cannot reach: a real cookie jar, a real redirect, a query string that actually exists.
 * MockMvc builds requests with no query string, and the authorization endpoint requires its
 * parameters to have arrived in one — so the redirect to sign in can only be proven here.
 *
 *   SECURITY_MODE=oauth2 ... ./mvnw spring-boot:run     # in backend/
 *   node scripts/oauth/flow-check.mjs                   # then this
 *
 * Override the target with AS_URL, the account with AS_EMAIL and AS_PASSWORD.
 */
import crypto from 'node:crypto';

const AS = process.env.AS_URL ?? 'http://localhost:8080';
const EMAIL = process.env.AS_EMAIL ?? 'you@example.com';
const PASSWORD = process.env.AS_PASSWORD ?? 'workspace-pass-1';
const CLIENT = process.env.AS_CLIENT ?? 'we-adk-workspace';
const REDIRECT = process.env.AS_REDIRECT ?? 'http://localhost:3000/auth/callback';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};
const b64url = (b) => b.toString('base64url');
const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
let cookie = '';

const keepCookie = (res) => {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const pair = c.split(';')[0];
    if (pair.startsWith('JSESSIONID')) cookie = pair;
  }
};

// 0. an authorization request with no session is sent to sign in, not refused
const authorizeUrl = (extra = {}) => {
  const url = new URL(`${AS}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    scope: 'openid profile weadk.api',
    state: 'xyz',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...extra,
  }).toString();
  return url;
};
let res = await fetch(authorizeUrl(), { redirect: 'manual', headers: { Accept: 'text/html' } });
check(
  'no session      → redirected to sign in',
  res.status === 302 && (res.headers.get('location') ?? '').endsWith('/login'),
  `${res.status} ${res.headers.get('location') ?? ''}`,
);

// 0b. and a silent renewal with no session is declined rather than shown a page
res = await fetch(authorizeUrl({ prompt: 'none' }), { redirect: 'manual' });
const declined = new URL(res.headers.get('location') ?? 'http://x/', REDIRECT).searchParams.get(
  'error',
);
check(
  'prompt=none     → login_required',
  declined === 'login_required',
  declined ?? `${res.status}`,
);

// 1. the sign-in page, for its CSRF token and session
res = await fetch(`${AS}/login`);
keepCookie(res);
const html = await res.text();
const csrf =
  /name="_csrf"[^>]*value="([^"]+)"/.exec(html)?.[1] ??
  /value="([^"]+)"[^>]*name="_csrf"/.exec(html)?.[1];
check('sign-in page    → renders with a CSRF field', res.status === 200 && Boolean(csrf));

// 2. sign in
res = await fetch(`${AS}/login`, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
  body: new URLSearchParams({ username: EMAIL, password: PASSWORD, _csrf: csrf }),
});
keepCookie(res);
check(
  'sign in         → accepted',
  res.status === 302 && !(res.headers.get('location') ?? '').includes('error'),
  res.headers.get('location') ?? '',
);

// 3. ask for a code
res = await fetch(authorizeUrl(), { redirect: 'manual', headers: { Cookie: cookie } });
const location = res.headers.get('location') ?? '';
const code = new URL(location, REDIRECT).searchParams.get('code');
check('authorize       → code issued', Boolean(code), code ? '' : location);

// 4. redeem it, proving possession of the verifier
res = await fetch(`${AS}/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    client_id: CLIENT,
    code_verifier: verifier,
  }),
});
const tokens = await res.json();
check(
  'token exchange  → access token',
  Boolean(tokens.access_token),
  Object.keys(tokens).join(', '),
);
if (tokens.access_token) {
  const [head, body] = tokens.access_token.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url'));
  const alg = JSON.parse(Buffer.from(head, 'base64url')).alg;
  check('token           → RS256, signed by the server', alg === 'RS256', alg);
  check(
    'token           → carries sub, email and roles',
    Boolean(claims.sub && claims.email && Array.isArray(claims.roles)),
    `sub=${claims.sub} email=${claims.email} roles=${JSON.stringify(claims.roles)}`,
  );
  // No refresh token, and that is deliberate: Spring withholds one from a public client,
  // so renewal goes back through /oauth2/authorize against the session cookie instead.
  check('token           → no refresh token, by design', tokens.refresh_token === undefined);
}

// 5. use it
const bearer = { Authorization: `Bearer ${tokens.access_token}` };
res = await fetch(`${AS}/api/state`, { headers: bearer });
check('GET /api/state  → authorised', res.ok, String(res.status));
res = await fetch(`${AS}/api/auth/me`, { headers: bearer });
const me = res.ok ? await res.json() : null;
check(
  'GET /api/auth/me→ names the account',
  me?.email === EMAIL,
  me ? JSON.stringify(me.email) : String(res.status),
);
res = await fetch(`${AS}/api/state`);
check('no token        → refused', res.status === 401, String(res.status));

// 6. the code is single use, and the verifier is what proves possession
res = await fetch(`${AS}/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code ?? 'x',
    redirect_uri: REDIRECT,
    client_id: CLIENT,
    code_verifier: b64url(crypto.randomBytes(32)),
  }),
});
check('wrong verifier  → refused (PKCE)', !res.ok, String(res.status));

// 7. the endpoint that is no longer the way in says so, rather than 401
res = await fetch(`${AS}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
check('password login  → 501, not 401', res.status === 501, String(res.status));

// 8. signing out ends the session, so the next silent renewal is declined
res = await fetch(`${AS}/logout`, { redirect: 'manual', headers: { Cookie: cookie } });
check('sign out        → session ended', res.status === 302, String(res.status));
res = await fetch(authorizeUrl({ prompt: 'none' }), {
  redirect: 'manual',
  headers: { Cookie: cookie },
});
const afterLogout = new URL(res.headers.get('location') ?? 'http://x/', REDIRECT).searchParams.get(
  'error',
);
check(
  'after sign out  → renewal declined',
  afterLogout === 'login_required',
  afterLogout ?? String(res.status),
);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
