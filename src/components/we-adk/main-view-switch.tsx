'use client';

/**
 * Main's two readings of one round: the files themselves, and the flow they
 * make.
 *
 * Links rather than state, because the two views are two routes — the flow
 * sits outside the workspace group so it gets the full width, the same reason
 * the board does. Carrying `?folder=` across means choosing a reading never
 * changes which round is being read.
 */

import { FileStack, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';

export function MainViewSwitch({
  projectId,
  active,
  folderId,
}: {
  projectId: string;
  active: 'files' | 'flow';
  /** The round in view, kept across the switch. */
  folderId?: string;
}) {
  const { t } = useLocale();
  const base = `/we-adk/projects/${projectId}/sketcher`;
  const query = folderId ? `?folder=${folderId}` : '';

  const options = [
    { id: 'files' as const, href: `${base}${query}`, label: t('main.viewFiles'), icon: FileStack },
    {
      id: 'flow' as const,
      href: `${base}/flow${query}`,
      label: t('main.viewFlowShort'),
      icon: LayoutGrid,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('main.viewSwitch')}
      className="bg-muted inline-flex w-fit shrink-0 items-center gap-0.5 rounded-lg p-0.5"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const current = active === option.id;
        return (
          <Link
            key={option.id}
            href={option.href}
            role="tab"
            aria-selected={current}
            className={cn(
              'focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none',
              current
                ? 'bg-background text-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
