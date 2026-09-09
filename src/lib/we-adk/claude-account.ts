'use client';

/**
 * Each user connects their own Claude Code account: the token from
 * `claude setup-token` lives only in this browser's localStorage and is sent
 * as a header with every AI request. The server never persists it.
 */
import { useCallback, useEffect, useState } from 'react';

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

/** Header object to spread into fetch calls against the AI bridge routes. */
export function claudeHeaders(): Record<string, string> {
  const token = getClaudeToken();
  return token ? { [CLAUDE_TOKEN_HEADER]: token } : {};
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
