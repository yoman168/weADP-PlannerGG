'use client';

/**
 * The sign-in screen, which is deliberately no longer a screen.
 *
 * Signing in has exactly one path — the authorization server's own page — so there was
 * nothing to choose here and nothing worth stopping for. Landing on this route starts the
 * flow and shows only that it is under way. The password is still typed on the server's
 * page (`backend/src/main/resources/templates/login.html`) and this application still never
 * handles one: what has gone is the click in front of the redirect, not the redirect.
 *
 * The card comes back for a failure. A sign-in that could not start has to say why and
 * offer another go, and redirecting again on top of an error is how a loop begins.
 */
import { LogIn, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { startSignIn } from '@/lib/api/oauth';
import { getApiToken, getApiUser } from '@/lib/api/session';

/** The backdrop both states share, so the redirect is not a flash of a different page. */
const SURFACE = 'min-h-dvh bg-[#f4f5f7] dark:bg-[#0b0e14]';

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get('error'));
  // The flow navigates away, and React runs effects twice in development. Without this, a
  // second run would overwrite the first one's PKCE verifier mid-redirect.
  const started = useRef(false);

  const returnTo = params.get('returnTo') ?? '/we-adk';

  const start = useCallback(async () => {
    setError(null);
    try {
      await startSignIn({ returnTo });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start sign-in.');
      // Failed before leaving the page, so let the button have another go.
      started.current = false;
    }
  }, [returnTo]);

  useEffect(() => {
    if (started.current) return;

    // An error is the one reason to stay. Starting again on top of a failed sign-in would
    // bounce between here and the server without ever showing what went wrong.
    if (params.get('error')) return;

    // Read the session straight out of storage rather than through `useApiSession`, whose
    // first render reports signed out for everyone — it syncs in an effect of its own, and
    // trusting it here would send an already signed-in user back to the sign-in page.
    if (getApiToken() && getApiUser()) {
      router.replace(returnTo);
      return;
    }

    started.current = true;
    void start();
  }, [params, returnTo, router, start]);

  if (error) {
    return (
      <main className={`${SURFACE} flex items-center justify-center p-6`}>
        <div className="bg-background w-full max-w-sm rounded-xl border p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-emerald-400 to-teal-600 text-[13px] font-bold text-white">
              W
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight">WE-ADK</span>
              <span className="text-muted-foreground block text-[11px]">
                Design, build and deliver
              </span>
            </span>
          </div>

          <h1 className="text-sm font-semibold">Sign-in did not start</h1>
          <p className="bg-destructive/10 text-destructive mt-4 rounded-md px-3 py-2 text-xs">
            {error}
          </p>

          <Button type="button" className="mt-5 w-full" onClick={() => void start()}>
            <LogIn className="size-4" />
            Try again
          </Button>

          <p className="text-muted-foreground mt-4 flex items-start gap-1.5 text-[11px]">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            <span>
              You will be taken to the WE-ADK API to enter your password. It is never typed into
              this page, and this page never sees it.
            </span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`${SURFACE} text-muted-foreground flex items-center justify-center gap-3 text-sm`}
    >
      <span className="border-muted-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
      Taking you to sign in…
    </main>
  );
}

export default function LoginPage() {
  return (
    // `useSearchParams` suspends, and this page is the one that has to render when nothing
    // else can — so it carries its own boundary rather than relying on a layout.
    <Suspense fallback={<main className={SURFACE} />}>
      <SignIn />
    </Suspense>
  );
}
