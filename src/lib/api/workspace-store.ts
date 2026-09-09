'use client';

/**
 * Where the workspace's state lives now.
 *
 * It used to be `localStorage`: around eighty keys across fifteen areas — rounds, tasks,
 * canvases, generated screens, IA rows, QA runs, whiteboards — read and written by about
 * sixty-eight modules. It is now a table in Postgres, reached through `/api/state`.
 *
 * The interface is deliberately `localStorage`'s, and synchronous, because that is what
 * made the change possible at all. Those eighty keys are consulted from inside render
 * paths, `useMemo` bodies and derivation helpers that cannot await anything; turning every
 * one of them into a promise would have meant rewriting most of the workspace. So instead:
 *
 *   hydrate once  →  answer from memory  →  flush changes in the background
 *
 * `WorkspaceProvider` does the hydrating and holds the first render until it is done, so a
 * synchronous read is never answering from an empty store.
 *
 * Two things stay in the browser on purpose. A Claude credential and this session's own
 * token belong to the browser that obtained them, and neither is ever sent — see
 * `./session` and `@/lib/we-adk/claude-account`. The API rejects them too, and so does the
 * database.
 */
import { apiUrl } from './base';
import { authHeaders, clearApiSession, getApiToken } from './session';

/** Keys that must never leave the browser, whatever asks for them. */
const NEVER_SYNCED = new Set(['we-adk:claude-token', 'we-adk:api-token', 'we-adk:api-user']);

/** How long to gather writes before sending them. */
const FLUSH_DELAY_MS = 400;

/**
 * The last snapshot, kept across full page loads so a navigation can be a 304.
 *
 * `sessionStorage` rather than memory, because a full page load is exactly the case this is
 * for: the module reloads and its in-memory map is gone, but the API's answer has usually
 * not changed. Per tab rather than shared, because two tabs signed in as different people
 * must not read each other's workspace.
 *
 * A cache miss is only ever a slower load, never a wrong one — the ETag is checked by the
 * server, so a stale copy cannot be served as current.
 */
const CACHE_VERSION_KEY = 'we-adk:state-version';
const CACHE_BODY_KEY = 'we-adk:state-cache';

function readCachedSnapshot(): { version: string; entries: Record<string, string> } | null {
  try {
    const version = window.sessionStorage.getItem(CACHE_VERSION_KEY);
    const body = window.sessionStorage.getItem(CACHE_BODY_KEY);
    if (!version || !body) return null;
    return { version, entries: JSON.parse(body) as Record<string, string> };
  } catch {
    return null;
  }
}

function writeCachedSnapshot(version: string | null, entries: Record<string, string>): void {
  if (!version) return;
  try {
    window.sessionStorage.setItem(CACHE_VERSION_KEY, version);
    window.sessionStorage.setItem(CACHE_BODY_KEY, JSON.stringify(entries));
  } catch {
    // Over quota. The next load simply fetches in full, which is the old behaviour.
  }
}

function forgetCachedSnapshot(): void {
  try {
    window.sessionStorage.removeItem(CACHE_VERSION_KEY);
    window.sessionStorage.removeItem(CACHE_BODY_KEY);
  } catch {
    /* nothing to clean up */
  }
}

/** Thrown when the API does not know who is asking; the caller signs in rather than retrying. */
class Unauthenticated extends Error {}

/**
 * Drops a session the API has just refused.
 *
 * This one line is what stopped an infinite redirect. A token has a thirty-minute life and
 * expires while it is still sitting in storage looking perfectly good, and nothing here used
 * to clear it — so the sign-in screen, which quite reasonably treats a stored token as being
 * signed in, sent the browser straight back to a page that immediately got another 401. The
 * two bounced off each other forever, and the API only ever saw the failing read.
 *
 * The typed client in `./client` has always done this in its middleware. The store predates
 * that and uses plain `fetch`, so it needed its own.
 */
function rejectSession(): void {
  if (typeof window !== 'undefined' && getApiToken()) {
    clearApiSession();
  }
  // Whoever signs in next must not inherit this cache.
  forgetCachedSnapshot();
}

/** Fired after a hydrate or a change from another tab, so views re-read. */
export const STORE_CHANGED_EVENT = 'we-adk:store-changed';

type Status = 'idle' | 'hydrating' | 'ready' | 'offline' | 'unauthenticated';

const entries = new Map<string, string>();
/** Keys changed since the last flush. A key mapped to null is a deletion. */
const pending = new Map<string, string | null>();

let status: Status = 'idle';
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let lastError: string | null = null;

function announce(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
  }
}

/* ------------------------------------------------------------------ */
/* Reading and writing — the localStorage shape                        */
/* ------------------------------------------------------------------ */

/**
 * The store, with `localStorage`'s methods.
 *
 * Reads before hydration answer null, which is exactly what `localStorage` did during a
 * server render — so the callers' existing "nothing stored yet" branches stay correct.
 */
export const workspaceStore = {
  getItem(key: string): string | null {
    return entries.has(key) ? (entries.get(key) as string) : null;
  },

  setItem(key: string, value: string): void {
    if (entries.get(key) === value) return;
    entries.set(key, value);
    if (!NEVER_SYNCED.has(key)) {
      pending.set(key, value);
      scheduleFlush();
    }
  },

  removeItem(key: string): void {
    if (!entries.has(key)) return;
    entries.delete(key);
    if (!NEVER_SYNCED.has(key)) {
      pending.set(key, null);
      scheduleFlush();
    }
  },

  /**
   * Every key held, for the one caller that scans them.
   *
   * `localStorage` exposed this as `length` and `key(i)`; a list is the same thing without
   * the index arithmetic. `renameProjectScreenIds` in `we-adk-mock/ia.ts` is the caller.
   */
  keys(): string[] {
    return [...entries.keys()];
  },
};

/* ------------------------------------------------------------------ */
/* Hydration                                                           */
/* ------------------------------------------------------------------ */

interface Snapshot {
  entries?: Record<string, string>;
  personalKeys?: string[];
}

/**
 * Loads the store from the API, handing over anything this browser still holds.
 *
 * The handover matters once. Before this change every browser was the database, so the
 * first load after it has to move that state up rather than appear to have lost it. The
 * import fills gaps and never overwrites, so two people upgrading on the same day do not
 * flatten each other, and the local copy is left alone afterwards — if this goes wrong,
 * the old data is still sitting there.
 */
export async function hydrateWorkspaceStore(): Promise<Status> {
  if (status === 'ready') return status;
  status = 'hydrating';
  try {
    await handOverLocalState();

    const cached = readCachedSnapshot();
    const response = await fetch(apiUrl('/api/state'), {
      headers: {
        Accept: 'application/json',
        ...authHeaders(),
        // The whole point of the ETag. On an unchanged workspace this turns 1.8 MB into a
        // 304 with no body, and the copy below is what fills the store instead.
        ...(cached ? { 'If-None-Match': cached.version } : {}),
      },
      cache: 'no-store',
    });

    if (response.status === 304 && cached) {
      entries.clear();
      for (const [key, value] of Object.entries(cached.entries)) {
        entries.set(key, value);
      }
      carryOverBrowserOnlyKeys();
      status = 'ready';
      lastError = null;
      announce();
      return status;
    }
    // Told apart from a failure on purpose. "I do not know who you are" is answered by
    // signing in; "I cannot reach the API" is answered by starting it. Reporting the first
    // as the second sends someone to check a service that is running perfectly well.
    if (response.status === 401 || response.status === 403) {
      rejectSession();
      status = 'unauthenticated';
      lastError = null;
      announce();
      return status;
    }
    if (!response.ok) {
      throw new Error(`The API answered ${response.status}.`);
    }
    const snapshot = (await response.json()) as Snapshot;
    entries.clear();
    for (const [key, value] of Object.entries(snapshot.entries ?? {})) {
      entries.set(key, value);
    }
    writeCachedSnapshot(response.headers.get('ETag'), snapshot.entries ?? {});
    carryOverBrowserOnlyKeys();
    status = 'ready';
    lastError = null;
  } catch (error) {
    if (error instanceof Unauthenticated) {
      status = 'unauthenticated';
      lastError = null;
    } else {
      // Answering from an empty store would look to every screen like a workspace with
      // nothing in it, and the first write would then persist that emptiness. Refusing to
      // come up is the safer failure, and `WorkspaceProvider` says so on screen.
      status = 'offline';
      lastError = error instanceof Error ? error.message : 'Could not reach the WE-ADK API.';
    }
  }
  announce();
  return status;
}

/** Reads the credentials that stay local into the in-memory map, unsynced. */
function carryOverBrowserOnlyKeys(): void {
  for (const key of NEVER_SYNCED) {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) entries.set(key, value);
    } catch {
      // Storage unavailable; the session is simply not connected.
    }
  }
}

/** The one-time upload of whatever this browser was still holding. */
async function handOverLocalState(): Promise<void> {
  let local: { key: string; value: string }[];
  try {
    local = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith('we-adk:') || NEVER_SYNCED.has(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) local.push({ key, value });
    }
  } catch {
    return;
  }
  if (local.length === 0) return;

  // In batches, because a workspace that has been used for a while holds screens of html.
  for (let start = 0; start < local.length; start += 200) {
    const batch = local.slice(start, start + 200);
    const response = await fetch(apiUrl('/api/state/import'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ entries: batch }),
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      // Not signed in yet. The handover is retried after signing in, so this is not a
      // failure — and it must not be reported as one, or the local copy would look lost.
      rejectSession();
      throw new Unauthenticated();
    }
    if (!response.ok) {
      throw new Error(`Handing this browser's saved work to the API failed (${response.status}).`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Flushing                                                            */
/* ------------------------------------------------------------------ */

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWorkspaceStore();
  }, FLUSH_DELAY_MS);
}

/**
 * Sends the pending changes.
 *
 * One request at a time: two overlapping batches could land out of order and leave the
 * older value stored. Anything that arrives while a request is in flight waits for the
 * next one, which is what the recursive call at the end is for.
 *
 * A failed batch goes back into `pending` rather than being dropped — unless the same key
 * has been written again since, in which case the newer value is the one to keep.
 */
export async function flushWorkspaceStore(): Promise<void> {
  if (inFlight) return inFlight;
  if (pending.size === 0) return;

  const batch = [...pending.entries()].map(([key, value]) => ({ key, value }));
  pending.clear();

  inFlight = (async () => {
    try {
      const response = await fetch(apiUrl('/api/state'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ entries: batch }),
        cache: 'no-store',
      });
      if (response.status === 401 || response.status === 403) {
        // The session went while the page was open. Hold the changes and let the provider
        // deal with signing in; they are flushed once there is a token again.
        for (const { key, value } of batch) {
          if (!pending.has(key)) pending.set(key, value);
        }
        rejectSession();
        status = 'unauthenticated';
        announce();
        return;
      }
      if (!response.ok) throw new Error(`The API answered ${response.status}.`);
      // What was just written is not in the cached snapshot, and its version now belongs to
      // an older state. Dropping it costs one full load; keeping it would show stale data.
      forgetCachedSnapshot();
      lastError = null;
    } catch (error) {
      for (const { key, value } of batch) {
        if (!pending.has(key)) pending.set(key, value);
      }
      lastError = error instanceof Error ? error.message : 'Could not save to the WE-ADK API.';
      announce();
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;
  if (pending.size > 0) scheduleFlush();
}

/* ------------------------------------------------------------------ */
/* Status, for the provider and the shell                              */
/* ------------------------------------------------------------------ */

export function workspaceStoreStatus(): { status: Status; error: string | null; unsaved: number } {
  return { status, error: lastError, unsaved: pending.size };
}

/** Test seam: drops everything held, without touching the API. */
export function resetWorkspaceStore(): void {
  entries.clear();
  pending.clear();
  status = 'idle';
  lastError = null;
}
