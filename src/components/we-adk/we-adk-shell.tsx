'use client';

import { Bell, Globe } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { useLocale, LOCALE_LABELS, type Locale } from '@/lib/locale';

/**
 * Chrome for everything above a project: the project list, the cross-project
 * screen shelf and the org-level consoles. Tools (Sketcher, Builder,
 * Developer) belong to a project, so they are not in this bar — the project
 * shell carries them.
 *
 * When the user is inside a project (`/we-adk/projects/…`), the project
 * layout renders its own top bar, so the global header hides itself.
 */
export function WeAdkShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const insideProject = pathname.startsWith('/we-adk/projects/');
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f5f7] dark:bg-[#0b0e14]">
      {!insideProject && (
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-4 border-b bg-[#fafafa] px-5 dark:bg-[#0d1017]">
          <Link href="/we-adk" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              W
            </span>
            <span className="text-sm font-semibold tracking-tight">{t('app.name')}</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border px-2 py-1">
              <Globe className="text-muted-foreground size-3.5" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="bg-transparent text-xs font-medium outline-none cursor-pointer"
              >
                <option value="en">{LOCALE_LABELS.en}</option>
                <option value="ko">{LOCALE_LABELS.ko}</option>
              </select>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground relative"
              aria-label="Notifications (9 or more unread)"
              title="Notifications — not part of this mockup"
            >
              <Bell className="size-4" />
              <span className="bg-destructive absolute -top-1 -right-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-medium text-white">
                9+
              </span>
            </button>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-semibold text-white">
                설
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-medium">설욱환</p>
                <p className="text-muted-foreground text-[10px]">Planner</p>
              </div>
            </div>
          </div>
        </header>
      )}
      <main className="w-full flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
