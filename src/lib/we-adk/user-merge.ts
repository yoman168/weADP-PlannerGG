/**
 * Merging a team member's finished designs back into a round.
 *
 * The User tab gives each member their own copy of the round to work in, so two
 * people can redraw the same screen without treading on each other. Nothing
 * they do there is visible in Main until it is merged: this module is that
 * step — pick the designs that are done, and publish them into the round.
 *
 * A merge is by screen *name*, because that is what the round is organised by:
 * a design the member added is new to the round, and one the round already has
 * is a revision of it. The round keeps its own file id in the second case, so
 * links, tasks and the html export all keep pointing at the same thing; only
 * the canvas behind it is replaced.
 *
 * Browser-only — every side of this lives in localStorage.
 */
import { loadScreenBlocks, screenStorageKey, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';
import { addCopiedScreen, type SeedPattern, type SketchScreen } from '@/lib/we-adk-mock/sketches';
import {
  isVersionLocked,
  loadVersionStatuses,
  versionFolderId,
  versionFolderKey,
  versionScreens,
} from '@/lib/we-adk-mock/versions';
import { designFileFromScreen } from '@/lib/we-adk-mock/projects';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { changesAgainst, type ChangedPart } from '@/lib/we-adk/version-diff';
import {
  isPrototypeFile,
  memberScopedId,
  prototypeConfigKeyForScreen,
} from '@/lib/we-adk/prototype';

/** One of the member's designs, and what merging it would do to the round. */
export interface MergeCandidate {
  screen: SketchScreen;
  /**
   * - `new` — the round has no design by this name; merging adds it.
   * - `revision` — the round has one and the member's differs; merging replaces
   *   that file's canvas and layout, leaving its id, links and tasks alone.
   * - `unchanged` — the round already holds this exact design. There is nothing
   *   to carry, so it is listed greyed out rather than hidden: seeing that a
   *   file is already in is as useful as seeing that it is not.
   */
  kind: 'new' | 'revision' | 'unchanged';
  /** The round's existing design of the same name, when there is one. */
  existingId?: string;
  /** For `revision`: which half of the design the member changed. */
  parts?: ChangedPart[];
}

/** The ones a merge would actually change. */
export function mergeable(candidates: MergeCandidate[]): MergeCandidate[] {
  return candidates.filter((entry) => entry.kind !== 'unchanged');
}

/** What a merge did, for the message afterwards. */
export interface MergeResult {
  added: number;
  revised: number;
}

/** Why a merge cannot run, or null when it can. */
export type MergeBlocker = 'locked' | 'empty' | null;

/** The member's canvas for a screen — the blocks the merge actually carries. */
function blocksOf(screen: SketchScreen): CanvasBlock[] {
  return loadScreenBlocks(screen.id, screen.seedPattern, () =>
    isPrototypeFile(screen.id) ? prototypeDesignBlocks(screen.id) : null,
  );
}

/**
 * Layout edits follow the canvas.
 *
 * For an html screen the design mostly *is* the section config — what Edit UI
 * changes — so a merge that moved only the blocks would leave the member's real
 * work behind. Nothing to copy is a valid answer: the target then keeps what it
 * had, or falls back to the screen's default layout.
 */
function copyScreenConfig(fromScreenId: string, toScreenId: string): void {
  const from = prototypeConfigKeyForScreen(fromScreenId);
  const to = prototypeConfigKeyForScreen(toScreenId);
  if (!from || !to || from === to) return;
  try {
    const raw = window.localStorage.getItem(from);
    if (raw) window.localStorage.setItem(to, raw);
    else window.localStorage.removeItem(to);
  } catch {
    // Storage unavailable — the target keeps the layout it had.
  }
}

/**
 * A member's own copy of one of the round's designs.
 *
 * Their workspace has to be genuinely theirs: its own file id, its own canvas
 * and its own layout edits. Handing over the round's screens by reference — as
 * this used to — meant every edit landed straight in Main and a merge had
 * nothing left to do.
 */
export function forkScreenForMember(screen: SketchScreen, memberId: string): SketchScreen {
  const id = memberScopedId(screen.id, memberId);
  const blocks = blocksOf(screen);
  try {
    window.localStorage.setItem(screenStorageKey(id), JSON.stringify(blocks));
  } catch {
    // Canvas won't persist; the copy still opens on the screen's own design.
  }
  copyScreenConfig(screen.id, id);
  return { ...screen, id };
}

/**
 * What merging this member into that round would do, design by design.
 * Ordered the way the member's tree is, so the dialog reads like the tree.
 */
export function mergeCandidates(
  projectId: string,
  version: number,
  memberScreens: SketchScreen[],
): MergeCandidate[] {
  // The whole round, folders included. A file the member forked out of one of
  // Main's folders belongs to the round, so it reads as a revision of that file
  // — and a revision writes onto the round's own screen id, which is where the
  // canvas lives whichever folder holds the row. Comparing against the root
  // alone would call it new and add a second copy beside the folder's.
  const roundScreens = versionScreens(projectId, version);
  const byName = new Map(roundScreens.map((screen) => [screen.name, screen] as const));

  // Compared on content, the way the explorer's A· / M· marks are — not on ids.
  // A fork has a different id from the round's file whether or not the member
  // changed anything, so ids would offer the whole workspace as a revision and
  // a merge would look like work when it is a no-op.
  const target = { id: versionFolderId(version), label: `version ${version}` };
  const diffs = changesAgainst(
    memberScreens.map((screen) => designFileFromScreen(screen, target)),
    roundScreens.map((screen) => designFileFromScreen(screen, target)),
  );

  return memberScreens.map((screen) => {
    const existing = byName.get(screen.name);
    if (!existing) return { screen, kind: 'new' as const };
    const diff = diffs[screen.id];
    if (!diff || diff.change === 'unchanged') {
      return { screen, kind: 'unchanged' as const, existingId: existing.id };
    }
    return {
      screen,
      kind: 'revision' as const,
      existingId: existing.id,
      parts: diff.parts,
    };
  });
}

/** Whether the round will accept a merge at all. */
export function mergeBlocker(
  projectId: string,
  version: number,
  selected: MergeCandidate[],
): MergeBlocker {
  if (isVersionLocked(version, loadVersionStatuses(projectId))) return 'locked';
  if (selected.length === 0) return 'empty';
  return null;
}

/**
 * Publishes the chosen designs into the round.
 *
 * Returns null when the round will not take them — a released round is the
 * record of what shipped and cannot be merged into, whichever door the merge
 * arrives by.
 */
export function mergeIntoVersion(
  projectId: string,
  version: number,
  selected: MergeCandidate[],
  today: string,
): MergeResult | null {
  if (mergeBlocker(projectId, version, selected) !== null) return null;

  const key = versionFolderKey(projectId, version);
  let added = 0;
  let revised = 0;

  for (const candidate of selected) {
    const blocks = blocksOf(candidate.screen);

    if (candidate.kind === 'revision' && candidate.existingId) {
      // The round keeps its file; the member's canvas replaces what is behind
      // it. Writing the round's own id would be a no-op, which is exactly right
      // for a design the member never touched.
      try {
        window.localStorage.setItem(screenStorageKey(candidate.existingId), JSON.stringify(blocks));
      } catch {
        // Storage unavailable — the round keeps the canvas it had.
      }
      // For an html screen this is the part that carries the actual work.
      copyScreenConfig(candidate.screen.id, candidate.existingId);
      revised += 1;
      continue;
    }

    addCopiedScreen(
      key,
      {
        name: candidate.screen.name,
        route: candidate.screen.route,
        seedPattern: candidate.screen.seedPattern as SeedPattern,
        blocks,
        status: { label: 'Merged', tone: 'blue' },
      },
      today,
    );
    added += 1;
  }

  return { added, revised };
}
