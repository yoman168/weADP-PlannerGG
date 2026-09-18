'use client';

/**
 * A customer at a glance: who it is, what it has said, and which products that reached.
 *
 * Read-only on purpose. The Sketcher already owns sources — creating one, writing its
 * notes, moving it to a product — and a second place to do any of that is how one
 * customer ends up with two lists that disagree. This answers the question the list
 * cannot ("where does this customer stand?") and hands off to the Sketcher for the
 * work itself.
 */

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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
  Textarea,
  cn,
} from '@/components/ui';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import { loadCreatedProjects } from '@/lib/we-adk-mock/created-projects';
import {
  TASK_SOURCES,
  loadMockups,
  saveMockups,
  taskSource,
  type MockupMeeting,
  type TaskSource,
} from '@/lib/we-adk-mock/mockup-tasks';
import { PROJECTS, type DesignProject } from '@/lib/we-adk-mock/projects';

/** Rows per page in the list view, as on the customer list it mirrors. */
const PAGE_SIZE = 8;

export default function CustomerOverviewPage() {
  const customerId = useParams<{ customerId: string }>().customerId;
  const router = useRouter();

  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [sources, setSources] = useState<MockupMeeting[]>([]);
  const [ready, setReady] = useState(false);
  /* Creating and removing a source moved here with the list they belong to. */
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MockupMeeting | null>(null);
  /* The same three controls the customer list carries, over the same kind of list. */
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'moved' | 'waiting'>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({
    title: '',
    kind: 'meeting' as TaskSource,
    attendees: '',
    notes: '',
  });

  const reload = useCallback(() => {
    setProjects([...loadCreatedProjects(), ...PROJECTS]);
    setSources(loadMockups(customerId));
    setReady(true);
  }, [customerId]);

  // Browser-only, like the rest of the mock layer, so it settles after mount.
  useEffect(() => reload(), [reload]);

  const customer = projects.find((project) => project.id === customerId) ?? null;
  const sketcher = `/we-adk/projects/${customerId}/sketcher`;

  /* Its products are wherever its sources went — nobody sets that, so it is counted. */
  const reached = [
    ...new Map(
      sources
        .filter((source) => source.movedTo)
        .map((source) => [source.movedTo!.id, source.movedTo!] as const),
    ).values(),
  ];

  const needle = search.trim().toLowerCase();
  const shown = sources.filter((source) => {
    if (status === 'moved' && !source.movedTo) return false;
    if (status === 'waiting' && source.movedTo) return false;
    if (!needle) return true;
    return [
      source.title,
      source.notes,
      source.attendees,
      source.movedTo?.name ?? '',
      TASK_SOURCES.find((entry) => entry.id === taskSource(source.source))?.label ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
  /** An empty list reads differently when you narrowed it yourself. */
  const narrowed = needle !== '' || status !== 'all';

  /* Clamped rather than corrected, so narrowing cannot strand you past the last page
     and the fix is never a write during a render. */
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * PAGE_SIZE;
  const rows = view === 'list' ? shown.slice(firstRow, firstRow + PAGE_SIZE) : shown;

  /* The same two pieces in both layouts, so a card and a row cannot drift apart. */
  const movedChip = (source: MockupMeeting) => (
    <span
      className={cn(
        'max-w-[12rem] truncate rounded px-2 py-0.5 text-[11px] font-medium',
        source.movedTo
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      )}
    >
      {source.movedTo ? `\u2192 ${source.movedTo.name}` : 'Not moved'}
    </span>
  );

  const removeButton = (source: MockupMeeting) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        setPendingDelete(source);
      }}
      aria-label={`Delete ${source.title}`}
      title="Delete source"
      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-lg p-2 transition-colors"
    >
      <Trash2 className="size-4" />
    </button>
  );

  const addSource = () => {
    const title = draft.title.trim() || 'Untitled source';
    const next: MockupMeeting[] = [
      ...sources,
      {
        id: `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        date: new Date().toISOString().slice(0, 10),
        attendees: draft.attendees.trim(),
        notes: draft.notes.trim(),
        kind: 'meeting-note',
        source: draft.kind,
      },
    ];
    saveMockups(customerId, next);
    setSources(next);
    setCreating(false);
    setDraft({ title: '', kind: 'meeting', attendees: '', notes: '' });
  };

  const removeSource = () => {
    if (!pendingDelete) return;
    const next = sources.filter((source) => source.id !== pendingDelete.id);
    saveMockups(customerId, next);
    setSources(next);
    setPendingDelete(null);
  };

  // Nothing is missing until the store has actually answered.
  if (ready && !customer) {
    return (
      <div className="mx-auto w-full max-w-4xl py-16 text-center">
        <p className="text-muted-foreground text-sm">
          That customer is not here.{' '}
          <Link href="/we-adk?tab=customer" className="text-primary underline underline-offset-2">
            Back to customers
          </Link>
        </p>
      </div>
    );
  }
  if (!customer) return <div className="mx-auto w-full max-w-4xl" />;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        href="/we-adk?tab=customer"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs"
      >
        <ArrowLeft className="size-3.5" /> Customers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectTile project={customer} className="size-11 rounded-xl text-base shadow-sm" />
          <div className="min-w-0">
            <h1 className="truncate text-[26px] leading-tight font-semibold tracking-tight">
              {customer.name}
            </h1>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {[customer.companyType, customer.owner].filter(Boolean).join(' · ') ||
                'No details yet'}
            </p>
          </div>
        </div>
        <Button className="rounded-xl" onClick={() => setCreating(true)}>
          <Plus /> New source
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border-border/70 bg-card rounded-2xl border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Sources</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{sources.length}</p>
          <p className="text-muted-foreground/70 mt-1 text-xs">
            Meetings, feedback and suggestions from this customer
          </p>
        </div>
        <div className="border-border/70 bg-card rounded-2xl border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs">Products reached</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{reached.length}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reached.length === 0 ? (
              <span className="text-muted-foreground/70 text-xs">
                None yet — move a source to a product in the designs.
              </span>
            ) : (
              reached.map((product) => (
                <Link
                  key={product.id}
                  href="/we-adk?tab=product"
                  className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors"
                >
                  {product.name}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">What this customer has said</h2>

        {/* Finding things reads left-to-right with the list below it; the density switch
            is a view control, so it sits away at the far end — as on the customer list. */}
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <label className="sr-only" htmlFor="source-search">
                Search sources
              </label>
              <Input
                id="source-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sources"
                className="bg-background h-9 rounded-xl pl-9 text-sm"
              />
            </div>

            <Select value={status} onValueChange={(next) => setStatus(next as typeof status)}>
              <SelectTrigger
                aria-label="Filter sources by status"
                className="border-border/70 bg-background h-9 w-auto rounded-xl shadow-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="waiting">Not moved</SelectItem>
                <SelectItem value="moved">Moved</SelectItem>
              </SelectContent>
            </Select>

            <div className="border-border/70 bg-background ml-auto inline-flex overflow-hidden rounded-xl border shadow-sm">
              {(
                [
                  { id: 'grid', icon: LayoutGrid, label: 'Card view' },
                  { id: 'list', icon: List, label: 'List view' },
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
                    aria-pressed={selected}
                    title={entry.label}
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
        )}

        {sources.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed py-14 text-center">
            <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
              <MessageSquare className="size-5" />
            </span>
            <div className="max-w-sm">
              <p className="font-medium">Nothing from this customer yet</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Log a meeting, a piece of feedback or a suggestion. Opening one takes you into the
                designs, where it is moved to the product that will answer it.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New source
            </Button>
          </div>
        ) : (
          <>
            {shown.length === 0 ? (
              <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
                <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
                  <Search className="size-5" />
                </span>
                <p className="text-muted-foreground text-sm">Nothing matches that.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatus('all');
                  }}
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <>
                {view === 'grid' ? (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map((source) => (
                      <li key={source.id} className="relative">
                        <Link
                          href={`${sketcher}?source=${encodeURIComponent(source.id)}`}
                          className="border-border/70 bg-card hover:border-primary/40 flex h-full flex-col gap-2 rounded-xl border p-4 pr-12 shadow-sm transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-[11px] font-medium">
                              {TASK_SOURCES.find((e) => e.id === taskSource(source.source))?.label}
                            </span>
                            {movedChip(source)}
                          </span>
                          <span className="truncate text-sm font-medium">{source.title}</span>
                          {source.notes.trim() && (
                            <span className="text-muted-foreground line-clamp-2 text-[13px] leading-relaxed">
                              {source.notes}
                            </span>
                          )}
                          <span className="text-muted-foreground mt-auto inline-flex items-center gap-1 text-[11px]">
                            <CalendarDays className="size-3" />
                            {source.date}
                          </span>
                        </Link>
                        <span className="absolute top-3 right-2">{removeButton(source)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* The customer list's own table, over this customer's sources. */
                  <div className="border-border/70 bg-card overflow-hidden rounded-2xl border shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Moved to</TableHead>
                            <TableHead>Attendees</TableHead>
                            <TableHead>Logged</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((source) => (
                            /* The row is the target. The title stays a real link so a
                               keyboard, a middle click and "open in new tab" all still
                               work — clicking anywhere else just follows it. */
                            <TableRow
                              key={source.id}
                              onClick={() =>
                                router.push(`${sketcher}?source=${encodeURIComponent(source.id)}`)
                              }
                              className="hover:bg-muted/40 cursor-pointer"
                            >
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium">
                                    {
                                      TASK_SOURCES.find((e) => e.id === taskSource(source.source))
                                        ?.label
                                    }
                                  </span>
                                  <Link
                                    href={`${sketcher}?source=${encodeURIComponent(source.id)}`}
                                    className="hover:text-primary min-w-0 truncate font-medium"
                                  >
                                    {source.title}
                                  </Link>
                                </div>
                              </TableCell>
                              <TableCell>{movedChip(source)}</TableCell>
                              <TableCell className="text-muted-foreground max-w-[12rem] truncate text-xs">
                                {source.attendees || '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {source.date}
                              </TableCell>
                              <TableCell className="w-10">{removeButton(source)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                      <span className="text-muted-foreground text-xs">
                        Showing {firstRow + 1}–{Math.min(firstRow + PAGE_SIZE, shown.length)} of{' '}
                        {shown.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          <ChevronLeft /> Prev
                        </Button>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          Page {currentPage} of {pageCount}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= pageCount}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          Next <ChevronRight />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Dialog open={creating} onOpenChange={(next) => !next && setCreating(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New source</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-title">Title</Label>
              <Input
                id="source-title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Q3 requirements"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-kind" className="text-muted-foreground font-normal">
                Kind
              </Label>
              <Select
                value={draft.kind}
                onValueChange={(next) => setDraft({ ...draft, kind: next as TaskSource })}
              >
                <SelectTrigger id="source-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_SOURCES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-attendees" className="text-muted-foreground font-normal">
                Attendees
              </Label>
              <Input
                id="source-attendees"
                value={draft.attendees}
                onChange={(event) => setDraft({ ...draft, attendees: event.target.value })}
                placeholder="PPCBank team, Chan Youvita"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-notes" className="text-muted-foreground font-normal">
                What was said
              </Label>
              <Textarea
                id="source-notes"
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="They want the approval queue filtered to the signed-in approver."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
            <Button size="sm" className="text-xs" onClick={addSource}>
              Log it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Delete source</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="text-foreground font-medium">{pendingDelete?.title}</span> and its
            notes will be removed. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={removeSource}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
