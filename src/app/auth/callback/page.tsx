'use client';

/**
 * Where the authorization server sends the browser back to.
 *
 * It redeems the code for a token and then leaves, so this screen is only ever seen for
 * the moment that exchange takes — or for as long as it takes to read why it failed.
 *
 * The URL this page is reached at has to match a redirect URI registered on the server
 * (`weadk.oauth2.client.redirect-uris`). A mismatch is the most common reason an OAuth2
 * flow fails, and the server refuses before ever reaching this page, so the error appears
 * there rather than here.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { pendingReturnTo } from '@/lib/api/oauth';

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // An authorization code is single use. React runs effects twice in development, and a
  // second exchange would fail against a code the first one already spent.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // A declined silent renewal is the expected end of a session, not a fault. It goes to
    // the sign-in screen rather than showing the user an error they cannot act on.
    //
    // Carrying the destination across matters: that screen starts a fresh flow and stores
    // its own, so without this the page someone was on is replaced by the default.
    const declined = params.get('error');
    if (declined === 'login_required' || declined === 'interaction_required') {
      const returnTo = pendingReturnTo();
      router.replace(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login');
      return;
    }

    void (async () => {
      try {
        const { completeSignIn } = await import('@/lib/api/oauth');
        const { returnTo } = await completeSignIn(params);
        router.replace(returnTo);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
      }
    })();
  }, [params, router]);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-sm">
          <p className="font-semibold">Sign-in did not complete.</p>
          <p className="text-muted-foreground text-xs">{error}</p>
          <a
            href="/login"
            className="hover:bg-accent inline-block rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Try again
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="text-muted-foreground flex min-h-dvh items-center justify-center gap-3 text-sm">
      <span className="border-muted-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
      Signing you in…
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm">
          Signing you in…
        </main>
      }
    >
      <Callback />
    </Suspense>
  );
}
