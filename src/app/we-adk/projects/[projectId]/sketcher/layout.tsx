'use client';

import { FileStack, Layers, LayoutDashboard, ListTree, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { cn } from '@/components/ui';
import { BusinessVersionRail } from '@/components/we-adk/business-version-rail';
import { useLocale } from '@/lib/locale';
import { findProject } from '@/lib/we-adk-mock/projects';

/**
 * The Business phase is more than its design files: the meetings behind them and
 * the material gathered around them. Those are the tabs.
 *
 * Ordered as the work runs rather than by importance: someone drafts, the
 * round's designs are what that settles into, and the report reads them. Main
 * sits second for that reason — it is the result of the work, not the front
 * door.
 *
 * Main covers the design files, the board and the screen flow — readings of the
 * same set, so the tab stays lit for all of them. It keeps the empty segment
 * whatever its position: `/sketcher` is the route the rest of the app links to,
 * and order here is display only.
 */
const TABS = [
  { segment: '/overview', labelKey: 'tab.overview' as const, icon: LayoutDashboard },
  {
    segment: '',
    labelKey: 'tab.main' as const,
    icon: FileStack,
    also: ['/board', '/preview', '/flow'],
  },
  { segment: '/ia', labelKey: 'tab.ia' as const, icon: ListTree },
  { segment: '/drafts', labelKey: 'tab.drafts' as const, icon: Layers },
];

const SETTING_TAB = { segment: '/setting', labelKey: 'tab.setting' as const, icon: Settings };

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const base = `/we-adk/projects/${params.projectId}/sketcher`;
  const project = findProject(params.projectId);

  // Mini mockup projects skip the full sketcher chrome
  if (project?.archived) {
    return <div className="-mx-6 flex min-h-0 flex-1 overflow-hidden">{children}</div>;
  }

  return (
    // Fills the layout's content column rather than measuring the viewport
    // itself — the same reason the Developer tab stopped doing its own maths.
    // A row, not a column: the rounds rail owns the left edge for the whole tab
    // and the tab bar sits beside it, which is the shape the Developer tab has.
    // With the bar above the rail instead, choosing a round read as a control
    // belonging to whichever view happened to be open.
    <div className="-mx-6 flex min-h-0 flex-1 overflow-hidden">
      <Suspense fallback={<div className="w-44 shrink-0 border-r max-lg:hidden" />}>
        <BusinessVersionRail />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <nav
          aria-label={t('sections.businessSections')}
          className="bg-background flex shrink-0 items-center gap-1 border-b px-3"
        >
          {TABS.map((tab) => {
            const href = `${base}${tab.segment}`;
            const active = tab.also
              ? pathname === base ||
                tab.also.some((extra) => pathname.startsWith(`${base}${extra}`))
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

          {/* Setting pushed to the right */}
          {(() => {
            const href = `${base}${SETTING_TAB.segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'ml-auto flex items-center gap-2 px-3.5 py-3 transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <SETTING_TAB.icon className="size-4 shrink-0" />
              </Link>
            );
          })()}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
