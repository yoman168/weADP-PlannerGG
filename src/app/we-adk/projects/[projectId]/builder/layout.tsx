'use client';

import {
  Bookmark,
  FileCheck2,
  FileText,
  FlaskConical,
  Layers,
  ListChecks,
  ListTodo,
  Palette,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { cn } from '@/components/ui';

/**
 * Builder's own sections, inside one project. The project is the scope — there
 * is no work-group picker any more, because the project already fixes which
 * customer and solution this work belongs to.
 */
const NAV = [
  { segment: '', label: 'Work mockups', icon: ListTodo },
  { segment: '/requirements', label: 'Requirements spec', icon: FileCheck2 },
  { segment: '/solutions', label: 'Solution mockups', icon: Palette, tone: 'text-amber-500' },
  { segment: '/specs', label: 'Feature specs', icon: FileText },
  { segment: '/screens', label: 'Screen designs', icon: Layers },
  { segment: '/unit-tests', label: 'Unit tests', icon: FlaskConical },
  { segment: '/integration-tests', label: 'Integration tests', icon: ListChecks },
  { segment: '/manuals', label: 'User manuals', icon: Bookmark },
];

export default function BuilderLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const base = `/we-adk/projects/${params.projectId}/builder`;

  return (
    <div className="-mx-6 -my-6 flex min-h-[calc(100dvh-3rem)]">
      <aside className="bg-background flex w-52 shrink-0 flex-col overflow-y-auto border-r">
        <p className="text-muted-foreground px-4 pt-4 pb-2 text-[11px] font-medium tracking-wide uppercase">
          Builder
        </p>
        <nav className="flex flex-col gap-0.5 px-2 pb-2">
          {NAV.map((item) => {
            const href = `${base}${item.segment}`;
            // Work mockups stays active on its board route (…/builder/<mockupId>).
            const active =
              item.segment === ''
                ? pathname === base || pathname.startsWith(`${base}/wm-`)
                : pathname === href;
            return (
              <Link
                key={item.label}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <item.icon className={cn('size-4 shrink-0', item.tone ?? 'text-emerald-500')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="bg-background min-w-0 flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
