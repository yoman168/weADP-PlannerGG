'use client';

import { Bell, Globe, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { cn } from '@/components/ui';
import { useLocale, LOCALE_LABELS, type Locale } from '@/lib/locale';
import { useClaudeAccount } from '@/lib/we-adk/claude-account';
import { ClaudeConnectDialog } from '@/components/we-adk/claude-connect';
import { WorkspaceProvider } from '@/lib/api/workspace-provider';
import { signOut } from '@/lib/api/oauth';
import { useApiSession } from '@/lib/api/session';

/**
 * Chrome for everything above a project: the project list, the cross-project
 * screen shelf and the org-level consoles.
 *
 * When the user is inside a project (`/we-adk/projects/…`), the project
 * layout renders its own top bar, so the global header hides itself.
 */
export function WeAdkShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const insideProject = pathname.startsWith('/we-adk/projects/');
  const { locale, setLocale, t } = useLocale();
  const { connected } = useClaudeAccount();
  const { user } = useApiSession();

  /*
   * Who the header says you are.
   *
   * `open` mode has no session at all, and the workspace is still perfectly usable that
   * way — so the seeded name stands in rather than leaving the control blank and looking
   * broken. Once someone signs in, it is their name.
   */
  const displayName = user?.name ?? user?.email ?? '설욱환';
  const initial = [...displayName][0] ?? 'W';

  return (
    // Nothing below here reads workspace state until it has arrived: every screen
    // treats "nothing stored" as "nothing here yet", so rendering first would show a
    // convincing empty project and the next edit would save that over the real one.
    <WorkspaceProvider>
      {/* Exactly the viewport, not a minimum: with `min-h` a page that asks for a
          full-height frame pushes the document past the screen, and the overflow
          reads as a band of dead background under the app. */}
      <div className="flex h-dvh flex-col overflow-hidden bg-[#f4f5f7] dark:bg-[#0b0e14]">
        {!insideProject && (
          <header className="border-border/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-[#fafafa]/85 px-4 backdrop-blur-md sm:px-6 dark:bg-[#0d1017]/85">
            <Link href="/we-adk" className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-[11px] font-bold text-white shadow-sm">
                W
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-semibold tracking-tight">{t('app.name')}</span>
                <span className="text-muted-foreground text-[10px]">{t('app.subtitle')}</span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="hover:bg-foreground/[0.04] flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors dark:hover:bg-white/5">
                <Globe className="text-muted-foreground size-3.5" />
                <label className="sr-only" htmlFor="locale-select">
                  {LOCALE_LABELS[locale]}
                </label>
                <select
                  id="locale-select"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  className="cursor-pointer bg-transparent text-xs font-medium outline-none"
                >
                  <option value="en">{LOCALE_LABELS.en}</option>
                  <option value="ko">{LOCALE_LABELS.ko}</option>
                </select>
              </div>

              <button
                type="button"
                className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] relative rounded-lg p-1.5 transition-colors dark:hover:bg-white/5"
                aria-label="Notifications (9 or more unread)"
                title="Notifications — not part of this mockup"
              >
                <Bell className="size-4" />
                <span className="bg-destructive absolute top-0 right-0 flex size-4 items-center justify-center rounded-full text-[9px] font-medium text-white">
                  9+
                </span>
              </button>

              {/*
                One control for who you are and whether Claude can run for you.

                The name and initial come from the signed-in account when there is one. They
                used to be hardcoded, which was fine while there was nobody to be — now that
                signing in is real, a header showing someone else's name would be a bug.
              */}
              <ClaudeConnectDialog
                trigger={
                  <button
                    type="button"
                    className="border-border/80 bg-background hover:border-foreground/25 ml-1 flex items-center gap-2 rounded-full border py-1 pr-1 pl-1 transition-colors sm:pr-3"
                    title={connected ? t('shell.claudeManage') : t('shell.claudeConnectHint')}
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-semibold text-white">
                      {initial}
                    </span>
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block text-xs font-medium">{displayName}</span>
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            connected ? 'bg-emerald-500' : 'bg-amber-500',
                          )}
                        />
                        {connected ? t('shell.claudeOn') : t('shell.claudeOff')}
                      </span>
                    </span>
                  </button>
                }
              />

              {/* Only when there is a session to end. In `open` mode there is nothing to
                  sign out of, and a button that does nothing is worse than no button. */}
              {user && (
                <button
                  type="button"
                  onClick={() => signOut()}
                  title={`Sign out ${user.email}`}
                  aria-label={`Sign out ${user.email}`}
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] rounded-lg p-1.5 transition-colors dark:hover:bg-white/5"
                >
                  <LogOut className="size-4" />
                </button>
              )}
            </div>
          </header>
        )}
        {/* Pages that fill the frame clip inside it; taller ones scroll here
          rather than scrolling the window. */}
        <main className="w-full min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
