/**
 * Signing in.
 *
 * The token and the account it belongs to are kept by `./session`, in this browser only.
 * Nothing here writes a cookie: the API is a stateless resource server on a different
 * origin, so a bearer token is what it reads and a cookie would not reach it.
 */
import { api, unwrap, type Schema } from './client';
import { setApiSession, type ApiUser } from './session';

export type LoginResponse = Schema<'LoginResponse'>;
export type UserView = Schema<'UserView'>;

function toUser(view: UserView): ApiUser {
  return {
    id: view.id ?? '',
    email: view.email ?? '',
    name: view.name ?? view.email ?? '',
    roles: view.roles ?? [],
  };
}

/** Exchanges an email and password for a token, and stores the session. */
export async function signIn(email: string, password: string): Promise<ApiUser> {
  const session = await unwrap(api.POST('/api/auth/login', { body: { email, password } }));
  if (!session.token || !session.user) {
    throw new Error('The API answered a sign-in without a token.');
  }
  const user = toUser(session.user);
  setApiSession(session.token, user);
  return user;
}

/** The account behind the stored token. Throws when the token is missing or expired. */
export async function fetchMe(): Promise<ApiUser> {
  return toUser(await unwrap(api.GET('/api/auth/me')));
}
