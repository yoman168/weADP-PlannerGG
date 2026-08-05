'use client';

import { Clock, Plus, Search, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, Input, cn } from '@/components/ui';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import { StatusChip } from '@/components/we-adk/status-chip';
import { useLocale } from '@/lib/locale';
import { PROJECTS, relativeUpdated, type DesignProject } from '@/lib/we-adk-mock/projects';

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * What a planner needs before opening a project: who it is for, its status, when
 * it last moved and what it has cost. Stage, saved-state and content counts live
 * inside the project itself rather than on this card.
 */
function ProjectCard({ project, today }: { project: DesignProject; today: string | null }) {
  const { t } = useLocale();
  return (
    <Link href={`/we-adk/projects/${project.id}/sketcher`}>
      <Card className="hover:border-ring/60 h-full gap-3 py-5 transition-colors">
        <CardHeader className="gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <ProjectTile project={project} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{project.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {project.customer} · {project.owner}
                </p>
              </div>
            </div>
            <StatusChip {...project.status} />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Updated {today ? relativeUpdated(project.updatedAt, today) : project.updatedAt}
            </span>
            <span className="flex items-center gap-1.5" title={t('home.claudeSpend')}>
              <Wallet className="size-3.5" />
              <span className="font-medium">${project.spend.toFixed(2)}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SketcherProjectsPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<TabId>('active');
  const [search, setSearch] = useState('');
  const [today, setToday] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  // The clock is browser-only, so it settles after mount.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const needle = search.trim().toLowerCase();
  const projects = PROJECTS.filter((project) => {
    if ((project.archived === true) !== (tab === 'archived')) return false;
    if (!needle) return true;
    return [project.name, project.customer, project.owner, project.stage]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  const activeCount = PROJECTS.filter((project) => project.archived !== true).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('home.title')}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('home.subtitle')}
          </p>
        </div>
        <Button
          size="lg"
          className="rounded-xl"
          onClick={() =>
            flash(t('home.newProjectHint'))
          }
        >
          <Plus />
          {t('home.newProject')}
        </Button>
      </div>

      <div className="flex items-center gap-4 border-b">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-1 pb-2.5 text-sm transition-colors',
              tab === entry.id
                ? 'border-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {entry.label}
            {entry.id === 'active' && (
              <span className="text-muted-foreground ml-1.5 font-mono text-xs">{activeCount}</span>
            )}
          </button>
        ))}
        <div className="relative ml-auto mb-1.5">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <label className="sr-only" htmlFor="project-search">
            {t('home.search')}
          </label>
          <Input
            id="project-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('home.search')}
            className="h-8 w-56 pl-8 text-xs"
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {tab === 'archived' ? t('home.noArchived') : t('home.noMatch')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} today={today} />
          ))}
        </div>
      )}

      {toast && (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md px-3 py-2 text-xs shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
