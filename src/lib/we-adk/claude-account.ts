'use client';

/**
 * A per-browser Anthropic credential, overriding the API's own for this user.
 *
 * Stays in `localStorage` deliberately — it is one of the three keys that never leave the
 * browser, alongside the session token. The API rejects it if sent, and a check constraint
 * on `workspace_state` rejects it again.
 */
import { useCallback, useEffect, useState } from 'react';
import { authHeaders } from '@/lib/api/session';

const TOKEN_STORAGE_KEY = 'we-adk:claude-token';
export const CLAUDE_TOKEN_HEADER = 'x-claude-token';

export function getClaudeToken(): string | null {
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim();
    return token ? token : null;
  } catch {
    return null;
  }
}

export function setClaudeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    window.dispatchEvent(new Event('we-adk:claude-token-changed'));
  } catch {
    // Storage unavailable (private mode) — the session just stays disconnected.
  }
}

export function clearClaudeToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event('we-adk:claude-token-changed'));
  } catch {
    // Ignore.
  }
}

/**
 * Headers to spread into fetch calls against the AI bridge routes.
 *
 * Two credentials, doing different jobs, which is why they travel together. The bearer
 * token says who is asking and is what the API checks before doing anything at all; the
 * Claude token is optional and says whose Claude quota to spend. The bridge is the one
 * place both are needed, so this is the one place that assembles them — every call site
 * spreads this object, and adding the two headers by hand at each one would be a chance
 * to miss one.
 *
 * The invariant, deliberately stated as something you can check rather than a count that
 * goes stale as call sites are added: no `fetch` to `/api/sketcher/*` or
 * `/api/claude-auth/*` should have a `headers` object without either this function or
 * {@link CLAUDE_TOKEN_HEADER} in it. Two calls in `sketcher-editor.tsx` sent neither for
 * a while, which billed that canvas's AI to the deployment's key instead of the user's
 * and 401'd once tokens were required — a count in this comment did not catch it.
 */
export function claudeHeaders(): Record<string, string> {
  const token = getClaudeToken();
  return {
    ...authHeaders(),
    ...(token ? { [CLAUDE_TOKEN_HEADER]: token } : {}),
  };
}

export function useClaudeAccount(): {
  token: string | null;
  connected: boolean;
  save: (token: string) => void;
  disconnect: () => void;
} {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setToken(getClaudeToken());
    sync();
    // Same-tab updates (custom event) and other-tab updates (storage event).
    window.addEventListener('we-adk:claude-token-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('we-adk:claude-token-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const save = useCallback((value: string) => setClaudeToken(value), []);
  const disconnect = useCallback(() => clearClaudeToken(), []);

  return { token, connected: token !== null, save, disconnect };
}
