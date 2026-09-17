'use client';

/**
 * The two workspaces, as navigation in the app header.
 *
 * They used to be a pill switch inside the project list. Up here they read as what
 * they are — the top level of this part of the app — and the list below is free to
 * title itself after whichever one is open.
 *
 * Which one is open lives in the URL rather than in the page's state, because the
 * control that changes it is no longer inside the page. That also makes a workspace
 * linkable, which it never was.
 */

import { Building2, Package } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui';
import { STORE_CHANGED_EVENT } from '@/lib/api/workspace-store';
import { useLocale } from '@/lib/locale';
import { loadCreatedProjects } from '@/lib/we-adk-mock/created-projects';
import { PROJECTS, type DesignProject } from '@/lib/we-adk-mock/projects';

/** Plural, and the same words the list titles itself with — not `WORKSPACE_LABEL`,
    which names one project's workspace ("Customer") rather than the group. */
export const WORKSPACE_NAV = [
  { noun: 'customer', icon: Building2, archived: true },
  { noun: 'product', icon: Package, archived: false },
] as const;

export function WorkspaceNav() {
  const { t } = useLocale();
  const wanted = useSearchParams().get('tab');
  const active = WORKSPACE_NAV.find((item) => item.noun === wanted) ?? WORKSPACE_NAV[0];
  const [projects, setProjects] = useState<DesignProject[]>([]);

  // Browser-only, like the rest of the mock layer, so the counts settle after mount
  // and the first paint still matches the markup the server sent. Re-read on the
  // store's own change event, which every project mutation now fires.
  useEffect(() => {
    const read = () => setProjects([...loadCreatedProjects(), ...PROJECTS]);
    read();
    window.addEventListener(STORE_CHANGED_EVENT, read);
    return () => window.removeEventListener(STORE_CHANGED_EVENT, read);
  }, []);

  return (
    <nav className="border-border/70 ml-1 flex items-center gap-1 border-l pl-3">
      {WORKSPACE_NAV.map((item) => {
        const selected = item.noun === active.noun;
        const count = projects.filter(
          (project) => (project.archived === true) === item.archived,
        ).length;
        const Icon = item.icon;
        return (
          <Link
            key={item.noun}
            href={`/we-adk?tab=${item.noun}`}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3',
              selected
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] dark:hover:bg-white/5',
            )}
          >
            <Icon
              className={cn('size-4', selected ? 'text-primary' : 'text-muted-foreground/70')}
            />
            {t(`home.section.${item.noun}`)}
            <span
              className={cn(
                'text-[11px] tabular-nums',
                selected ? 'text-primary' : 'text-muted-foreground/70',
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
