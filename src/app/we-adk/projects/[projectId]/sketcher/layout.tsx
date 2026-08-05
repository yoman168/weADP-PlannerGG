'use client';

import { ClipboardList, FileStack, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';

/**
 * The Business phase is more than its design files: the meetings behind them and
 * the material gathered around them. Those are the tabs.
 *
 * Main covers the design files and the board — two views of the same set, so the
 * tab stays lit for both, and for an open canvas.
 */
const TABS = [
  { segment: '', labelKey: 'tab.main' as const, icon: FileStack, also: ['/board', '/canvas', '/preview'] },
  { segment: '/task', labelKey: 'tab.task' as const, icon: ClipboardList },
  { segment: '/user', labelKey: 'tab.user' as const, icon: Users },
];

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const base = `/we-adk/projects/${params.projectId}/sketcher`;

  return (
    <div className="-mx-6 -mb-6 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden">
      <nav
        aria-label={t('sections.businessSections')}
        className="bg-background flex shrink-0 items-center gap-1 border-b px-3"
      >
        {TABS.map((tab) => {
          const href = `${base}${tab.segment}`;
          const active = tab.also
            ? pathname === base || tab.also.some((extra) => pathname.startsWith(`${base}${extra}`))
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.labelKey}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              <tab.icon className="size-4 shrink-0" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
