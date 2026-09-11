/**
 * Design-file level of Sketcher: the screen types every design file shares, and
 * the browser persistence for files the user creates inside a project folder.
 *
 *   Project (projects.ts) → folder → design file → canvas
 *
 * A folder is either a customer meeting (concept designs) or the project's real
 * screens captured from the live product. Files the user creates — generated
 * from meeting notes, copied from a real screen, or started blank — are stored
 * in workspace state against the folder they were created in, so they survive a
 * reload without pretending there is a backend.
 */
import { type Chip } from './types';
import {
  createBlock,
  screenStorageKey,
  type BlockKind,
  type BlockProps,
  type CanvasBlock,
} from './sketcher';
import { workspaceStore } from '@/lib/api/workspace-store';

export type SeedPattern = 'listPage' | 'detailPage' | 'dashboard';

export interface SketchScreen {
  id: string;
  name: string;
  route?: string;
  seedPattern: SeedPattern;
  status: Chip;
  updatedAt: string;
  /** Set when this screen is an alternative of another — shown as a variant on the board. */
  variantOf?: string;
  /** True for user-added screens (generated, copied or blank) — these can be deleted. */
  generated?: boolean;
  /** How this screen got here. */
  origin?: 'generated' | 'copied' | 'blank';
  /** For copies and revisions of live screens: the real route it started from. */
  basedOnRoute?: string;
}

/** What kind of conversation filled a meeting folder. */
export type SessionKind =
  | 'Kickoff'
  | 'Workshop'
  | 'Review'
  | 'Follow-up'
  | 'Change request'
  | 'Interviews'
  | 'UAT'
  | 'Close-out'
  | 'Wireframe';

export interface SketchSession {
  id: string;
  title: string;
  metAt: string;
  attendees: string;
  /** The 회의록 — what Claude reads to propose screens. */
  notes: string;
  screens: SketchScreen[];
  kind?: SessionKind;
  /** Minutes in the room — planners use it to judge how firm the notes are. */
  durationMin?: number;
  /** Settled in this meeting; safe to design against. */
  decisions?: string[];
  /** Raised and left open; a design here is a guess until they answer. */
  openQuestions?: string[];
}

/* ------------------------------------------------------------------ */
/* Files the user creates inside a folder (browser-only persistence)   */
/* ------------------------------------------------------------------ */

const GENERATED_KEY = 'we-adk:sketcher:generated';

function generatedStoreKey(sessionId: string): string {
  return `${GENERATED_KEY}:${sessionId}`;
}

function isSketchScreenArray(value: unknown): value is SketchScreen[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string',
    )
  );
}

export function loadGeneratedScreens(sessionId: string): SketchScreen[] {
  try {
    const raw = workspaceStore.getItem(generatedStoreKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isSketchScreenArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Writes a folder's generated list.
 *
 * Exported for the User tab, which has to re-key a newly created screen: a member's
 * files carry `~memberId`, and `initUserScreens` re-forks anything in their list
 * that does not — which would rewrite the id of a file they had just made and
 * orphan its canvas.
 */
export function saveGeneratedScreens(sessionId: string, screens: SketchScreen[]): void {
  try {
    workspaceStore.setItem(generatedStoreKey(sessionId), JSON.stringify(screens));
  } catch {
    // Storage unavailable — the screens simply won't persist.
  }
}

export function renameGeneratedScreen(sessionId: string, screenId: string, newName: string): SketchScreen[] {
  const screens = loadGeneratedScreens(sessionId);
  const updated = screens.map((s) =>
    s.id === screenId ? { ...s, name: newName } : s,
  );
  saveGeneratedScreens(sessionId, updated);
  return updated;
}

export function removeGeneratedScreen(sessionId: string, screenId: string): SketchScreen[] {
  const next = loadGeneratedScreens(sessionId).filter((entry) => entry.id !== screenId);
  saveGeneratedScreens(sessionId, next);
  try {
    workspaceStore.removeItem(screenStorageKey(screenId));
  } catch {
    // ignore
  }
  return next;
}

/**
 * Moves a screen from one folder to another — out of a staging area and into a
 * version, say.
 *
 * Only the metadata row changes hands. The canvas is keyed by screen id alone,
 * so the design itself never moves, which is also why this cannot go through
 * `removeGeneratedScreen`: that one deletes the blocks.
 */
export function moveGeneratedScreen(
  fromSessionId: string,
  toSessionId: string,
  screenId: string,
  updatedAt?: string,
): SketchScreen | null {
  const source = loadGeneratedScreens(fromSessionId);
  const screen = source.find((entry) => entry.id === screenId);
  if (!screen) return null;

  const moved: SketchScreen = { ...screen, ...(updatedAt ? { updatedAt } : {}) };
  saveGeneratedScreens(
    fromSessionId,
    source.filter((entry) => entry.id !== screenId),
  );
  // Re-adding an id that is already there would double it up in the tree.
  const target = loadGeneratedScreens(toSessionId).filter((entry) => entry.id !== screenId);
  saveGeneratedScreens(toSessionId, [...target, moved]);
  return moved;
}

/**
 * Moves a screen within its own folder.
 *
 * Dropping a file *onto* a folder moved it between folders; there was no way to
 * drop one *between* two files and change the order inside a folder — which is the
 * arrangement a reader actually sees. `toIndex` is the slot in the list as it looks
 * before the move, so removing the screen first would shift the target from under
 * the caller: the splice happens after the removal is accounted for.
 */
export function reorderGeneratedScreen(
  sessionId: string,
  screenId: string,
  toIndex: number,
): SketchScreen[] {
  const list = loadGeneratedScreens(sessionId);
  const from = list.findIndex((entry) => entry.id === screenId);
  if (from < 0) return list;

  const next = [...list];
  const [screen] = next.splice(from, 1);
  if (!screen) return list;
  const target = Math.max(0, Math.min(next.length, from < toIndex ? toIndex - 1 : toIndex));
  next.splice(target, 0, screen);
  saveGeneratedScreens(sessionId, next);
  return next;
}

/**
 * Adds a copy of an html prototype screen under an id the caller chooses — that
 * id is what keeps the copy the same screen (see `versionedPrototypeId`). The
 * blocks are written so its canvas opens on the design, not a seed layout.
 */
export function addPrototypeCopy(
  sessionId: string,
  input: { id: string; name: string; route?: string; blocks: CanvasBlock[]; status?: Chip },
  today: string,
): SketchScreen {
  const cloned: CanvasBlock[] = input.blocks.map((block) => ({
    ...block,
    id: `${input.id}-${block.kind}-${Math.random().toString(36).slice(2, 7)}`,
    props: structuredClone(block.props),
  }));
  try {
    workspaceStore.setItem(screenStorageKey(input.id), JSON.stringify(cloned));
  } catch {
    // Canvas won't persist; the copy still opens on the screen's own design.
  }

  const screen: SketchScreen = {
    id: input.id,
    name: input.name,
    route: input.route,
    seedPattern: 'listPage',
    status: input.status ?? { label: 'Carried over', tone: 'slate' },
    updatedAt: today,
    generated: true,
    origin: 'copied',
  };
  const existing = loadGeneratedScreens(sessionId).filter((entry) => entry.id !== screen.id);
  saveGeneratedScreens(sessionId, [...existing, screen]);
  return screen;
}

export interface GeneratedScreenInput {
  name: string;
  route?: string;
  blocks: { kind: BlockKind; props?: BlockProps }[];
}

let generatedCounter = 0;

/**
 * Turns Claude's proposed screens into real canvases: each gets an id, its
 * blocks are written to that screen's canvas storage, and its metadata is
 * appended to the folder's file list.
 */
export function materialiseGeneratedScreens(
  sessionId: string,
  proposals: GeneratedScreenInput[],
  today: string,
): SketchScreen[] {
  const created: SketchScreen[] = [];

  for (const proposal of proposals) {
    generatedCounter += 1;
    const id = `sk-gen-${generatedCounter}-${Math.random().toString(36).slice(2, 7)}`;
    const blocks: CanvasBlock[] = proposal.blocks.map((entry) =>
      createBlock(entry.kind, entry.props),
    );
    try {
      workspaceStore.setItem(screenStorageKey(id), JSON.stringify(blocks));
    } catch {
      // Canvas won't persist, but the screen still opens on its seed layout.
    }
    created.push({
      id,
      name: proposal.name,
      route: proposal.route,
      seedPattern: 'listPage',
      status: { label: 'Generated', tone: 'violet' },
      updatedAt: today,
      generated: true,
      origin: 'generated',
    });
  }

  saveGeneratedScreens(sessionId, [...loadGeneratedScreens(sessionId), ...created]);
  return created;
}

/* ------------------------------------------------------------------ */
/* Copying a real screen into a concept folder                         */
/* ------------------------------------------------------------------ */

export interface CopyScreenInput {
  name: string;
  route?: string;
  seedPattern: SeedPattern;
  /** The source screen's current blocks — copied so the two can diverge. */
  blocks: CanvasBlock[];
  basedOnRoute?: string;
  /** Overrides the chip; a copy is not always "from production". */
  status?: Chip;
}

/**
 * Clones a real screen's canvas under a new id inside the chosen folder, so
 * editing the copy never touches the live screen it came from.
 */
export function addCopiedScreen(
  sessionId: string,
  input: CopyScreenInput,
  today: string,
): SketchScreen {
  generatedCounter += 1;
  const id = `sk-copy-${generatedCounter}-${Math.random().toString(36).slice(2, 7)}`;

  // Fresh block ids so the copy is fully independent of the source canvas.
  const cloned: CanvasBlock[] = input.blocks.map((block) => ({
    ...block,
    id: `${id}-${block.kind}-${Math.random().toString(36).slice(2, 7)}`,
    props: structuredClone(block.props),
  }));

  try {
    workspaceStore.setItem(screenStorageKey(id), JSON.stringify(cloned));
  } catch {
    // Canvas won't persist; the copy still opens on its seed layout.
  }

  const screen: SketchScreen = {
    id,
    name: input.name,
    route: input.route,
    seedPattern: input.seedPattern,
    status: input.status ?? { label: 'From production', tone: 'blue' },
    updatedAt: today,
    generated: true,
    origin: 'copied',
    basedOnRoute: input.basedOnRoute,
  };

  saveGeneratedScreens(sessionId, [...loadGeneratedScreens(sessionId), screen]);
  return screen;
}

/* ------------------------------------------------------------------ */
/* Starting a design file from a blank layout                           */
/* ------------------------------------------------------------------ */

export interface BlankDesignInput {
  name: string;
  route?: string;
  seedPattern: SeedPattern;
}

/**
 * Adds an empty design file to a folder. No blocks are written, so the canvas
 * opens on the chosen seed layout the first time it is edited.
 */
export function addBlankDesign(
  sessionId: string,
  input: BlankDesignInput,
  today: string,
): SketchScreen {
  generatedCounter += 1;
  const screen: SketchScreen = {
    id: `sk-new-${generatedCounter}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    route: input.route,
    seedPattern: input.seedPattern,
    status: { label: 'New', tone: 'slate' },
    updatedAt: today,
    generated: true,
    origin: 'blank',
  };

  saveGeneratedScreens(sessionId, [...loadGeneratedScreens(sessionId), screen]);
  return screen;
}
