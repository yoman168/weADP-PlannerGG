'use client';

import {
  ArrowUpDown,
  Clock,
  Ellipsis,
  FolderPlus,
  Layers,
  MessagesSquare,
  Monitor,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { CreateProjectDialog } from '@/components/we-adk/create-project-dialog';
import { EditProjectDialog } from '@/components/we-adk/edit-project-dialog';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import { StatusChip } from '@/components/we-adk/status-chip';
import { useLocale } from '@/lib/locale';
import {
  createProject,
  deleteProject,
  loadCreatedProjects,
  toggleArchiveProject,
  updateProject,
} from '@/lib/we-adk-mock/created-projects';
import {
  PROJECTS,
  isSeededProject,
  projectRealScreens,
  projectSketchScreens,
  relativeUpdated,
  WORKSPACE_LABEL,
  type DesignProject,
} from '@/lib/we-adk-mock/projects';
import { startWithNoRounds } from '@/lib/we-adk-mock/versions';

/**
 * The two workspaces a project can live in — work done for a customer, and the
 * products we own.
 *
 * The ids stay `active`/`archived` — they key stored projects, and renaming
 * them would orphan every project already filed under the old value. Only the
 * labels change.
 */
const TABS = [
  { id: 'archived', label: WORKSPACE_LABEL.customer, noun: 'customer' },
  { id: 'active', label: WORKSPACE_LABEL.product, noun: 'product' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** How the grid is ordered. Newest first, because that is what you came back for. */
const SORTS = [
  { id: 'newest', key: 'home.sortNewest' },
  { id: 'oldest', key: 'home.sortOldest' },
  { id: 'name', key: 'home.sortName' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

/** The status filter's "no filter" value — Radix items cannot carry an empty one. */
const ANY_STATUS = 'all';

/** Dropdown that closes on outside click or Escape. */
function ProjectActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event instanceof MouseEvent && ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 transition-colors',
          open && 'bg-muted text-foreground',
        )}
        aria-label="Project actions"
      >
        <Ellipsis className="size-4" />
      </button>
      {open && (
        <div className="bg-popover text-popover-foreground border-border absolute right-0 z-50 mt-1 min-w-[140px] rounded-md border py-1 shadow-md">
          <button
            type="button"
            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            type="button"
            className="hover:bg-destructive/10 text-destructive flex w-full items-center gap-2 px-3 py-1.5 text-xs"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** One fact about a project, as an icon and a line of text. */
function Meta({ icon: Icon, children }: { icon: typeof Clock; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

/**
 * A project as a card: who it is for, what it is about, what has been made,
 * and how far down the pipeline it has got.
 *
 * The whole card opens the project — the link is an overlay under the content
 * rather than a wrapper around it, so the actions menu stays a real button
 * instead of a button nested inside an anchor.
 */
function ProjectCard({
  project,
  today,
  onEdit,
  onDelete,
}: {
  project: DesignProject;
  today: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const editable = !isSeededProject(project.id);

  const files = projectSketchScreens(project).length;
  const liveScreens = projectRealScreens(project).length;
  const meetings = project.sessions.length;
  // A created project has a customer but not always an owner yet.
  const who = [project.customer, project.owner].filter(Boolean).join(' · ');

  return (
    <article className="group border-border/70 bg-card hover:border-primary/40 relative flex flex-col rounded-2xl border shadow-sm transition-colors">
      <Link
        href={`/we-adk/projects/${project.id}/sketcher`}
        aria-label={`Open ${project.name}`}
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="pointer-events-none relative z-20 flex flex-1 flex-col p-5">
        {/* Whose project it is, and where it stands. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectTile project={project} className="size-10 rounded-xl text-sm shadow-sm" />
            <StatusChip {...project.status} />
          </div>
          {editable && <ProjectActionsMenu onEdit={onEdit} onDelete={onDelete} />}
        </div>

        <h2 className="mt-4 truncate font-semibold tracking-tight">{project.name}</h2>
        {who && <p className="text-muted-foreground mt-1 truncate text-xs">{who}</p>}

        <p
          className={cn(
            'mt-2.5 line-clamp-2 text-[13px] leading-relaxed',
            project.summary ? 'text-muted-foreground' : 'text-muted-foreground/70',
          )}
        >
          {project.summary || t('home.noBrief')}
        </p>

        {/* What has been made. */}
        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <Meta icon={Layers}>
            {files === 1 ? t('home.fileOne') : t('home.files', { count: files })}
          </Meta>
          {meetings > 0 && (
            <Meta icon={MessagesSquare}>
              {meetings === 1 ? t('home.meetingOne') : t('home.meetings', { count: meetings })}
            </Meta>
          )}
          {liveScreens > 0 && (
            <Meta icon={Monitor}>{t('home.liveScreens', { count: liveScreens })}</Meta>
          )}
          <Meta icon={Clock}>
            {t('home.updated', {
              when: today ? relativeUpdated(project.updatedAt, today) : project.updatedAt,
            })}
          </Meta>
        </div>
      </div>
    </article>
  );
}

function ProjectsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const wanted = useSearchParams().get('tab');
  const [tab, setTab] = useState<TabId>(
    TABS.find((entry) => entry.noun === wanted)?.id ?? TABS[0].id,
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [sort, setSort] = useState<SortId>('newest');
  const [today, setToday] = useState<string | null>(null);
  const [created, setCreated] = useState<DesignProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DesignProject | null>(null);
  /** The project waiting on a yes or no, if any. */
  const [deleting, setDeleting] = useState<DesignProject | null>(null);

  const reload = useCallback(() => setCreated(loadCreatedProjects()), []);

  /*
   * Asked in the app, not by the browser.
   *
   * `window.confirm` is the one dialog here nobody designed: it names the
   * origin rather than the product, it cannot show what is about to go, and it
   * freezes the page while it waits. For the one action that cannot be undone,
   * that is the wrong dialog.
   */
  const handleDelete = useCallback((project: DesignProject) => setDeleting(project), []);

  const confirmDelete = useCallback(() => {
    if (!deleting) return;
    deleteProject(deleting.id);
    setDeleting(null);
    reload();
  }, [deleting, reload]);

  // The clock and the created projects are both browser-only, so they settle
  // after mount — which is also what keeps this first render identical to the
  // markup the server sent.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
    setCreated(loadCreatedProjects());
  }, []);

  // Yours first. A project you just made is the one you are looking for, and the
  // samples are the furniture.
  const all = [...created, ...PROJECTS];

  const inTab = (project: DesignProject, id: TabId) =>
    (project.archived === true) === (id === 'archived');

  const needle = search.trim().toLowerCase();

  // The statuses actually in this workspace — offering one nothing carries
  // would only be a way to empty the grid.
  const statuses = [
    ...new Set(all.filter((project) => inTab(project, tab)).map((project) => project.status.label)),
  ];

  const projects = all
    .filter((project) => {
      if (!inTab(project, tab)) return false;
      if (status !== ANY_STATUS && project.status.label !== status) return false;
      if (!needle) return true;
      return [project.name, project.customer, project.owner, project.stage]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    })
    // `updatedAt` is `YYYY-MM-DD`, so comparing the strings compares the dates.
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'oldest') return a.updatedAt.localeCompare(b.updatedAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  // The tab in view names what the create button makes and what the form calls it.
  const activeTab = TABS.find((entry) => entry.id === tab) ?? TABS[0];

  // An empty grid reads differently when you narrowed it yourself.
  const narrowed = needle !== '' || status !== ANY_STATUS;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
            {t('home.title')}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{t('home.subtitle')}</p>
        </div>
        <Button size="lg" className="rounded-xl" onClick={() => setCreating(true)}>
          <Plus />
          {t('home.create', { noun: activeTab.noun })}
        </Button>
      </header>

      <div className="flex min-w-0 flex-col gap-4">
        {/* The two workspaces, and a way to find one project inside them. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="border-border/70 bg-background inline-flex rounded-xl border p-1 shadow-sm">
            {TABS.map((entry) => {
              const count = all.filter((project) => inTab(project, entry.id)).length;
              const selected = tab === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  // Statuses differ between the two workspaces, so a filter
                  // carried across would point at an option that is not there.
                  onClick={() => {
                    setTab(entry.id);
                    setStatus(ANY_STATUS);
                  }}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {entry.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] tabular-nums',
                      selected ? 'bg-background/20' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <label className="sr-only" htmlFor="project-search">
                {t('home.search')}
              </label>
              <Input
                id="project-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('home.search')}
                className="bg-background h-9 rounded-xl pl-9 text-sm"
              />
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                aria-label={t('home.filterStatus')}
                className="border-border/70 bg-background h-9 rounded-xl shadow-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_STATUS}>{t('home.allStatus')}</SelectItem>
                {statuses.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(next) => setSort(next as SortId)}>
              <SelectTrigger
                aria-label={t('home.sortBy')}
                className="border-border/70 bg-background h-9 rounded-xl shadow-sm"
              >
                <ArrowUpDown className="text-muted-foreground size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {t(entry.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-4 rounded-2xl border border-dashed py-20 text-center">
            <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
              {narrowed ? <Search className="size-5" /> : <FolderPlus className="size-5" />}
            </span>
            <div className="max-w-sm">
              <p className="font-medium">
                {narrowed ? t('home.noMatch') : t('home.emptyTitle', { noun: activeTab.noun })}
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {narrowed ? t('home.noMatchHint') : t('home.emptyHint', { noun: activeTab.noun })}
              </p>
            </div>
            {narrowed ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatus(ANY_STATUS);
                }}
              >
                {t('home.clearSearch')}
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                {t('home.create', { noun: activeTab.noun })}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                today={today}
                onEdit={() => setEditing(project)}
                onDelete={() => handleDelete(project)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={creating}
        noun={activeTab.noun}
        existingNames={all.map((project) => project.name)}
        onClose={() => setCreating(false)}
        onCreate={(fields) => {
          const stamp = today ?? new Date().toISOString().slice(0, 10);
          const project = createProject(fields, stamp, new Set(all.map((entry) => entry.id)));
          startWithNoRounds(project.id);
          if (tab === 'archived') toggleArchiveProject(project.id);
          setCreated(loadCreatedProjects());
          router.push(`/we-adk/projects/${project.id}/sketcher`);
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="text-foreground font-medium">{deleting?.name}</span> and everything in
            it — its rounds, design files and meetings — will be removed. This cannot be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EditProjectDialog
        project={editing}
        onClose={() => setEditing(null)}
        onSave={(fields) => {
          if (!editing) return;
          updateProject(editing.id, fields);
          setEditing(null);
          reload();
        }}
      />
    </div>
  );
}

/**
 * The tab lives in the URL, which only the browser knows.
 *
 * `useSearchParams` reads it, and the static export build refuses to prerender
 * a page that calls it without a boundary to fall back to.
 */
export default function SketcherProjectsPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl" />}>
      <ProjectsPage />
    </Suspense>
  );
}
