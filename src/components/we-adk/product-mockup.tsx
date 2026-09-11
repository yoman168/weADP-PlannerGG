'use client';

/**
 * Generating a product, rather than a pile of screens.
 *
 * Generate has always produced the screens a meeting describes, one file each,
 * and stopped there. That is the right answer when you want to look at a
 * screen — and the wrong one when the question is whether the thing works,
 * because a product is its screens plus the order you meet them in, and that
 * order is exactly what a folder of files does not carry.
 *
 * So Generate asks first. "Mockup only" is what it always did. "Product
 * mockup" opens one dialog and stays in it: pick the product, watch the
 * screens get built, say where each one sits, walk the result as a product,
 * and send it on. Four questions with one thread through them — closing
 * between steps was how a build ended up half-done, with screens generated
 * against a product nobody remembered choosing.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode2,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  MonitorPlay,
  PackageOpen,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  cn,
} from '@/components/ui';
import {
  IA_DEPTH_FIELDS,
  IA_PLATFORMS,
  IA_SCREEN_TYPES,
  loadIARows,
  type IAPlatform,
  type IARow,
  type IAScreenType,
} from '@/lib/we-adk-mock/ia';
import { inertPreviewHtml, openFlowDocument, readPreviewNav } from '@/lib/we-adk/mockup-pages';
import { loadRoundFolders } from '@/lib/we-adk/round-screens';
import { loadStandaloneDrafts } from '@/lib/we-adk/task-design';
import { PROJECTS, type DesignProject } from '@/lib/we-adk-mock/projects';
import { loadCreatedProjects } from '@/lib/we-adk-mock/created-projects';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import type { MeetingIA, MockupScreen } from '@/lib/we-adk-mock/mockup-tasks';
import type { DraftPlacement } from '@/lib/we-adk/task-design';
import { workspaceStore } from '@/lib/api/workspace-store';

export type GenerateMode = 'mockup' | 'product';

/* ------------------------------------------------------------------ */
/* The product a mockup is being built into                            */
/* ------------------------------------------------------------------ */

/** The page saved for a screen, if one was ever generated or edited. */
function loadDesignHtml(screenId: string): string | null {
  try {
    return workspaceStore.getItem(`we-adk:design-html:${screenId}`);
  } catch {
    return null;
  }
}

/** The depth path of an IA row, trailing blanks dropped. */
function pathOfRow(row: IARow): string[] {
  const all = IA_DEPTH_FIELDS.map((field) => (row[field] ?? '').trim());
  let end = all.length;
  while (end > 0 && !all[end - 1]) end -= 1;
  return all.slice(0, end);
}

/**
 * A Product project's screens, in the shape the walk and the IA step use.
 *
 * The product already exists, and the point of building into it is that the new
 * screens are read next to the ones that are there — a payment popup means
 * something under the till it opens from, and nothing at all beside it. The
 * project's latest round is the product as it stands, and its IA sheet is where
 * that round says what opens from what.
 *
 * A row whose screen has no saved page still comes through: it is part of the
 * tree, and a walk that quietly skipped it would misrepresent the flow.
 */
export function productScreens(projectId: string): MockupScreen[] {
  const rounds = loadRoundFolders(projectId);
  const round = rounds[rounds.length - 1];
  const rows = round?.versionNumber === undefined
    ? []
    : loadIARows(projectId, round.versionNumber, round);

  const keyOf = (path: string[]) => path.join(' › ').toLowerCase();
  const byPath = new Map(rows.map((row) => [keyOf(pathOfRow(row)), row.id]));

  const filed: MockupScreen[] = rows.map((row) => {
    const path = pathOfRow(row);
    const parentId = path.length > 1 ? byPath.get(keyOf(path.slice(0, -1))) ?? null : null;
    const screenId = row.fileId ?? row.id;
    return {
      id: row.id,
      name: path[path.length - 1] ?? row.screenId ?? 'Screen',
      html: loadDesignHtml(screenId) ?? '',
      ia: { parentId, screenType: row.screenType, platform: row.platform },
    };
  });

  /*
   * The requests waiting in it count too.
   *
   * A product's screens are what it has, not what it has filed: a project with
   * seven screens sitting in Request and none in a round is not "no screens in
   * it yet", and building against it as though it were empty produces a second
   * login. The round's IA is the shipped half; Request is the rest.
   */
  const nameKey = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  const known = new Set(filed.map((screen) => nameKey(screen.name)));
  const byName = new Map(filed.map((screen) => [nameKey(screen.name), screen.id]));

  const waiting: MockupScreen[] = [];
  for (const draft of loadStandaloneDrafts(projectId)) {
    if (draft.version !== undefined) continue;
    const key = nameKey(draft.name);
    if (!key || known.has(key)) continue;
    known.add(key);
    waiting.push({
      id: draft.screenId,
      name: draft.name,
      html: loadDesignHtml(draft.screenId) ?? '',
      ia: {
        parentId: draft.placement ? byName.get(nameKey(draft.placement.parentName)) ?? null : null,
        screenType: (draft.placement?.screenType as MockupScreen['ia']['screenType']) ?? 'Screen',
        platform: (draft.placement?.platform as MockupScreen['ia']['platform']) ?? 'PC',
      },
    });
  }

  // A request's parent may be another request, which only exists once both
  // halves are in one list.
  const all = [...filed, ...waiting];
  const byNameAll = new Map(all.map((screen) => [nameKey(screen.name), screen.id]));
  for (const draft of loadStandaloneDrafts(projectId)) {
    if (draft.version !== undefined || !draft.placement) continue;
    const screen = waiting.find((entry) => entry.id === draft.screenId);
    if (!screen || screen.ia.parentId) continue;
    const parentId = byNameAll.get(nameKey(draft.placement.parentName));
    if (parentId && parentId !== screen.id) screen.ia.parentId = parentId;
  }

  return all;
}

/** Product projects a mockup can be built into — a Customer project is not one. */
function productTargets(): DesignProject[] {
  return [...PROJECTS, ...loadCreatedProjects()].filter((project) => project.archived !== true);
}

function ProductStep({ onPick }: { onPick: (project: DesignProject) => void }) {
  const targets = useMemo(() => productTargets(), []);

  return (
    <>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          The screens are built into a product, and read next to the ones already in it — so the
          walk is the whole thing, not just what this meeting added.
        </p>

        {targets.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-xs">
            No Product projects yet.
          </p>
        ) : (
          <ul className="flex min-h-0 flex-col gap-2 overflow-auto pr-0.5">
            {targets.map((project) => {
              const screens = productScreens(project.id).length;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => onPick(project)}
                    className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <ProjectTile project={project} className="size-8 text-xs" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{project.name}</span>
                      <span className="text-muted-foreground truncate text-[11px]">
                        {/* Everything it has: filed into a round, or waiting
                            in Request. Both are screens of this product. */}
                        {screens === 0
                          ? 'No screens in it yet'
                          : `${screens} screen${screens === 1 ? '' : 's'}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

    </>
  );
}

/* ------------------------------------------------------------------ */
/* What to build                                                       */
/* ------------------------------------------------------------------ */

export function GenerateModeDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (mode: GenerateMode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Generate</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-[11px]">
          Both read the same notes and build the same screens. They differ in what happens next.
        </p>

        <div className="grid grid-cols-2 items-stretch gap-2">
          <button
            type="button"
            onClick={() => onPick('mockup')}
            className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex h-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-500">
              <FileCode2 className="size-4 text-white" />
            </span>
            <span className="flex w-full min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">Mockup only</span>
              <span className="text-muted-foreground mt-auto text-[11px] leading-snug">
                The screens, one file each. Stops there.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onPick('product')}
            className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex h-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500">
              <Layers className="size-4 text-white" />
            </span>
            <span className="flex w-full min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">Product mockup</span>
              <span className="text-muted-foreground mt-auto text-[11px] leading-snug">
                Then confirm the IA, and walk the screens as one product.
              </span>
            </span>
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* The tree the screens make                                           */
/* ------------------------------------------------------------------ */

export interface FlowNode {
  screen: MockupScreen;
  depth: number;
  children: FlowNode[];
}

/**
 * The screens as a tree, and a loop is not a tree.
 *
 * A page can name a parent that names it back — the model wrote both lines, or
 * someone chose it here — and walking that pair forever is the one failure a
 * viewer must not have. Anything not reached from the top is put at the top,
 * so a screen is never lost to a cycle it happens to be in.
 */
export function buildFlow(screens: MockupScreen[]): FlowNode[] {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  const seen = new Set<string>();

  const childrenOf = (parentId: string | null, depth: number): FlowNode[] => {
    const nodes: FlowNode[] = [];
    for (const screen of screens) {
      const parent = screen.ia.parentId;
      const resolved = parent && byId.has(parent) ? parent : null;
      if (resolved !== parentId || seen.has(screen.id)) continue;
      seen.add(screen.id);
      nodes.push({ screen, depth, children: childrenOf(screen.id, depth + 1) });
    }
    return nodes;
  };

  const roots = childrenOf(null, 0);
  // Whatever a cycle swallowed, shown rather than hidden.
  for (const screen of screens) {
    if (seen.has(screen.id)) continue;
    seen.add(screen.id);
    roots.push({ screen, depth: 0, children: childrenOf(screen.id, 1) });
  }
  return roots;
}

/**
 * Where a screen sits, in the shape a Request row carries.
 *
 * Walked through `all` rather than the new screens alone: a screen's parent is
 * usually one of the product's own, and a path that stopped at the edge of
 * this meeting's work would name the wrong parent or none at all.
 */
export function placementFor(screen: MockupScreen, all: MockupScreen[]): DraftPlacement {
  const byId = new Map(all.map((entry) => [entry.id, entry]));
  const path: string[] = [];
  const seen = new Set<string>([screen.id]);
  let parentId = screen.ia.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    path.unshift(parent.name);
    parentId = parent.ia.parentId;
  }
  return {
    parentPath: path,
    parentName: path[path.length - 1] ?? 'Top level',
    screenType: screen.ia.screenType,
    platform: screen.ia.platform,
  };
}

/** The tree flattened into the order you meet the screens in. */
export function flowOrder(nodes: FlowNode[]): FlowNode[] {
  return nodes.flatMap((node) => [node, ...flowOrder(node.children)]);
}

/* ------------------------------------------------------------------ */
/* Step 1 — where each screen sits                                     */
/* ------------------------------------------------------------------ */

function IAStep({
  open,
  screens,
  existing = [],
  productName,
  back,
  onConfirm,
}: {
  open: boolean;
  screens: MockupScreen[];
  /**
   * The product's own screens. A new screen usually hangs off one of them —
   * that is what building into a product means — so they are offered as
   * parents beside the ones this meeting produced.
   */
  existing?: MockupScreen[];
  productName?: string;
  /** The step's way back, rendered into this step's own footer. */
  back: ReactNode;
  /** The agreed tree, by screen id. */
  onConfirm: (ia: Record<string, MeetingIA>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, MeetingIA>>({});

  /*
   * Opens on what the generation proposed, and re-seeds when the screens
   * themselves change.
   *
   * Keyed on which screens these are rather than on the array: the parent
   * re-renders constantly and re-seeding each time would undo every edit as it
   * was made. But stepping back to the picker and building again produces a
   * different set under the same open dialog, and those rows have to be the
   * new ones.
   */
  const signature = screens.map((screen) => screen.id).join('|');
  useEffect(() => {
    if (!open) return;
    setDraft(Object.fromEntries(screens.map((screen) => [screen.id, { ...screen.ia }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature]);

  const iaOf = (id: string): MeetingIA =>
    draft[id] ?? { parentId: null, screenType: 'Screen', platform: 'PC' };

  const patch = (id: string, next: Partial<MeetingIA>) =>
    setDraft((current) => ({ ...current, [id]: { ...iaOf(id), ...next } }));

  /** Everything under `id`, so a screen is never offered its own descendant. */
  const blockedFor = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const screen of screens) {
        const parent = iaOf(screen.id).parentId;
        if (parent && out.has(parent) && !out.has(screen.id)) {
          out.add(screen.id);
          grew = true;
        }
      }
    }
    return out;
  };

  /**
   * The path down to a screen, as the answers currently stand.
   *
   * A parent can be one of the product's own screens, which has no row here —
   * its own path comes from the product's tree rather than from the draft.
   */
  const pathOf = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    const screen = screens.find((entry) => entry.id === id);
    if (!screen) {
      const outside = existing.find((entry) => entry.id === id);
      if (!outside) return [];
      const above = outside.ia.parentId ? pathOf(outside.ia.parentId, seen) : [];
      return [...above, outside.name];
    }
    const parent = iaOf(id).parentId;
    return [...(parent ? pathOf(parent, seen) : []), screen.name];
  };

  const selectClass = 'border-input bg-background h-7 w-full min-w-0 rounded-md border px-1.5 text-xs';

  return (
    <>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {screens.length} screen{screens.length === 1 ? '' : 's'} were generated, each with the
          place the notes implied. Correct anything that is wrong — the walkthrough follows this
          tree, and so does everything downstream of it.
          {existing.length > 0 &&
            ` A screen can also open from one of the ${existing.length} already in ${productName ?? 'the product'}.`}
        </p>

        <div className="min-h-0 overflow-auto rounded-lg border">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0 text-[10px] font-semibold tracking-wider uppercase">
              <tr>
                <th className="w-[34%] px-3 py-2 text-left font-semibold">Screen</th>
                <th className="px-2 py-2 text-left font-semibold">Opens from</th>
                <th className="w-[15%] px-2 py-2 text-left font-semibold">Type</th>
                <th className="w-[15%] px-2 py-2 pr-3 text-left font-semibold">Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {screens.map((screen) => {
                const row = iaOf(screen.id);
                const blocked = blockedFor(screen.id);
                const parents = screens.filter((entry) => !blocked.has(entry.id));
                const path = pathOf(screen.id).slice(0, -1);
                return (
                  <tr key={screen.id}>
                    <td className="px-3 py-1.5 align-middle">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium" title={screen.name}>
                            {screen.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-[10px]">
                            ↳ {path.length > 0 ? path.join(' › ') : 'Top level'}
                          </span>
                        </span>
                        {/* Placing a screen you cannot see is guesswork. */}
                        <button
                          type="button"
                          onClick={() => {
                            // The tree being agreed here is what the rail in
                            // that tab reads, so it is drawn from the draft
                            // rather than from where the screens came in.
                            openFlowDocument(
                              [screen, ...screens.filter((entry) => entry.id !== screen.id)].map(
                                (entry) => ({
                                  id: entry.id,
                                  name: entry.name,
                                  html: entry.html,
                                  parentId: iaOf(entry.id).parentId,
                                  screenType: iaOf(entry.id).screenType,
                                }),
                              ),
                              productName ?? screen.name,
                            );
                          }}
                          disabled={!screen.html}
                          title="Open in browser"
                          aria-label={`Open ${screen.name} in browser`}
                          className="text-muted-foreground hover:text-foreground hover:border-border flex shrink-0 items-center justify-center rounded-md border border-transparent p-1 transition-colors disabled:opacity-40"
                        >
                          <ExternalLink className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <select
                        value={row.parentId ?? ''}
                        onChange={(event) => patch(screen.id, { parentId: event.target.value || null })}
                        aria-label={`${screen.name} opens from`}
                        className={selectClass}
                      >
                        <option value="">Top level — opens from nothing</option>
                        {parents.length > 0 && (
                          <optgroup label="Generated here">
                            {parents.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {existing.length > 0 && (
                          <optgroup label={`Already in ${productName ?? 'the product'}`}>
                            {existing.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {pathOf(entry.id).join(' › ') || entry.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <select
                        value={row.screenType}
                        onChange={(event) =>
                          patch(screen.id, { screenType: event.target.value as IAScreenType })
                        }
                        aria-label={`${screen.name} type`}
                        className={selectClass}
                      >
                        {IA_SCREEN_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 pr-3 align-middle">
                      <select
                        value={row.platform}
                        onChange={(event) =>
                          patch(screen.id, { platform: event.target.value as IAPlatform })
                        }
                        aria-label={`${screen.name} platform`}
                        className={selectClass}
                      >
                        {IA_PLATFORMS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          {back}
          <span className="flex-1" />
          <Button size="sm" onClick={() => onConfirm(draft)}>
            <MonitorPlay className="mr-1.5 size-3.5" />
            See the product
          </Button>
        </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — the product, walked                                        */
/* ------------------------------------------------------------------ */

function WalkStep({
  open,
  screens,
  existing = [],
  back,
  onMove,
  moving,
}: {
  open: boolean;
  screens: MockupScreen[];
  /** The product's own screens, walked alongside the new ones. */
  existing?: MockupScreen[];
  /** The step's way back, rendered into this step's own footer. */
  back: ReactNode;
  onMove: () => void;
  moving: boolean;
}) {
  /*
   * One product, not two lists.
   *
   * The new screens were placed against the product's tree, so walking them on
   * their own would show a flow with its middle missing — you would meet a
   * payment popup with nothing that raises it. The product's screens come
   * first so a new child lands under the parent it named.
   */
  const all = useMemo(() => [...existing, ...screens], [existing, screens]);
  const added = useMemo(() => new Set(screens.map((screen) => screen.id)), [screens]);
  const flow = useMemo(() => buildFlow(all), [all]);
  const order = useMemo(() => flowOrder(flow), [flow]);
  const [atId, setAtId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /**
   * The tree out of the way, so the screen gets the whole dialog.
   *
   * A screen built for a desktop, shown in the two-thirds of a dialog left
   * over after the tree, is being judged at half its size — and judging it is
   * the entire point of this step.
   */
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (open) {
      setAtId(order[0]?.screen.id ?? null);
      setCollapsed(new Set());
      setFull(false);
    }
    // Opening is what resets it; the order changing under an open dialog would
    // otherwise throw you back to the first screen mid-walk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const index = Math.max(
    0,
    order.findIndex((node) => node.screen.id === atId),
  );
  const at = order[index];
  const path = useMemo(() => {
    const byId = new Map(all.map((screen) => [screen.id, screen]));
    const names: string[] = [];
    const seen = new Set<string>();
    let current = at?.screen;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      const parent = current.ia.parentId;
      current = parent ? byId.get(parent) : undefined;
    }
    return names;
  }, [at, all]);

  /*
   * A click inside the walked screen, asking for another one.
   *
   * This is the step where the flow is being judged, so a sidebar that does
   * nothing is the worst place for one: it says the product connects and then
   * refuses to show it. The screen posts where it wants to go and the walk
   * moves there, the same as clicking the tree.
   */
  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      const to = readPreviewNav(event.data);
      if (to && all.some((screen) => screen.id === to)) setAtId(to);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, all]);

  /** The screen at its real size, in its own tab. */
  const openInBrowser = () => {
    if (!at?.screen.html) return;
    const tab = window.open('', '_blank');
    if (!tab) return;
    tab.document.write(at.screen.html);
    tab.document.close();
  };

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: FlowNode) => {
    const isOpen = !collapsed.has(node.screen.id);
    const active = at?.screen.id === node.screen.id;
    return (
      <div key={node.screen.id}>
        <div
          className={cn(
            'flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-xs',
            active
              ? 'border-primary bg-muted text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted/50',
          )}
        >
          {node.children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(node.screen.id)}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.screen.name}`}
              className="hover:text-foreground shrink-0"
            >
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => setAtId(node.screen.id)}
            title={node.screen.name}
            className={cn('flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left', active && 'font-medium')}
          >
            <span className="min-w-0 flex-1 truncate">{node.screen.name}</span>
            {added.has(node.screen.id) && (
              <span
                title="Generated from these notes"
                className="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-600 dark:text-violet-400"
              >
                new
              </span>
            )}
            {node.screen.ia.screenType !== 'Screen' && (
              <span className="shrink-0 font-mono text-[10px] text-violet-600 dark:text-violet-400">
                {node.screen.ia.screenType.slice(0, 1)}
              </span>
            )}
          </button>
        </div>
        {isOpen && node.children.length > 0 && (
          <div className="ml-4 border-l">{node.children.map(renderNode)}</div>
        )}
      </div>
    );
  };

  return (
    <>
        <div className="flex min-h-0 flex-1 gap-3">
          {/* The product's shape, and the way through it. */}
          {!full && (
            <div className="flex w-60 shrink-0 flex-col overflow-auto rounded-lg border p-1">
              {flow.map(renderNode)}
            </div>
          )}

          <div className="bg-muted/30 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
            <div className="text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[11px]">
              <span className="min-w-0 flex-1 truncate">
                {path.join(' › ')}
                {at && ` · ${at.screen.ia.screenType} · ${at.screen.ia.platform}`}
              </span>
              <span className="shrink-0 font-mono">
                {order.length === 0 ? 0 : index + 1}/{order.length}
              </span>
              <button
                type="button"
                onClick={() => setFull((current) => !current)}
                title={full ? 'Show the tree' : 'Fill the dialog'}
                aria-label={full ? 'Show the tree' : 'Fill the dialog'}
                className="hover:text-foreground hover:border-border shrink-0 rounded-md border border-transparent p-1 transition-colors"
              >
                {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={openInBrowser}
                disabled={!at?.screen.html}
                title="Open in browser"
                aria-label="Open in browser"
                className="hover:text-foreground hover:border-border shrink-0 rounded-md border border-transparent p-1 transition-colors disabled:opacity-40"
              >
                <ExternalLink className="size-3.5" />
              </button>
            </div>
            {at && at.screen.html ? (
              <iframe
                key={at.screen.id}
                title={at.screen.name}
                srcDoc={inertPreviewHtml(
                  at.screen.html,
                  all.map((screen) => ({ id: screen.id, name: screen.name })),
                  at.screen.id,
                )}
                // Scripts, so the page can say which screen it wants; it has
                // no other reach — the frame stays cross-origin to the app.
                sandbox="allow-scripts"
                className="min-h-0 w-full flex-1 border-0 bg-white"
              />
            ) : at ? (
              <div className="text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <FileCode2 className="size-6 opacity-40" />
                <p className="text-xs">
                  {at.screen.name} has no page saved — it is in the product&rsquo;s IA, and the flow
                  passes through it.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground p-6 text-center text-xs">Nothing generated yet.</p>
            )}
          </div>
        </div>

        {/* The flow, walked in the order the tree puts the screens in. */}
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {back}
          {/* Stepping through screens, not through the build — icon-only and
              grouped, so it cannot be read as the way back out of this step. */}
          <div className="flex items-center overflow-hidden rounded-md border">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-none px-2"
              disabled={index <= 0}
              title="Previous screen"
              aria-label="Previous screen"
              onClick={() => setAtId(order[index - 1]?.screen.id ?? null)}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-none border-l px-2"
              disabled={index >= order.length - 1}
              title="Next screen"
              aria-label="Next screen"
              onClick={() => setAtId(order[index + 1]?.screen.id ?? null)}
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
            {order.length} screen{order.length === 1 ? '' : 's'} in the flow ·{' '}
            {/* Which of them came from where — a flow that is entirely new
                looks the same as one that failed to load the product, and the
                difference matters before anything is sent on. */}
            {existing.length === 0
              ? 'the product has none yet, so this is all of it'
              : `${existing.length} already in the product · ${screens.length} from these notes`}
          </span>
          <Button size="sm" onClick={onMove} disabled={moving || screens.length === 0}>
            {moving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <PackageOpen className="mr-1.5 size-3.5" />
            )}
            Done
          </Button>
        </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The build, start to finish                                          */
/* ------------------------------------------------------------------ */

export type BuildStep = 'product' | 'generating' | 'ia' | 'walk';

const STEP_LABELS: { id: BuildStep; label: string }[] = [
  { id: 'product', label: 'Product' },
  { id: 'generating', label: 'Build' },
  { id: 'ia', label: 'IA' },
  { id: 'walk', label: 'Flow' },
];

/**
 * One dialog for the whole product build.
 *
 * It stays open across every step, including the generation — a dialog that
 * closed to build and reopened to ask the next question lost the thread, and
 * with it the answer to "which product was this for?". The steps are the
 * questions in the order they can be answered: the product first, because the
 * screens are built against what it already has; the IA once there are screens
 * to place; then the flow, which is the only step that can show whether the
 * thing works. It ends by sending the screens on, which is the point of having
 * built them.
 */
export function ProductBuildDialog({
  open,
  step,
  meetingTitle,
  product,
  screens,
  existing = [],
  moving = false,
  onPickProduct,
  onConfirmIA,
  onMoveToRequest,
  onBack,
  onClose,
}: {
  open: boolean;
  step: BuildStep;
  meetingTitle: string;
  product: { id: string; name: string } | null;
  /** The pages this meeting has generated so far. */
  screens: MockupScreen[];
  /** The product's own screens. */
  existing?: MockupScreen[];
  moving?: boolean;
  onPickProduct: (project: DesignProject) => void;
  onConfirmIA: (ia: Record<string, MeetingIA>) => void;
  onMoveToRequest: () => void;
  /** One step back — from the first, back to the Generate question. */
  onBack: () => void;
  onClose: () => void;
}) {
  const wide = step === 'walk';
  const reached = STEP_LABELS.findIndex((entry) => entry.id === step);

  /*
   * The way back, at the bottom with the way forward.
   *
   * It sat next to the title, which is where a dialog's close lives — two
   * controls a few pixels apart, one leaving the step and one leaving the
   * build entirely. Down here it sits opposite the button that goes on, which
   * is what it is the opposite of, and it names where it goes: "Back" beside a
   * screen-by-screen Back would have been the same confusion again.
   */
  const backLabel =
    step === 'product' ? 'Back to Generate' : step === 'walk' ? 'Back to IA' : 'Back to Product';
  const back = (
    <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
      <ArrowLeft className="size-3.5" />
      {backLabel}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          'flex flex-col',
          wide
            ? 'h-[88vh] w-[94vw] !max-w-[1200px] sm:max-w-[1200px]'
            : step === 'ia'
              ? 'max-h-[85vh] w-[92vw] !max-w-[820px] sm:max-w-[820px]'
              : 'max-h-[80vh] sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-violet-500" />
            {product ? product.name : 'Product mockup'}
            <span className="text-muted-foreground truncate text-xs font-normal">
              {meetingTitle}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Where you are, and what is still coming. */}
        <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[11px]">
          {STEP_LABELS.map((entry, index) => (
            <span key={entry.id} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3 opacity-40" />}
              <span
                className={cn(
                  'rounded px-1.5 py-0.5',
                  entry.id === step
                    ? 'bg-foreground text-background font-medium'
                    : index < reached
                      ? 'text-foreground'
                      : 'opacity-60',
                )}
              >
                {index + 1} {entry.label}
              </span>
            </span>
          ))}
        </div>

        {step === 'product' && (
          <>
            <ProductStep onPick={onPickProduct} />
            <div className="flex shrink-0 items-center pt-1">{back}</div>
          </>
        )}

        {step === 'generating' && (
          <div className="flex flex-1 flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-sm font-medium">Building the screens</p>
            <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
              Reading the notes for {meetingTitle}
              {product ? ` against what ${product.name} already has` : ''}. One file per screen —
              this takes a moment.
            </p>
          </div>
        )}
        {step === 'generating' && <div className="flex shrink-0 items-center pt-1">{back}</div>}

        {step === 'ia' && (
          <IAStep
            open={open}
            screens={screens}
            existing={existing}
            productName={product?.name}
            back={back}
            onConfirm={onConfirmIA}
          />
        )}

        {step === 'walk' && (
          <WalkStep
            open={open}
            screens={screens}
            existing={existing}
            back={back}
            onMove={onMoveToRequest}
            moving={moving}
          />
        )}

        {/* No Cancel row: the dialog's own close does exactly that, and two
            controls for one action read as two different actions. What is left
            in each step's footer is the way forward, which is the only thing
            that differs between them. */}
      </DialogContent>
    </Dialog>
  );
}
