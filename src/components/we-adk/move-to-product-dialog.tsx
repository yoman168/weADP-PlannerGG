'use client';

/**
 * Moving a Customer project's screens into a Product project.
 *
 * A Customer project is one conversation and produces screens fast; a Product
 * project is where a screen becomes real work in a round. The two were
 * separate with nothing between them, so a mockup the customer had already
 * approved had to be rebuilt on the Product side by hand.
 *
 * Every generated screen in the Customer project is listed, and you tick the
 * ones that go. A project's screens describe one product between them — a
 * login, the list it opens onto, the popup that list opens — so seeing the
 * whole list is what makes it possible to say which of them belong together
 * in this move. Opening the dialog from one screen simply starts with that
 * one ticked; the rest are still there to add.
 *
 * Each row carries where the screen sits, so a set arrives as the tree it
 * already was rather than as a pile. The answers are handed back to the caller
 * to keep, so moving these screens again opens on what was said last time.
 *
 * The copies land in the target project's Request tab, not in a round. Which
 * round a screen belongs in is a decision for whoever owns that project, and
 * dropping screens straight into their open round would be making it for
 * them. Request is the waiting room that exists for exactly this, so every
 * Product project is a valid destination and none of them needs a round first.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  Loader2,
  Maximize2,
  Minimize2,
  PackageOpen,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@/components/ui';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import { PROJECTS, type DesignProject } from '@/lib/we-adk-mock/projects';
import { createProject, loadCreatedProjects } from '@/lib/we-adk-mock/created-projects';
import { startWithNoRounds } from '@/lib/we-adk-mock/versions';
import { saveHtmlAndBlocks } from '@/lib/we-adk/html-to-blocks';
import { loadScreenBlocks, screenStorageKey } from '@/lib/we-adk-mock/sketcher';
import {
  addStandaloneDraft,
  loadStandaloneDrafts,
  removeStandaloneDraft,
  type DraftPlacement,
} from '@/lib/we-adk/task-design';
import { inertPreviewHtml } from '@/lib/we-adk/mockup-pages';
import { loadRoundFolders } from '@/lib/we-adk/round-screens';
import type { MeetingIA } from '@/lib/we-adk-mock/mockup-tasks';
import {
  IA_DEPTH_FIELDS,
  IA_PLATFORMS,
  IA_SCREEN_TYPES,
  loadIARows,
  type IAPlatform,
  type IARow,
  type IAScreenType,
} from '@/lib/we-adk-mock/ia';
import { workspaceStore } from '@/lib/api/workspace-store';

/** "Untitled project", then "Untitled project 2", and so on. */
function untitledName(taken: string[]): string {
  const base = 'Untitled project';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** One customer-side page, as the dialog needs to see it. */
export interface MovingScreen {
  /** The customer-side id — its page and canvas are stored under this. */
  id: string;
  name: string;
  /** The generated page. A screen without one has nothing to move yet. */
  html: string | undefined;
  /** Where it sits in the customer project's own tree. */
  ia: MeetingIA;
  /**
   * The meeting it was generated from. Several pages usually come out of one
   * conversation, and their names alone do not say which — "Cart" and
   * "Checkout" could be from either of two meetings a week apart.
   */
  group?: string;
}

/** A project the screens can be sent to. */
interface Target {
  project: DesignProject;
  /** How many drafts are already waiting there. */
  waiting: number;
}

/**
 * One row's answer on the IA step.
 *
 * `parent` is `''` for top level, `m:<id>` for another screen in the set, or
 * `r:<rowId>` for a screen already in the target project's IA. Encoded in one
 * string because one <select> offers all three.
 */
interface RowPlacement {
  parent: string;
  screenType: IAScreenType;
  platform: IAPlatform;
}

/** The depth path of a row, trailing blanks dropped. */
function pathOf(row: IARow): string[] {
  const all = IA_DEPTH_FIELDS.map((field) => (row[field] ?? '').trim());
  let end = all.length;
  while (end > 0 && !all[end - 1]) end -= 1;
  return all.slice(0, end);
}

export function MoveToProductDialog({
  open,
  screens,
  sourceProjectName,
  preferredProductId,
  onClose,
  onPlacements,
  onMoved,
}: {
  open: boolean;
  /**
   * The screens this move is about — the whole Customer project, or one
   * meeting's worth. A meeting that has generated nothing is passed too, as an
   * entry with no page, so the sheet can say so rather than hiding it.
   */
  screens: MovingScreen[];
  /** The Customer project they come from, named on each draft. */
  sourceProjectName: string;
  /**
   * The product these screens were generated into, if one was chosen.
   *
   * The answer to "which product?" was given during the build, and asking it
   * again — with the right answer sitting in a list of four — is how a set ends
   * up split across two projects.
   */
  preferredProductId?: string;
  onClose: () => void;
  /**
   * The IA answers, by customer-side screen id, as the move is made — so the
   * next move can open on them instead of asking the same questions again.
   */
  onPlacements?: (byScreenId: Record<string, MeetingIA>) => void;
  onMoved: (projectName: string, roundName: string, count: number, projectId: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  /** Which half of the choice is open: null while the question is showing. */
  const [mode, setMode] = useState<'new' | 'existing' | null>(null);
  const [newName, setNewName] = useState('');
  /**
   * Choosing an existing project opens two more steps: where each screen sits
   * in that project's IA, then a look at the screens before they are filed.
   */
  const [target, setTarget] = useState<Target | null>(null);
  const [step, setStep] = useState<'ia' | 'review'>('ia');
  const [iaRows, setIaRows] = useState<IARow[]>([]);
  const [placements, setPlacements] = useState<Record<string, RowPlacement>>({});
  /** Which of the generated screens are going. */
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** The list out of the way, so the screen gets the whole window. */
  const [full, setFull] = useState(false);

  /** Screens with a page — the ones that actually move. */
  const movable = useMemo(() => screens.filter((screen) => !!screen.html), [screens]);
  /** Screens still waiting on Generate; named so nobody wonders where they went. */
  const waiting = useMemo(() => screens.filter((screen) => !screen.html), [screens]);
  const movableIds = useMemo(() => new Set(movable.map((screen) => screen.id)), [movable]);

  // The parent maps its meetings into `screens` on every render, so the effect
  // below reads the latest set through a ref and resets on `open` alone —
  // depending on `screens` would wipe the answers each time the parent painted.
  const screensRef = useRef(screens);
  screensRef.current = screens;

  // Always opens on the question, never on whichever half was used last, and
  // every row starts from the placement decided on the customer side.
  useEffect(() => {
    if (!open) return;
    setMode(null);
    setNewName('');
    setTarget(null);
    setStep('ia');
    setIaRows([]);
    const current = screensRef.current;
    const withPage = new Set(current.filter((screen) => !!screen.html).map((screen) => screen.id));
    const next: Record<string, RowPlacement> = {};
    for (const screen of current) {
      const parentId = screen.ia.parentId;
      next[screen.id] = {
        // A parent that is not moving cannot be opened from on the other side.
        parent: parentId && withPage.has(parentId) && parentId !== screen.id ? `m:${parentId}` : '',
        screenType: screen.ia.screenType,
        platform: screen.ia.platform,
      };
    }
    setPlacements(next);
    // Everything that can go, ticked. Untick is one click; ticking eight is not.
    setChosen(new Set(withPage));
    setPreviewId(current.find((screen) => withPage.has(screen.id))?.id ?? null);
    setFull(false);
  }, [open]);

  /** Product projects only — a Customer project has no rounds to land in. */
  const targets = useMemo((): Target[] => {
    if (!open) return [];
    const all = [...PROJECTS, ...loadCreatedProjects()].filter(
      (project) => project.archived !== true,
    );
    return all.map((project) => ({
      project,
      waiting: loadStandaloneDrafts(project.id).length,
    }));
  }, [open]);

  /**
   * Opens on the product this meeting already builds into.
   *
   * Skips both the New/Existing question and the picker, because both were
   * answered when the screens were generated. Everything is still reachable
   * with Back.
   */
  useEffect(() => {
    if (!open || !preferredProductId) return;
    const match = targets.find((entry) => entry.project.id === preferredProductId);
    if (!match) return;
    setMode('existing');
    openTarget(match);
    // Only on opening: re-running would undo a deliberate move to Back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preferredProductId, targets]);

  /** Opens the IA step for a project, loading the rows a parent is picked from. */
  const openTarget = (next: Target) => {
    const rounds = loadRoundFolders(next.project.id);
    const round = rounds[rounds.length - 1];
    const rows =
      round?.versionNumber !== undefined
        ? loadIARows(next.project.id, round.versionNumber, round, next.project.name)
        : [];
    setIaRows(rows);
    // A parent picked from some other project's IA means nothing here.
    setPlacements((current) => {
      const cleaned: Record<string, RowPlacement> = {};
      for (const [id, row] of Object.entries(current)) {
        const keep = !row.parent.startsWith('r:') || rows.some((r) => `r:${r.id}` === row.parent);
        cleaned[id] = keep ? row : { ...row, parent: '' };
      }
      return cleaned;
    });
    setStep('ia');
    setTarget(next);
  };

  const placementOf = (id: string): RowPlacement =>
    placements[id] ?? { parent: '', screenType: 'Screen', platform: 'PC' };

  const patchPlacement = (id: string, patch: Partial<RowPlacement>) =>
    setPlacements((current) => ({ ...current, [id]: { ...placementOf(id), ...patch } }));

  /**
   * Every moving screen under `id` in the opens-from tree, `id` included —
   * the ones a row must not be offered as its parent, or the tree loops.
   */
  const descendantsOf = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const screen of movable) {
        const parent = placementOf(screen.id).parent;
        if (parent.startsWith('m:') && out.has(parent.slice(2)) && !out.has(screen.id)) {
          out.add(screen.id);
          grew = true;
        }
      }
    }
    return out;
  };

  /**
   * The full depth path down to and including the screen, e.g.
   * ['Accountant', 'Approval Queue', 'Approve Confirm']. A parent in the set
   * contributes its own path; a parent in the target's IA contributes the
   * row's; a loop in the answers ends the chain rather than hanging.
   */
  const pathFor = (id: string, seen: Set<string> = new Set()): string[] => {
    const screen = movable.find((entry) => entry.id === id);
    if (!screen || seen.has(id)) return [];
    seen.add(id);
    const { parent } = placementOf(id);
    let above: string[] = [];
    if (parent.startsWith('m:')) above = pathFor(parent.slice(2), seen);
    else if (parent.startsWith('r:')) {
      const row = iaRows.find((entry) => entry.id === parent.slice(2));
      above = row ? pathOf(row) : [];
    }
    return [...above, screen.name];
  };

  /** What the draft carries: the row's answer, as the Request tab reads it. */
  const draftPlacementFor = (id: string): DraftPlacement => {
    const { screenType, platform } = placementOf(id);
    const parentPath = pathFor(id).slice(0, -1);
    return {
      parentPath,
      parentName: parentPath[parentPath.length - 1] ?? 'Top level',
      screenType,
      platform,
    };
  };

  /** "Top level › Approval Queue" — the line under a screen's name. */
  const whereLine = (id: string): string => {
    const path = pathFor(id).slice(0, -1);
    return path.length > 0 ? path.join(' › ') : 'Top level';
  };

  /**
   * The answers in the shape the customer project keeps them.
   *
   * A parent picked from the target project's own IA has no meaning back on
   * the customer side — there is no such screen there — so it is remembered as
   * top level, and the row is answered again next time.
   */
  const agreedIA = (): Record<string, MeetingIA> => {
    const out: Record<string, MeetingIA> = {};
    for (const screen of movable) {
      const { parent, screenType, platform } = placementOf(screen.id);
      out[screen.id] = {
        parentId: parent.startsWith('m:') ? parent.slice(2) : null,
        screenType,
        platform,
      };
    }
    return out;
  };

  /** Writes every moving screen and files each as a draft on `targetId`. */
  const fileDrafts = (targetId: string, targetName: string) => {
    const stamp = Date.now().toString(36);
    const createdAt = new Date().toISOString();
    going.forEach((screen, index) => {
      // Its own screen id, so the copy is independent of the customer's.
      const screenId = `cust-${stamp}-${index.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      saveHtmlAndBlocks(screenId, screen.html!);
      /*
       * `saveHtmlAndBlocks` leaves behind whatever `htmlToBlocks` could recover
       * from the page, which is close to nothing. The customer's own canvas is
       * the screen, so it is copied over that — the copy is then editable on
       * the Product side in exactly the way the original was.
       */
      const sourceBlocks = loadScreenBlocks(screen.id, '');
      if (sourceBlocks.length > 0) {
        try {
          workspaceStore.setItem(screenStorageKey(screenId), JSON.stringify(sourceBlocks));
        } catch { /* storage full — the copy keeps the parsed blocks */ }
      }
      /*
       * One row per screen, not one per move.
       *
       * A screen regenerated and moved again is the same screen — the second
       * copy is the current one and the first is stale, so the waiting request
       * is replaced rather than joined by a twin nobody can tell apart. Matched
       * on name and source, which is what a person would match on.
       */
      const fromLabel = `From ${sourceProjectName}`;
      const already = loadStandaloneDrafts(targetId).find(
        (draft) =>
          draft.version === undefined &&
          draft.fromLabel === fromLabel &&
          draft.name.trim().toLowerCase() === screen.name.trim().toLowerCase(),
      );
      if (already) removeStandaloneDraft(targetId, already.screenId);

      addStandaloneDraft(targetId, {
        screenId,
        name: screen.name,
        createdAt,
        fromLabel,
        placement: draftPlacementFor(screen.id),
      });
    });
    onPlacements?.(agreedIA());
    onMoved(targetName, 'Request', going.length, targetId);
    onClose();
  };

  /**
   * Creates a Product project and files the screens into its Drafts.
   *
   * It starts with no rounds, the same as one made from the projects list —
   * the screens are waiting in Drafts either way, so nothing needs a round
   * yet. Each keeps the placement decided on the customer side; there is no
   * existing IA to fit into, so there is nothing more to ask.
   */
  const moveToNew = () => {
    if (count === 0 || busy) return;
    setBusy('new');
    try {
      const existing = [...PROJECTS, ...loadCreatedProjects()];
      const project = createProject(
        {
          name: newName.trim() || untitledName(existing.map((entry) => entry.name)),
          customer: sourceProjectName,
          owner: '',
          summary: '',
        },
        new Date().toISOString().slice(0, 10),
        new Set(existing.map((entry) => entry.id)),
      );
      startWithNoRounds(project.id);
      fileDrafts(project.id, project.name);
    } finally {
      setBusy(null);
    }
  };

  /** Files the screens with the placements agreed on the IA step. */
  const move = () => {
    if (count === 0 || busy || !target) return;
    setBusy(target.project.id);
    try {
      fileDrafts(target.project.id, target.project.name);
    } finally {
      setBusy(null);
    }
  };

  const selectClass = 'border-input bg-background h-7 w-full min-w-0 rounded-md border px-1.5 text-xs';

  /**
   * The screen at full size, in its own tab.
   *
   * The panel here is a few hundred pixels of a page designed for a desktop,
   * and deciding whether a screen is ready to move is a decision about the
   * whole of it. Same as the button on the customer's own preview.
   */
  const openInBrowser = (screen: MovingScreen) => {
    if (!screen.html) return;
    const tab = window.open('', '_blank');
    if (!tab) return;
    tab.document.write(screen.html);
    tab.document.close();
  };

  const openButtonClass =
    'text-muted-foreground hover:text-foreground hover:border-border flex shrink-0 items-center justify-center rounded-md border border-transparent p-1 transition-colors';

  /**
   * The IA sheet: one row per moving screen.
   *
   * Both halves of the dialog ask the same question and must ask it the same
   * way — a new project simply has no rows of its own to be offered as
   * parents, which is the only difference between the two.
   */
  /**
   * The project, meeting by meeting.
   *
   * A meeting is a conversation, and the screens it produced sit under it —
   * shown that way because a flat list of screen names says nothing about
   * which conversation asked for them, and because a meeting that has
   * generated nothing is worth seeing rather than only being counted.
   */
  const groups = (() => {
    const out: { name: string; pages: MovingScreen[] }[] = [];
    for (const screen of screens) {
      const key = screen.group ?? screen.name;
      let group = out.find((entry) => entry.name === key);
      if (!group) {
        group = { name: key, pages: [] };
        out.push(group);
      }
      if (screen.html) group.pages.push(screen);
    }
    return out;
  })();

  /** Ticks or clears every screen a meeting produced. */
  const toggleGroup = (pages: MovingScreen[]) => {
    const all = pages.every((page) => chosen.has(page.id));
    setChosen((current) => {
      const next = new Set(current);
      for (const page of pages) {
        if (all) next.delete(page.id);
        else next.add(page.id);
      }
      return next;
    });
  };

  const iaTable = (targetName?: string) => (
    <div className="min-h-0 overflow-auto rounded-lg border">
      <table className="w-full table-fixed border-collapse text-xs">
        <thead className="bg-muted/40 text-muted-foreground sticky top-0 text-[10px] font-semibold tracking-wider uppercase">
          <tr>
            <th className="w-9 px-2 py-2 text-left font-semibold">
              <input
                type="checkbox"
                checked={allChosen}
                onChange={toggleAll}
                aria-label={allChosen ? 'Clear all' : 'Select all screens'}
                className="size-3.5 align-middle accent-current"
              />
            </th>
            <th className="w-[30%] px-3 py-2 text-left font-semibold">Screen</th>
            <th className="px-2 py-2 text-left font-semibold">Opens from</th>
            <th className="w-[15%] px-2 py-2 text-left font-semibold">Type</th>
            <th className="w-[15%] px-2 py-2 pr-3 text-left font-semibold">Platform</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.name} className="divide-y border-t">
            <tr className="bg-muted/20">
              <td className="px-2 py-1.5 align-middle">
                {group.pages.length > 0 && (
                  <input
                    type="checkbox"
                    checked={group.pages.every((page) => chosen.has(page.id))}
                    onChange={() => toggleGroup(group.pages)}
                    aria-label={`Move every screen from ${group.name}`}
                    className="size-3.5 align-middle accent-current"
                  />
                )}
              </td>
              <td colSpan={4} className="px-3 py-1.5 align-middle">
                <span className="text-muted-foreground flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold" title={group.name}>
                    {group.name}
                  </span>
                  <span className="shrink-0 text-[10px] font-normal">
                    {group.pages.length === 0
                      ? 'nothing generated yet'
                      : `${group.pages.length} screen${group.pages.length === 1 ? '' : 's'}`}
                  </span>
                </span>
              </td>
            </tr>

            {group.pages.map((screen) => {
              const row = placementOf(screen.id);
              const blocked = descendantsOf(screen.id);
              const siblings = movable.filter((entry) => !blocked.has(entry.id));
              const on = chosen.has(screen.id);
              return (
                <tr key={screen.id} className={cn(!on && 'opacity-55')}>
                  <td className="px-2 py-1.5 pl-5 align-middle">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(screen.id)}
                      aria-label={`Move ${screen.name}`}
                      className="size-3.5 align-middle accent-current"
                    />
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium" title={screen.name}>
                          {screen.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-[10px]">
                          ↳ {whereLine(screen.id)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openInBrowser(screen)}
                        title="Open in browser"
                        aria-label={`Open ${screen.name} in browser`}
                        className={openButtonClass}
                      >
                        <ExternalLink className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <select
                      value={row.parent}
                      onChange={(event) => patchPlacement(screen.id, { parent: event.target.value })}
                      aria-label={`${screen.name} opens from`}
                      className={selectClass}
                    >
                      <option value="">Top level — opens from nothing</option>
                      {siblings.length > 0 && (
                        <optgroup label="In this project">
                          {siblings.map((entry) => (
                            <option key={entry.id} value={`m:${entry.id}`}>{entry.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {targetName !== undefined && iaRows.length > 0 && (
                        <optgroup label={`Already in ${targetName}`}>
                          {iaRows.map((entry) => (
                            <option key={entry.id} value={`r:${entry.id}`}>
                              {pathOf(entry).join(' › ') || entry.screenId}
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
                        patchPlacement(screen.id, { screenType: event.target.value as IAScreenType })
                      }
                      aria-label={`${screen.name} type`}
                      className={selectClass}
                    >
                      {IA_SCREEN_TYPES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 pr-3 align-middle">
                    <select
                      value={row.platform}
                      onChange={(event) =>
                        patchPlacement(screen.id, { platform: event.target.value as IAPlatform })
                      }
                      aria-label={`${screen.name} platform`}
                      className={selectClass}
                    >
                      {IA_PLATFORMS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );

  /** The rows that are ticked — what actually moves. */
  const going = movable.filter((screen) => chosen.has(screen.id));
  const count = going.length;
  const countLabel = `${count} screen${count === 1 ? '' : 's'}`;
  /** Set when one screen is going — the copy reads better named. */
  const single = going.length === 1 ? going[0] : undefined;
  const allChosen = movable.length > 0 && count === movable.length;

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setChosen(allChosen ? new Set() : new Set(movable.map((screen) => screen.id)));
  const preview = going.find((screen) => screen.id === previewId) ?? going[0];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className={cn(
          'flex flex-col',
          target && step === 'review'
            ? // The review is a screen being read, not a form being filled —
              // it gets the window, and the list beside it gets out of the way.
              'h-[94vh] w-[97vw] !max-w-[1600px] sm:max-w-[1600px]'
            : // Both halves show the IA sheet, and four columns of it do not
              // fit the width the opening question is asked at.
              target || mode === 'new'
              ? 'max-h-[85vh] w-[92vw] !max-w-[820px] sm:max-w-[820px]'
              : 'max-h-[80vh] sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {mode !== null && (
              <button
                type="button"
                onClick={() => {
                  if (target && step === 'review') return setStep('ia');
                  if (target) return setTarget(null);
                  setMode(null);
                }}
                aria-label="Back"
                className="text-muted-foreground hover:text-foreground -ml-1 rounded p-0.5 transition-colors"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            Move to a Product project
          </DialogTitle>
        </DialogHeader>

        {!(target && step === 'review') && (
          <p className="text-muted-foreground shrink-0 text-[11px]">
            {single ? (
              <>
                A copy of <span className="text-foreground font-medium">{single.name}</span> goes
                to the project&rsquo;s Request tab, where its owner decides which round it belongs
                in. The customer&rsquo;s copy stays where it is.
              </>
            ) : count === 0 ? (
              <>
                Tick the screens of{' '}
                <span className="text-foreground font-medium">{sourceProjectName}</span> to copy
                into the project&rsquo;s Request tab.
              </>
            ) : (
              <>
                Copies of{' '}
                <span className="text-foreground font-medium">{countLabel}</span> from{' '}
                <span className="text-foreground font-medium">{sourceProjectName}</span> go to the
                project&rsquo;s Request tab, where its owner decides which round they belong in. The
                customer&rsquo;s copies stay where they are.
              </>
            )}
            {waiting.length > 0 && (
              <>
                {' '}
                {waiting.length === 1
                  ? `${waiting[0]!.name} has generated nothing yet, so it cannot move.`
                  : `${waiting.length} meetings have generated nothing yet, so they cannot move.`}
              </>
            )}
          </p>
        )}

        {mode === null ? (
          <div className="grid grid-cols-2 items-stretch gap-2">
            <button
              type="button"
              onClick={() => setMode('new')}
              disabled={count === 0}
              className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex h-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-transparent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500">
                <FilePlus2 className="size-4 text-white" />
              </span>
              <span className="flex w-full min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">New Product</span>
                <span className="text-muted-foreground mt-auto text-[11px] leading-snug">
                  Start a Product project for these screens.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('existing')}
              disabled={targets.length === 0 || count === 0}
              className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex h-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-transparent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500">
                <FolderOpen className="size-4 text-white" />
              </span>
              <span className="flex w-full min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">Existing Product</span>
                <span className="text-muted-foreground mt-auto text-[11px] leading-snug">
                  {targets.length === 0
                    ? 'No Product projects yet.'
                    : 'Send them to a project you already have.'}
                </span>
              </span>
            </button>
          </div>
        ) : mode === 'new' ? (
          <div className="flex min-h-0 flex-col gap-2 overflow-auto">
            <label className="text-muted-foreground shrink-0 text-[11px] font-semibold tracking-wider uppercase">
              Project name
            </label>
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') moveToNew();
              }}
              placeholder="Untitled project"
              aria-label="Project name"
              className="h-8 shrink-0 text-xs"
              autoFocus
            />
            <p className="text-muted-foreground shrink-0 text-[11px]">
              {single
                ? 'Opens with no rounds. The screen waits in its Request tab, where you place it below.'
                : 'Opens with no rounds. Tick what goes below — each waits in its Request tab, where you place it.'}
            </p>

            {iaTable()}

            <div className="flex shrink-0 justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
                Back
              </Button>
              <Button size="sm" onClick={moveToNew} disabled={busy !== null || count === 0}>
                {busy === 'new' && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Create and move {countLabel}
              </Button>
            </div>
          </div>
        ) : target ? (
          step === 'ia' ? (
            <div className="flex min-h-0 flex-col gap-3 overflow-auto">
              <div className="flex shrink-0 items-center gap-2.5 rounded-xl border p-3">
                <ProjectTile project={target.project} className="size-8 text-xs" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{target.project.name}</span>
                  <span className="text-muted-foreground truncate text-[11px]">
                    {iaRows.length} screen{iaRows.length === 1 ? '' : 's'} in its IA
                  </span>
                </span>
              </div>

              <p className="text-muted-foreground shrink-0 text-[11px]">
                {single
                  ? `Where does this screen sit in ${target.project.name}'s information architecture?`
                  : `Tick what goes, and say where each sits in ${target.project.name}'s information architecture. A screen can open from another in this project, or from one already there.`}{' '}
                The draft carries the answer, so whoever places it into a round already knows.
              </p>

              {iaTable(target.project.name)}

              <div className="flex shrink-0 justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setStep('review')} disabled={count === 0}>
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex min-h-0 flex-1 gap-3">
                {/* The set, each with where it will sit. Click one to see it.
                    One screen needs no list — it is the thing on screen. */}
                <ul
                  className={cn(
                    'flex w-52 shrink-0 flex-col gap-1 overflow-auto pr-0.5',
                    (single || full) && 'hidden',
                  )}
                >
                  {going.map((screen) => {
                    const row = placementOf(screen.id);
                    const active = preview?.id === screen.id;
                    return (
                      <li
                        key={screen.id}
                        className={cn(
                          'flex items-start gap-1 rounded-lg border pr-1 transition-colors',
                          active ? 'border-primary bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/40',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewId(screen.id)}
                          className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2 text-left"
                        >
                          <span className="truncate text-xs font-medium">{screen.name}</span>
                          {screen.group && (
                            <span className="text-muted-foreground truncate text-[10px]">
                              {screen.group}
                            </span>
                          )}
                          <span className="text-muted-foreground truncate text-[10px]">
                            ↳ {whereLine(screen.id)}
                          </span>
                          <span className="text-muted-foreground truncate text-[10px]">
                            {row.screenType} · {row.platform}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openInBrowser(screen)}
                          title="Open in browser"
                          aria-label={`Open ${screen.name} in browser`}
                          className={cn(openButtonClass, 'mt-2')}
                        >
                          <ExternalLink className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="bg-muted/30 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
                  {preview?.html ? (
                    <>
                      <div className="text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1 text-[11px]">
                        <span className="min-w-0 flex-1 truncate">
                          {whereLine(preview.id)} › {preview.name} ·{' '}
                          {placementOf(preview.id).screenType} · {placementOf(preview.id).platform}
                        </span>
                        {!single && (
                          <button
                            type="button"
                            onClick={() => setFull((current) => !current)}
                            title={full ? 'Show the list' : 'Fill the window'}
                            aria-label={full ? 'Show the list' : 'Fill the window'}
                            className={openButtonClass}
                          >
                            {full ? (
                              <Minimize2 className="size-3.5" />
                            ) : (
                              <Maximize2 className="size-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openInBrowser(preview)}
                          title="Open in browser"
                          aria-label={`Open ${preview.name} in browser`}
                          className={openButtonClass}
                        >
                          <ExternalLink className="size-3.5" />
                        </button>
                      </div>
                      <iframe
                        key={preview.id}
                        title={preview.name}
                        srcDoc={inertPreviewHtml(preview.html)}
                        sandbox=""
                        className="min-h-0 w-full flex-1 border-0 bg-white"
                      />
                    </>
                  ) : (
                    <p className="text-muted-foreground p-6 text-center text-xs">No screen to show.</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep('ia')}>
                  Back
                </Button>
                <Button size="sm" onClick={move} disabled={busy !== null || count === 0}>
                  {busy !== null && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Move {countLabel} to Request
                </Button>
              </div>
            </div>
          )
        ) : (
          <ul className="flex min-h-0 flex-col gap-2 overflow-auto pr-0.5">
            {targets.map((entry) => {
              const disabled = busy !== null || count === 0;
              return (
                <li key={entry.project.id}>
                  <button
                    type="button"
                    onClick={() => openTarget(entry)}
                    disabled={disabled}
                    className={cn(
                      'hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      disabled && 'hover:border-input opacity-55 hover:bg-transparent',
                    )}
                  >
                    <ProjectTile project={entry.project} className="size-8 text-xs" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{entry.project.name}</span>
                        {entry.project.id === preferredProductId && (
                          <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-600 dark:text-violet-400">
                            built into this
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px]">
                        {entry.waiting === 0
                          ? 'Goes to Request'
                          : `Goes to Request · ${entry.waiting} waiting`}
                      </span>
                    </span>
                    {busy === entry.project.id && <Loader2 className="size-4 shrink-0 animate-spin" />}
                    {!busy && <PackageOpen className="text-muted-foreground size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* No Cancel row: the dialog's own close does exactly that, and two
            controls for one action read as two different actions. */}
      </DialogContent>
    </Dialog>
  );
}
