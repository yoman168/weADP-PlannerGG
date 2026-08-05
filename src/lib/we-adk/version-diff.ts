/**
 * What a round changed, file by file.
 *
 * A round opens as a copy of the one before it, so most of its files start out
 * identical. The interesting question in the explorer is which ones someone has
 * actually touched — so each file is marked the way a diff marks it:
 *
 *   A  this round added it; the round before has no design by that name
 *   M  it was carried over and has since been changed
 *      (nothing) carried over and untouched, or the baseline itself
 *
 * The comparison ignores ids. Copying a design regenerates every block id, so
 * comparing raw storage would report every carried-over file as modified; what
 * matters is the shape — the kinds, names, order and props of its blocks, plus
 * the section layout an html screen is edited through.
 *
 * Browser-only: the canvases and layouts it compares live in localStorage.
 */
import { prototypeConfigKeyForScreen } from '@/lib/we-adk/prototype';
import { isPrototypeFile } from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { loadScreenBlocks, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';
import { type DesignFile, type DesignFolder } from '@/lib/we-adk-mock/projects';
import { BASELINE_VERSION } from '@/lib/we-adk-mock/versions';

export type FileChange = 'added' | 'modified' | 'unchanged';

/** Which half of a design differs — a screen has two, and either can change. */
export type ChangedPart = 'canvas' | 'layout';

/**
 * A file's marker, and enough detail to say why it has it.
 *
 * "Why is this one M?" is the obvious next question, and the answer is not
 * guessable from a letter — so the parts that differ travel with it and end up
 * in the row's tooltip.
 */
export interface FileDiff {
  change: FileChange;
  /** Set for `modified` only. */
  parts?: ChangedPart[];
}

/** Every file of a folder, including the ones in folders made inside it. */
function allFiles(folder: DesignFolder): DesignFile[] {
  return [...folder.files, ...(folder.children ?? []).flatMap((child) => child.files)];
}

/**
 * The same data with object keys in a fixed order.
 *
 * Two equal designs can stringify differently — key order is whatever the
 * browser happened to write — so the comparison is done on a canonical form
 * rather than on raw text.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

/**
 * A canvas reduced to what a reader would call the design: block kinds, names,
 * order, visibility and props. Ids are left out on purpose — see the header.
 */
function canvasSignature(file: DesignFile): string {
  const blocks: CanvasBlock[] = loadScreenBlocks(file.id, file.seedPattern, () =>
    isPrototypeFile(file.id) ? prototypeDesignBlocks(file.id) : null,
  );
  return JSON.stringify(
    blocks.map((block) => [block.kind, block.name, block.hidden === true, canonical(block.props)]),
  );
}

/** The section layout of an html screen — what Edit UI changes. */
function configSignature(file: DesignFile): string {
  const key = prototypeConfigKeyForScreen(file.id);
  if (!key) return '';
  try {
    const raw = window.localStorage.getItem(key);
    // No stored layout and an empty one are the same screen.
    if (!raw) return '';
    const parsed: unknown = JSON.parse(raw);
    const text = JSON.stringify(canonical(parsed));
    return text === '{}' ? '' : text;
  } catch {
    return '';
  }
}

/** The two halves of one design, as compared. */
interface FileSignature {
  canvas: string;
  layout: string;
}

function fileSignature(file: DesignFile): FileSignature {
  return { canvas: canvasSignature(file), layout: configSignature(file) };
}

/** Which halves of two designs differ. Empty means they are the same design. */
function changedParts(a: FileSignature, b: FileSignature): ChangedPart[] {
  const parts: ChangedPart[] = [];
  if (a.canvas !== b.canvas) parts.push('canvas');
  if (a.layout !== b.layout) parts.push('layout');
  return parts;
}

/* ------------------------------------------------------------------ */
/* Saving a round                                                      */
/* ------------------------------------------------------------------ */

/**
 * What a round looked like when it was last saved.
 *
 * Save is what makes the markers mean "changed since I last looked at this"
 * rather than "differs from the round before". Until a round has been saved
 * once there is nothing to compare against, so it falls back to the round it
 * was cut from — which is the right answer for a round nobody has touched.
 */
export interface SavedSnapshot {
  at: string;
  files: Record<string, FileSignature>;
}

const SAVED_KEY = 'we-adk:version-saved';

/**
 * Where a save lives.
 *
 * `scope` names whose save it is. Main's rounds have none, which keeps their key
 * exactly as it was; a member's workspace passes their id, so saving their own
 * copies cannot clear the markers on the round in Main — the two are different
 * questions about different files.
 */
function savedStorageKey(projectId: string, version: number, scope?: string): string {
  return `${SAVED_KEY}:${projectId}:${version}${scope ? `:${scope}` : ''}`;
}

export function loadSavedSnapshot(
  projectId: string,
  version: number,
  scope?: string,
): SavedSnapshot | null {
  try {
    const raw = window.localStorage.getItem(savedStorageKey(projectId, version, scope));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const files = (parsed as { files?: unknown }).files;
    if (typeof files !== 'object' || files === null) return null;
    return parsed as SavedSnapshot;
  } catch {
    return null;
  }
}

/** Records every file of a round as it stands now, clearing its markers. */
export function writeSavedSnapshot(
  projectId: string,
  version: number,
  files: DesignFile[],
  at: string,
  scope?: string,
): void {
  const snapshot: SavedSnapshot = {
    at,
    files: Object.fromEntries(files.map((file) => [file.id, fileSignature(file)] as const)),
  };
  try {
    window.localStorage.setItem(
      savedStorageKey(projectId, version, scope),
      JSON.stringify(snapshot),
    );
  } catch {
    // Storage unavailable — the markers simply stay as they are.
  }
}

/** Records a single file as it stands now, merging into the existing snapshot. */
export function writeSavedFile(
  projectId: string,
  version: number,
  file: DesignFile,
  at: string,
  scope?: string,
): void {
  const existing = loadSavedSnapshot(projectId, version, scope);
  const snapshot: SavedSnapshot = {
    at,
    files: { ...(existing?.files ?? {}), [file.id]: fileSignature(file) },
  };
  try {
    window.localStorage.setItem(
      savedStorageKey(projectId, version, scope),
      JSON.stringify(snapshot),
    );
  } catch {
    // Storage unavailable — the marker simply stays as it is.
  }
}

/** Forgets a round's save, so the markers go back to comparing against the round before. */
export function clearSavedSnapshot(projectId: string, version: number, scope?: string): void {
  try {
    window.localStorage.removeItem(savedStorageKey(projectId, version, scope));
  } catch {
    // ignore
  }
}

/**
 * Marks one set of files against another, by name.
 *
 * Name is the join because that is what a round is organised by — a copy has a
 * different id from the thing it was copied from, so ids would say "everything
 * is new". Used for a round against the round before it, and for a member's
 * workspace against the round they forked from.
 */
export function changesAgainst(
  files: DesignFile[],
  baseline: DesignFile[],
): Record<string, FileDiff> {
  const before = new Map(baseline.map((file) => [file.name, file] as const));
  const changes: Record<string, FileDiff> = {};

  for (const file of files) {
    const source = before.get(file.name);
    if (!source) {
      changes[file.id] = { change: 'added' };
      continue;
    }
    const parts = changedParts(fileSignature(file), fileSignature(source));
    changes[file.id] = parts.length === 0 ? { change: 'unchanged' } : { change: 'modified', parts };
  }

  return changes;
}

/**
 * Marks files against a save, by id.
 *
 * Ids are the join here, not names: a save records the very files that were on
 * screen, so the same file is the same id. Anything the save has never seen is
 * new — which is what "added since I last saved" means.
 */
export function changesAgainstSnapshot(
  files: DesignFile[],
  saved: SavedSnapshot,
): Record<string, FileDiff> {
  const changes: Record<string, FileDiff> = {};
  for (const file of files) {
    const before = saved.files[file.id];
    if (!before) {
      changes[file.id] = { change: 'added' };
      continue;
    }
    const parts = changedParts(fileSignature(file), before);
    changes[file.id] = parts.length === 0 ? { change: 'unchanged' } : { change: 'modified', parts };
  }
  return changes;
}

/**
 * Marks every file in every round against the round it was cut from.
 *
 * Keyed by file id, so a row can look itself up without knowing where it sits.
 * The baseline is the origin — it changed nothing — so its files are absent,
 * which reads as unchanged.
 */
export function versionChanges(
  projectId: string,
  folders: DesignFolder[],
): Record<string, FileDiff> {
  const rounds = folders
    .filter((folder) => folder.kind === 'version' && folder.versionNumber !== undefined)
    .sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));

  const changes: Record<string, FileDiff> = {};

  for (let index = 0; index < rounds.length; index += 1) {
    const round = rounds[index];
    if (!round || round.versionNumber === undefined) continue;
    if (round.versionNumber === BASELINE_VERSION) continue;

    const saved = loadSavedSnapshot(projectId, round.versionNumber);

    if (saved) {
      // Saved once: the markers are about what has moved since.
      Object.assign(changes, changesAgainstSnapshot(allFiles(round), saved));
      continue;
    }

    // Never saved: compare against the round it was cut from — the previous one
    // that still exists, since a dropped round leaves a gap.
    const previous = rounds[index - 1];
    if (!previous) continue;
    Object.assign(changes, changesAgainst(allFiles(round), allFiles(previous)));
  }

  return changes;
}
