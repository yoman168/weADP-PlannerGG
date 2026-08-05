'use client';

import { ArrowLeft, Bell, Code2, FlaskConical, GitMerge, Globe, PenTool } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { Button, cn } from '@/components/ui';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import { useLocale, LOCALE_LABELS, type Locale } from '@/lib/locale';
import { findProject } from '@/lib/we-adk-mock/projects';

const TOOLS = [
  { segment: '/sketcher', labelKey: 'tool.business', icon: PenTool, tone: 'text-violet-500' },
  { segment: '/design', labelKey: 'tool.design', icon: GitMerge, tone: 'text-amber-500' },
  { segment: '/developer', labelKey: 'tool.developer', icon: Code2, tone: 'text-sky-500' },
  { segment: '/qa', labelKey: 'tool.qa', icon: FlaskConical, tone: 'text-emerald-500' },
];

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const project = findProject(params.projectId);
  const { locale, setLocale, t } = useLocale();
  const base = `/we-adk/projects/${params.projectId}`;

  const spend = project?.spend ?? 0;
  const budget = 5;
  const spendRatio = budget > 0 ? spend / budget : 0;
  const spendPct = Math.min(spendRatio * 100, 100);
  // A bar that is full and green reads as healthy, which is wrong once the
  // spend is past the budget.
  const spendTone =
    spendRatio >= 1 ? 'bg-red-500' : spendRatio >= 0.75 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="-mx-6 -my-6 flex min-h-[calc(100dvh-3rem)]">
      {/* ---- Project top bar ---- */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b bg-[#fafafa] px-4 dark:bg-[#0d1017]">
        {/* Left: back + project identity */}
        <Link
          href="/we-adk"
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 text-xs"
        >
          <span className="flex size-5 items-center justify-center rounded bg-emerald-500/15 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            W
          </span>
          <ArrowLeft className="size-3" />
          {t('nav.projects')}
        </Link>

        {project && (
          <Link
            href={base}
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ProjectTile project={project} className="size-5 shrink-0 rounded text-[9px]" />
            <span className="truncate text-sm font-semibold">{project.name}</span>
          </Link>
        )}

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1">
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
          className="text-muted-foreground hover:text-foreground relative shrink-0"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="bg-destructive absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-medium text-white">
            9+
          </span>
        </button>

        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border bg-emerald-50 px-2.5 py-1 md:flex dark:bg-emerald-500/10">
          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
            S
          </span>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {t('nav.members')}
          </span>
        </div>

        {/* Spend tracker — the first thing to go when the bar runs out of room. */}
        <div
          className="hidden shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 lg:flex"
          title={
            spendRatio >= 1
              ? `Over budget: $${spend.toFixed(2)} spent of $${budget.toFixed(2)}`
              : `$${spend.toFixed(2)} spent of $${budget.toFixed(2)}`
          }
        >
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            {t('nav.spend')}
          </span>
          <span
            className={cn(
              'text-xs font-semibold',
              spendRatio >= 1 && 'text-red-600 dark:text-red-400',
            )}
          >
            ${spend.toFixed(2)} / ${budget.toFixed(2)}
          </span>
          <div className="bg-muted h-1.5 w-16 rounded-full">
            <div
              className={cn('h-1.5 rounded-full transition-all', spendTone)}
              style={{ width: `${spendPct}%` }}
            />
          </div>
        </div>

        <Button variant="outline" size="sm" className="hidden h-7 text-xs sm:inline-flex">
          {t('nav.archive')}
        </Button>

        <Button size="sm" className="h-7 text-xs">
          {t('nav.saveGitlab')}
        </Button>
      </div>

      {/* ---- Sidebar ---- */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-[#fafafa] pt-12 dark:bg-[#0d1017]">
        <nav className="flex flex-col gap-0.5 px-3 py-3">
          {TOOLS.map((tool) => {
            const href = `${base}${tool.segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={tool.labelKey}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                  active
                    ? 'bg-background text-foreground font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                )}
              >
                <tool.icon className={cn('size-4 shrink-0', !active && tool.tone)} />
                {t(tool.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto" />

        <p className="text-muted-foreground px-4 py-3 text-[10px] leading-relaxed">
          {t('nav.mockupOnly')}
        </p>
      </aside>

      {/* pt-12 clears the fixed bar; spelling out pb keeps it out of a fight
          with py-6, which sets the same edge. */}
      <div className="min-w-0 flex-1 px-6 pt-12 pb-6">{children}</div>
    </div>
  );
}
