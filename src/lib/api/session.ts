'use client';

/**
 * The signed-in API session: a JWT from `POST /api/auth/login`, kept in this
 * browser only and sent as a bearer token with every request.
 *
 * One module owns the storage key so the typed client, the plain `fetch`
 * callers, and the sign-in dialog all agree on where the token is.
 */
import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'we-adk:api-token';
const USER_KEY = 'we-adk:api-user';
const CHANGE_EVENT = 'we-adk:api-session-changed';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export function getApiToken(): string | null {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY)?.trim();
    return token ? token : null;
  } catch {
    return null;
  }
}

export function getApiUser(): ApiUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const user = parsed as Partial<ApiUser>;
    if (typeof user.id !== 'string' || typeof user.email !== 'string') return null;
    return {
      id: user.id,
      email: user.email,
      name: typeof user.name === 'string' ? user.name : user.email,
      roles: Array.isArray(user.roles)
        ? user.roles.filter((r): r is string => typeof r === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export function setApiSession(token: string, user: ApiUser): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token.trim());
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable (private mode) — the session lasts until reload.
  }
}

export function clearApiSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Ignore.
  }
}

/** Headers to spread into a `fetch` against the API. Empty when signed out. */
export function authHeaders(): Record<string, string> {
  const token = getApiToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useApiSession(): {
  token: string | null;
  user: ApiUser | null;
  signedIn: boolean;
  signOut: () => void;
} {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    const sync = () => {
      setToken(getApiToken());
      setUser(getApiUser());
    };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const signOut = useCallback(() => clearApiSession(), []);
  return { token, user, signedIn: token !== null, signOut };
}
