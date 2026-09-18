'use client';

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ellipsis,
  FolderPlus,
  Layers,
  LayoutGrid,
  Link2,
  List,
  MessageSquare,
  MessagesSquare,
  Monitor,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  STATUS_TONE,
  deriveStatus,
  type DesignProject,
} from '@/lib/we-adk-mock/projects';
import { loadMockups } from '@/lib/we-adk-mock/mockup-tasks';
import { loadVersionStatuses, startWithNoRounds } from '@/lib/we-adk-mock/versions';

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

/** Cards browse, the table scans. Which one you are in is a display preference, so
    it stays in component state rather than the URL the workspace and filters use. */
type ViewId = 'grid' | 'table';

/** Rows per page in the table. The card grid is not paged — it scrolls, as a grid does. */
const PAGE_SIZE = 8;

/**
 * What a customer's sources say about it: how many it has, and the distinct products
 * they were moved to. Read from the Sketcher's own records — a source is a meeting,
 * a piece of feedback or a suggestion, and moving one to a product is what links the
 * two sides, so one customer reaches as many products as its sources went to.
 */
function sourceCounts(project: DesignProject) {
  if (project.archived !== true) return { sources: 0, products: 0 };
  const meetings = loadMockups(project.id);
  return {
    sources: meetings.length,
    products: new Set(
      meetings.map((meeting) => meeting.movedTo?.id).filter((id): id is string => Boolean(id)),
    ).size,
  };
}

/** Customers whose sources were moved to this product. */
function customersOf(productId: string, customers: DesignProject[]) {
  return customers.filter((customer) =>
    loadMockups(customer.id).some((meeting) => meeting.movedTo?.id === productId),
  );
}

/**
 * The chip a project shows, worked out rather than remembered — nothing sets a status
 * by hand, so this is the only place it is decided.
 */
function shownStatus(project: DesignProject, counts: { customers: number; movedSources: number }) {
  const released = Object.values(loadVersionStatuses(project.id)).includes('Released');
  return statusChip(
    deriveStatus(project, {
      customerCount: counts.customers,
      movedSources: counts.movedSources,
      released,
    }),
  );
}

function statusChip(status: ReturnType<typeof deriveStatus>) {
  return { label: status, tone: STATUS_TONE[status] };
}

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
        <div className="bg-popover text-popover-foreground border-border absolute right-0 z-50 mt-1 min-w-[160px] rounded-md border py-1 shadow-md">
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
  relatedCount,
  sourceCount,
  productCount,
  status,
  onEdit,
  onDelete,
  onJumpToCustomers,
}: {
  project: DesignProject;
  today: string | null;
  /** Customers reaching this product, when `project` is one. */
  relatedCount: number;
  /** Things this customer has said, when `project` is one. */
  sourceCount: number;
  /** Products those sources were moved to. */
  productCount: number;
  /** Worked out by the list, which can see the sources and rounds behind it. */
  status: { label: string; tone: Parameters<typeof StatusChip>[0]['tone'] };
  onEdit: () => void;
  onDelete: () => void;
  onJumpToCustomers: (productId: string) => void;
}) {
  const { t } = useLocale();
  const editable = !isSeededProject(project.id);
  const isCustomer = project.archived === true;

  const files = projectSketchScreens(project).length;
  const liveScreens = projectRealScreens(project).length;
  const meetings = project.sessions.length;
  /* A customer is described by what kind of business it is; a product by the customer
     it is for. Either way the owner follows it. */
  const who = [isCustomer ? project.companyType : project.customer, project.owner]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="group border-border/70 bg-card hover:border-primary/40 relative flex flex-col rounded-2xl border shadow-sm transition-colors">
      <Link
        href={
          isCustomer ? `/we-adk/customers/${project.id}` : `/we-adk/projects/${project.id}/sketcher`
        }
        aria-label={`Open ${project.name}`}
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="pointer-events-none relative z-20 flex flex-1 flex-col p-5">
        {/* Whose project it is, and where it stands. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectTile project={project} className="size-10 rounded-xl text-sm shadow-sm" />
            <StatusChip {...status} />
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

        {/* Who this reaches. A customer's products are wherever its sources went, so
            both sides of the relationship are counted rather than declared. */}
        {isCustomer ? (
          <div className="pointer-events-auto relative z-20 mt-3 flex flex-wrap items-center gap-2">
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium">
              <MessageSquare className="size-3.5" />
              {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
            </span>
            {productCount > 0 ? (
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium">
                <Link2 className="size-3.5" />
                {productCount} {productCount === 1 ? 'product' : 'products'}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                {t('home.needsProduct')}
              </span>
            )}
          </div>
        ) : (
          relatedCount > 0 && (
            <div className="pointer-events-auto relative z-20 mt-3">
              <button
                type="button"
                onClick={() => onJumpToCustomers(project.id)}
                className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
              >
                <Link2 className="size-3.5" />
                {relatedCount} {relatedCount === 1 ? 'customer' : 'customers'}
              </button>
            </div>
          )
        )}

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
  /*
   * The workspace and the product it is narrowed to both live in the URL now: the
   * switch between them moved up into the app header, which cannot reach this
   * component's state — and a filtered workspace becomes a link someone can send.
   */
  const params = useSearchParams();
  const tab: TabId = TABS.find((entry) => entry.noun === params.get('tab'))?.id ?? TABS[0].id;
  const relatedFilter = params.get('forProduct');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [sort, setSort] = useState<SortId>('newest');
  const [view, setView] = useState<ViewId>('grid');
  const [page, setPage] = useState(1);
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

  /** Every customer, for counting which of them reach a product. */
  const customers = all.filter((project) => project.archived === true);

  const inTab = (project: DesignProject, id: TabId) =>
    (project.archived === true) === (id === 'archived');

  const needle = search.trim().toLowerCase();

  // The statuses actually in this workspace — offering one nothing carries
  // would only be a way to empty the grid.
  const statuses = [
    ...new Set(all.filter((project) => inTab(project, tab)).map((project) => project.status.label)),
  ];

  /*
   * Statuses differ between the two workspaces, so one carried across would point at
   * an option that is not there. Ignoring it beats clearing it: the switch lives in
   * the header now, and reaching back into this page's state to reset it would mean
   * an effect that also wipes the filters a jump arrived with.
   */
  const effectiveStatus = statuses.includes(status) ? status : ANY_STATUS;

  const projects = all
    .filter((project) => {
      if (!inTab(project, tab)) return false;
      if (effectiveStatus !== ANY_STATUS && project.status.label !== effectiveStatus) return false;
      // Arrived from a product's "N customers" chip: only the customers that reach it.
      if (
        relatedFilter &&
        !loadMockups(project.id).some((meeting) => meeting.movedTo?.id === relatedFilter)
      )
        return false;
      if (!needle) return true;
      return [
        project.name,
        project.customer,
        project.companyType ?? '',
        project.owner,
        project.stage,
      ]
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
  const narrowed = needle !== '' || effectiveStatus !== ANY_STATUS || relatedFilter !== null;

  /*
   * Clamped rather than corrected. Narrowing the list can strand you past the last
   * page, and resetting the state from here would be a write during a render — so the
   * page in view is derived, and only the pager and the filters write to it.
   */
  const pageCount = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * PAGE_SIZE;
  const rows = view === 'table' ? projects.slice(firstRow, firstRow + PAGE_SIZE) : projects;

  /** Filters change what a page even means, so any of them sends you back to the first. */
  const refilter =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      setPage(1);
      apply(value);
    };

  // The products a customer engagement could be for — the Products workspace, by name.
  const products = all
    .filter((project) => project.archived !== true)
    .map((project) => ({ id: project.id, name: project.name }));

  /*
   * The customers themselves — the entries on the Customer side, by name. A product
   * points at one of these rather than at a company name retyped on every product,
   * which is what let one customer become three spellings of itself. Still free text
   * underneath, because a product may arrive before its customer does.
   */
  const customerOptions = [
    ...new Set(
      all
        .filter((project) => project.archived === true)
        .map((project) => project.name.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const relatedProductName = relatedFilter
    ? (all.find((project) => project.id === relatedFilter)?.name ?? null)
    : null;

  const jumpToProduct = useCallback(
    (productName: string) => {
      setStatus(ANY_STATUS);
      setSearch(productName);
      router.push('/we-adk?tab=product');
    },
    [router],
  );

  const jumpToCustomers = useCallback(
    (productId: string) => {
      setStatus(ANY_STATUS);
      setSearch('');
      router.push(`/we-adk?tab=customer&forProduct=${encodeURIComponent(productId)}`);
    },
    [router],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Titled after the workspace in view — the switch between them is in the
          app header now, so repeating "Your projects" here would name nothing. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
            {t(`home.section.${activeTab.noun}`)}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t(`home.sectionHint.${activeTab.noun}`)}
          </p>
        </div>
        <Button size="lg" className="rounded-xl" onClick={() => setCreating(true)}>
          <Plus />
          {t('home.create', { noun: activeTab.noun })}
        </Button>
      </header>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Finding things reads left-to-right with the list below it; the density
              switch is a view control, so it sits away at the far end. */}
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <label className="sr-only" htmlFor="project-search">
                {t('home.search')}
              </label>
              <Input
                id="project-search"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder={t(`home.searchIn.${activeTab.noun}`)}
                className="bg-background h-9 rounded-xl pl-9 text-sm"
              />
            </div>

            <Select value={effectiveStatus} onValueChange={refilter(setStatus)}>
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

            <Select
              value={sort}
              onValueChange={refilter((next: string) => setSort(next as SortId))}
            >
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

            {/* Same list, two densities: cards to browse, rows to scan a long one. */}
            <div className="border-border/70 bg-background ml-auto inline-flex overflow-hidden rounded-xl border shadow-sm">
              {(
                [
                  { id: 'grid', icon: LayoutGrid, label: t('home.viewGrid') },
                  { id: 'table', icon: List, label: t('home.viewTable') },
                ] as const
              ).map((entry) => {
                const Icon = entry.icon;
                const selected = view === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setView(entry.id)}
                    aria-label={entry.label}
                    title={entry.label}
                    aria-pressed={selected}
                    className={cn(
                      'flex h-9 items-center px-2.5 transition-colors',
                      selected
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {relatedProductName && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>Showing customers of</span>
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-2.5 font-medium">
              {relatedProductName}
              <button
                type="button"
                onClick={() => router.push(`/we-adk?tab=${activeTab.noun}`)}
                aria-label="Clear product filter"
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          </div>
        )}

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
                  if (relatedFilter) router.push(`/we-adk?tab=${activeTab.noun}`);
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
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                today={today}
                relatedCount={customersOf(project.id, customers).length}
                sourceCount={sourceCounts(project).sources}
                productCount={sourceCounts(project).products}
                status={shownStatus(project, {
                  customers: customersOf(project.id, customers).length,
                  movedSources: sourceCounts(project).products,
                })}
                onEdit={() => setEditing(project)}
                onDelete={() => handleDelete(project)}
                onJumpToCustomers={jumpToCustomers}
              />
            ))}
          </div>
        ) : (
          <div className="border-border/70 bg-card overflow-hidden rounded-2xl border shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('home.colName')}</TableHead>
                    <TableHead>
                      {tab === 'archived' ? t('home.colRelated') : t('home.colCustomers')}
                    </TableHead>
                    <TableHead>{t('home.colStatus')}</TableHead>
                    <TableHead>{t('home.colFiles')}</TableHead>
                    <TableHead>{t('home.colUpdated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((project) => {
                    /* From the sources, like the card — the old `relatedProductId` is
                       not written any more, so reading it left every row saying a
                       customer needed a product it had already been moved to. */
                    const reached = [
                      ...new Map(
                        loadMockups(project.id)
                          .filter((meeting) => meeting.movedTo)
                          .map((meeting) => [meeting.movedTo!.id, meeting.movedTo!] as const),
                      ).values(),
                    ];
                    const relatedCount = customersOf(project.id, customers).length;
                    const who = [
                      tab === 'archived' ? project.companyType : project.customer,
                      project.owner,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    /* Where the card goes, so a row and a card cannot disagree about
                       what opening a project means. */
                    const href =
                      tab === 'archived'
                        ? `/we-adk/customers/${project.id}`
                        : `/we-adk/projects/${project.id}/sketcher`;
                    return (
                      /* The row is the target. The name stays a real link so a keyboard,
                         a middle click and "open in new tab" all still work. */
                      <TableRow
                        key={project.id}
                        onClick={() => router.push(href)}
                        className="hover:bg-muted/40 cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProjectTile project={project} className="size-7 rounded-lg text-xs" />
                            <div className="min-w-0">
                              <Link
                                href={href}
                                className="hover:text-primary block truncate font-medium"
                              >
                                {project.name}
                              </Link>
                              {who && (
                                <span className="text-muted-foreground block truncate text-xs">
                                  {who}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {tab === 'archived' ? (
                            reached.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {reached.map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      jumpToProduct(product.name);
                                    }}
                                    className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors"
                                  >
                                    <Link2 className="size-3 shrink-0" />
                                    <span className="truncate">{product.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                {t('home.needsProduct')}
                              </span>
                            )
                          ) : relatedCount > 0 ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                jumpToCustomers(project.id);
                              }}
                              className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors"
                            >
                              <Link2 className="size-3" />
                              {relatedCount}
                            </button>
                          ) : (
                            <span className="text-muted-foreground/60 text-xs">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <StatusChip
                            {...shownStatus(project, {
                              customers: customersOf(project.id, customers).length,
                              movedSources: sourceCounts(project).products,
                            })}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs tabular-nums">
                          {projectSketchScreens(project).length}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {today ? relativeUpdated(project.updatedAt, today) : project.updatedAt}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <span className="text-muted-foreground text-xs">
                {t('home.showing', {
                  from: firstRow + 1,
                  to: Math.min(firstRow + PAGE_SIZE, projects.length),
                  total: projects.length,
                })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft />
                  {t('home.prevPage')}
                </Button>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t('home.pageOf', { page: currentPage, pages: pageCount })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t('home.nextPage')}
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={creating}
        noun={activeTab.noun}
        existingNames={all.map((project) => project.name)}
        customerOptions={customerOptions}
        onClose={() => setCreating(false)}
        onCreate={(fields) => {
          const stamp = today ?? new Date().toISOString().slice(0, 10);
          const taken = new Set(all.map((entry) => entry.id));
          const project = createProject(fields, stamp, taken);
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
        customerOptions={customerOptions}
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
