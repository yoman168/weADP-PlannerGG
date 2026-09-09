'use client';

/**
 * Loads the workspace state before anything reads it.
 *
 * The store it fills answers synchronously, which is what let sixty-eight modules keep
 * their existing shape when their state moved out of the browser and into the API. The
 * price is this component: a synchronous read is only correct once the data is there, so
 * the first render waits.
 *
 * Waiting rather than rendering an empty workspace is the important part. Every screen
 * treats "no stored value" as "nothing here yet" — that is what an empty project looks
 * like — so rendering before hydration would show a plausible, wrong, empty workspace, and
 * the first edit would then save that emptiness over the real thing.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { startSignIn } from './oauth';
import { clearApiSession } from './session';
import {
  STORE_CHANGED_EVENT,
  hydrateWorkspaceStore,
  flushWorkspaceStore,
  workspaceStoreStatus,
} from './workspace-store';

/**
 * Marks that a silent renewal has already been tried on this page load.
 *
 * Without it, a renewal that keeps failing is an infinite redirect: the API says 401, the
 * page asks the server to renew without a prompt, the server says no, and round it goes.
 * One attempt, then the visible sign-in screen.
 */
const SILENT_TRIED_KEY = 'we-adk:oauth-silent-tried';

/**
 * How many times this tab has been sent away to sign in.
 *
 * A circuit breaker, added after a real loop: an expired token that nothing cleared, and a
 * sign-in screen that reasonably treats a stored token as being signed in, bounced the
 * browser between the two forever. That particular cause is fixed — the store now drops a
 * session the API refuses — but the shape of the bug is worth making impossible rather than
 * merely absent, because every version of it looks identical from the outside: a spinner,
 * and a page that keeps reloading.
 *
 * Past the limit this stops redirecting and says so, which is a worse experience than
 * signing in and a far better one than a loop nobody can read.
 */
const REDIRECT_COUNT_KEY = 'we-adk:oauth-redirects';
const MAX_REDIRECTS = 3;

function readCount(key: string): number {
  try {
    return Number(window.sessionStorage.getItem(key) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function bumpRedirects(): number {
  const next = readCount(REDIRECT_COUNT_KEY) + 1;
  try {
    window.sessionStorage.setItem(REDIRECT_COUNT_KEY, String(next));
  } catch {
    /* storage blocked; the count cannot be kept, so the limit cannot bite either */
  }
  return next;
}

/** Called once the workspace is up, so a later expiry gets a fresh allowance. */
function clearRedirectGuards(): void {
  try {
    window.sessionStorage.removeItem(REDIRECT_COUNT_KEY);
    window.sessionStorage.removeItem(SILENT_TRIED_KEY);
  } catch {
    /* nothing to clean up */
  }
}

function silentRenewalAlreadyTried(): boolean {
  try {
    return window.sessionStorage.getItem(SILENT_TRIED_KEY) === '1';
  } catch {
    return true;
  }
}

function markSilentRenewalTried(): void {
  try {
    window.sessionStorage.setItem(SILENT_TRIED_KEY, '1');
  } catch {
    /* storage blocked; the visible screen is the fallback anyway */
  }
}

type Phase = 'loading' | 'ready' | 'offline' | 'signing-in' | 'stuck';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void hydrateWorkspaceStore().then(async (status) => {
      if (cancelled) return;

      if (status === 'unauthenticated') {
        // Stop before going round again. Reaching the limit means signing in is not
        // resolving the 401, and continuing would only hide that behind a spinner.
        if (bumpRedirects() > MAX_REDIRECTS) {
          setPhase('stuck');
          return;
        }

        /*
         * Try to renew without bothering the user first.
         *
         * There is no refresh token by design, so renewal is a round trip to
         * `/oauth2/authorize` with `prompt=none`. While the session on the server is still
         * alive that succeeds without a page, and an expired access token costs a redirect
         * nobody sees. Once it is gone, or if it has already been tried, the sign-in screen
         * is the honest answer.
         */
        setPhase('signing-in');
        if (!silentRenewalAlreadyTried()) {
          markSilentRenewalTried();
          try {
            await startSignIn({ silent: true });
            return;
          } catch {
            // Storage blocked, so the flow cannot complete. Fall through to the screen.
          }
        }
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      // Up and running, so the next expiry starts from a clean allowance.
      if (status === 'ready') clearRedirectGuards();
      setPhase(status === 'ready' ? 'ready' : 'offline');
      setError(workspaceStoreStatus().error);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // A failed save is reported by the store rather than thrown at whichever component
  // happened to trigger it, so the banner below is where it surfaces.
  useEffect(() => {
    const sync = () => setError(workspaceStoreStatus().error);
    window.addEventListener(STORE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(STORE_CHANGED_EVENT, sync);
  }, []);

  // Changes are batched, so a close or a reload can land between a keystroke and its save.
  useEffect(() => {
    const flush = () => void flushWorkspaceStore();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  if (phase === 'loading' || phase === 'signing-in') {
    return (
      <div className="text-muted-foreground flex h-dvh items-center justify-center gap-3 text-sm">
        <span className="border-muted-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
        {phase === 'signing-in' ? 'Signing you in…' : 'Loading your workspace…'}
      </div>
    );
  }

  if (phase === 'stuck') {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-sm">
          <p className="font-semibold">Signing in is not getting you through.</p>
          <p className="text-muted-foreground">
            You have been sent to sign in {MAX_REDIRECTS} times and the API is still refusing the
            token, so this stops here rather than sending you round again.
          </p>
          <p className="text-muted-foreground text-xs">
            Most likely the API and this page disagree about who the authorization server is. Check
            that its issuer matches the URL your browser uses, and that the workspace was built
            against that same URL.
          </p>
          <button
            type="button"
            onClick={() => {
              clearRedirectGuards();
              clearApiSession();
              window.location.assign('/login');
            }}
            className="hover:bg-accent rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Start again
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'offline') {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-sm">
          <p className="font-semibold">The workspace could not reach the API.</p>
          <p className="text-muted-foreground">
            Your projects, rounds and designs are stored there now, so there is nothing to show
            until it answers. Nothing has been lost.
          </p>
          {error && <p className="text-destructive font-mono text-xs">{error}</p>}
          <p className="text-muted-foreground text-xs">
            Start it with <code className="bg-muted rounded px-1 py-0.5">docker compose up -d</code>
            , then try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase('loading');
              setAttempt((count) => count + 1);
            }}
            className="hover:bg-accent rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {error && <SaveFailedBanner message={error} />}
    </>
  );
}

/**
 * Shown while a save is failing.
 *
 * Not a toast: a toast disappears, and an edit that is not reaching the database is a thing
 * the user needs to keep knowing about. The store holds the change and keeps retrying, so
 * this goes away on its own once one succeeds.
 */
function SaveFailedBanner({ message }: { message: string }) {
  return (
    <div className="bg-destructive fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-3 py-2 text-xs text-white shadow-lg">
      Changes are not reaching the API — retrying. {message}
    </div>
  );
}
