/**
 * Versions of the Business phase.
 *
 * The Business explorer is organised by version rather than by meeting:
 *
 *   Project → version → design file → canvas
 *
 * `version 1` is created automatically and is the baseline — every concept
 * design the customer meetings produced, in one place. It is read-only, so the
 * record of what was first agreed stays intact. The first time someone adds a
 * design, `version 2` is created for it, and each round after that gets its own
 * version folder.
 *
 * Files created inside a version live in localStorage under that version's key,
 * exactly the way meeting folders store theirs.
 */
import {
  PROTOTYPE_FILES,
  PROTOTYPE_PROJECT_ID,
  findPrototypeFile,
  isPrototypeFile,
  prototypeConfigKeyForScreen,
  versionedPrototypeId,
  type PrototypeFile,
} from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import {
  PROJECTS,
  designFileFromScreen,
  projectSketchScreens,
  type DesignFile,
  type DesignFolder,
  type DesignProject,
} from './projects';
import { loadScreenBlocks } from './sketcher';
import {
  addCopiedScreen,
  addPrototypeCopy,
  loadGeneratedScreens,
  removeGeneratedScreen,
  type SketchScreen,
} from './sketches';
import { type VersionStatus } from './types';

/** The baseline every project starts with, drawn from the meetings. */
export const BASELINE_VERSION = 1;

/** Lowest version a user can put a new design in — the baseline is read-only. */
export const FIRST_EDITABLE_VERSION = 2;

const COUNT_KEY = 'we-adk:business:versions';

/** Folder id for a version, as it appears in the tree and the `?folder=` query. */
export function versionFolderId(version: number): string {
  return `version-${version}`;
}

/** localStorage key holding the design files created inside a version. */
export function versionFolderKey(projectId: string, version: number): string {
  return `version:${projectId}:${version}`;
}

/** How many versions this project has. Always at least the baseline. */
export function loadVersionCount(projectId: string): number {
  try {
    const raw = window.localStorage.getItem(`${COUNT_KEY}:${projectId}`);
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= BASELINE_VERSION ? parsed : BASELINE_VERSION;
  } catch {
    return BASELINE_VERSION;
  }
}

export function saveVersionCount(projectId: string, count: number): void {
  try {
    window.localStorage.setItem(`${COUNT_KEY}:${projectId}`, String(count));
  } catch {
    // Storage unavailable — the extra version simply won't survive a reload.
  }
}

/* ------------------------------------------------------------------ */
/* Folders inside a version                                            */
/* ------------------------------------------------------------------ */

/**
 * A round can be organised: a folder inside `version 2` for the approval flow,
 * another for settings.
 *
 * A subfolder is nothing but another storage key — the same one the rest of the
 * mock uses for a folder of files — so creating files in it, moving them and
 * deleting them all work through the machinery that already exists. The only
 * new state is the list of subfolders a version has.
 */
export interface VersionSubfolder {
  id: string;
  name: string;
  createdAt: string;
}

const SUBFOLDER_KEY = 'we-adk:business:subfolders';

function subfolderListKey(projectId: string, version: number): string {
  return `${SUBFOLDER_KEY}:${projectId}:${version}`;
}

/** localStorage key holding the files created inside one subfolder. */
export function subfolderStorageKey(
  projectId: string,
  version: number,
  subfolderId: string,
): string {
  return `${versionFolderKey(projectId, version)}/${subfolderId}`;
}

/** Folder id for the tree and the `?folder=` query. */
export function subfolderFolderId(version: number, subfolderId: string): string {
  return `${versionFolderId(version)}--${subfolderId}`;
}

function isSubfolderArray(value: unknown): value is VersionSubfolder[] {
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

export function loadSubfolders(projectId: string, version: number): VersionSubfolder[] {
  try {
    const raw = window.localStorage.getItem(subfolderListKey(projectId, version));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isSubfolderArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSubfolders(
  projectId: string,
  version: number,
  folders: VersionSubfolder[],
): VersionSubfolder[] {
  try {
    window.localStorage.setItem(subfolderListKey(projectId, version), JSON.stringify(folders));
  } catch {
    // Storage unavailable — the folder won't survive a reload.
  }
  return folders;
}

let subfolderCounter = 0;

export function addSubfolder(
  projectId: string,
  version: number,
  name: string,
  today: string,
): VersionSubfolder {
  subfolderCounter += 1;
  const folder: VersionSubfolder = {
    id: `sf-${Date.now().toString(36)}-${subfolderCounter}`,
    name: name.trim().slice(0, 60) || 'new folder',
    createdAt: today,
  };
  saveSubfolders(projectId, version, [...loadSubfolders(projectId, version), folder]);
  return folder;
}

/** Renames a subfolder. */
export function renameSubfolder(
  projectId: string,
  version: number,
  subfolderId: string,
  name: string,
): void {
  const list = loadSubfolders(projectId, version);
  const next = list.map((entry) =>
    entry.id === subfolderId ? { ...entry, name: name.trim() || entry.name } : entry,
  );
  saveSubfolders(projectId, version, next);
}

/** Moves a subfolder to a new position in the list. */
export function reorderSubfolder(
  projectId: string,
  version: number,
  subfolderId: string,
  toIndex: number,
): void {
  const list = loadSubfolders(projectId, version);
  const fromIndex = list.findIndex((entry) => entry.id === subfolderId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  const [item] = list.splice(fromIndex, 1) as [VersionSubfolder];
  list.splice(toIndex, 0, item);
  saveSubfolders(projectId, version, list);
}

/** Drops a subfolder and the design files inside it. */
export function removeSubfolder(
  projectId: string,
  version: number,
  subfolderId: string,
): VersionSubfolder[] {
  const key = subfolderStorageKey(projectId, version, subfolderId);
  for (const screen of loadGeneratedScreens(key)) removeGeneratedScreen(key, screen.id);
  try {
    window.localStorage.removeItem(`we-adk:sketcher:generated:${key}`);
  } catch {
    // ignore — the list is empty either way
  }
  return saveSubfolders(
    projectId,
    version,
    loadSubfolders(projectId, version).filter((entry) => entry.id !== subfolderId),
  );
}

/* ------------------------------------------------------------------ */
/* Released, or still being worked on                                  */
/* ------------------------------------------------------------------ */

/**
 * Which round is out there and which one is open.
 *
 * The baseline is what the product is today — for the prototype project it is
 * literally the html of the live app — so it starts out Released, and every
 * round opened after it starts In progress. That is only a default: a round
 * ships eventually, and marking it Released is how the explorer says so.
 */
const STATUS_KEY = 'we-adk:business:version-status';

export type VersionStatuses = Record<number, VersionStatus>;

export function defaultVersionStatus(version: number): VersionStatus {
  return version === BASELINE_VERSION ? 'Released' : 'In progress';
}

export function resolveVersionStatus(version: number, statuses: VersionStatuses): VersionStatus {
  return statuses[version] ?? defaultVersionStatus(version);
}

function isVersionStatus(value: unknown): value is VersionStatus {
  return value === 'Released' || value === 'In progress';
}

export function loadVersionStatuses(projectId: string): VersionStatuses {
  try {
    const raw = window.localStorage.getItem(`${STATUS_KEY}:${projectId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const next: VersionStatuses = {};
    for (const [version, status] of Object.entries(parsed)) {
      if (Number.isInteger(Number(version)) && isVersionStatus(status)) {
        next[Number(version)] = status;
      }
    }
    return next;
  } catch {
    return {};
  }
}

export function setVersionStatus(
  projectId: string,
  version: number,
  status: VersionStatus,
): VersionStatuses {
  const next = { ...loadVersionStatuses(projectId), [version]: status };
  try {
    window.localStorage.setItem(`${STATUS_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the mark simply won't survive a reload.
  }
  return next;
}

/** The other one of the two, for a control that flips between them. */
export function otherVersionStatus(status: VersionStatus): VersionStatus {
  return status === 'Released' ? 'In progress' : 'Released';
}

/**
 * Whether a round is closed to changes.
 *
 * A released round is the record of what shipped, and the baseline is what the
 * product is today — neither takes a new file, an edit, or a deletion. Every
 * path that writes into a round asks this rather than testing the status itself,
 * so a new door into a round cannot quietly forget the rule. Flipping the status
 * back to In progress is the only sanctioned way to reopen one.
 */
export function isVersionLocked(version: number, statuses: VersionStatuses): boolean {
  return version === BASELINE_VERSION || resolveVersionStatus(version, statuses) === 'Released';
}

/** The same question, for a folder in the tree — a round, or a folder inside one. */
export function isFolderLocked(folder: {
  versionNumber?: number;
  versionStatus?: VersionStatus;
}): boolean {
  if (folder.versionNumber === BASELINE_VERSION) return true;
  return folder.versionStatus === 'Released';
}

/**
 * The round work should land in: the newest editable version still in progress.
 * Null when every version has shipped — the caller then opens the next one.
 */
export function findInProgressVersion(projectId: string): number | null {
  const count = loadVersionCount(projectId);
  const statuses = loadVersionStatuses(projectId);
  const removed = loadRemovedVersions(projectId);
  for (let version = count; version >= FIRST_EDITABLE_VERSION; version -= 1) {
    if (removed.includes(version)) continue;
    if (resolveVersionStatus(version, statuses) === 'In progress') return version;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Starting a round from the one that shipped                          */
/* ------------------------------------------------------------------ */

/**
 * The round a new one should be cut from: the newest version that exists below
 * it. Because a round can only be opened when nothing is in progress, that
 * version is by definition the released one — what the product is today.
 */
function sourceVersionFor(projectId: string, version: number): number | null {
  const removed = loadRemovedVersions(projectId);
  for (let candidate = version - 1; candidate >= BASELINE_VERSION; candidate -= 1) {
    if (!removed.includes(candidate)) return candidate;
  }
  return null;
}

/** Subfolders are browser state; the server render simply has none. */
function loadSubfoldersSafe(projectId: string, version: number): VersionSubfolder[] {
  try {
    return loadSubfolders(projectId, version);
  } catch {
    return [];
  }
}

/**
 * What a round holds: its own design files, and the folders inside it with
 * theirs.
 *
 * A copy of a round has to reproduce both, so both are read here. Only the
 * round's own storage key used to be loaded, which is why a file someone had
 * filed into a folder never came across: the folder was listed, but its files
 * were looked up in a map that was never given the folder's key.
 */
function versionContents(
  project: DesignProject,
  version: number,
): { files: DesignFile[]; folders: { name: string; files: DesignFile[] }[] } {
  const created: Record<string, SketchScreen[]> = {};
  for (const session of project.sessions) {
    created[session.id] = loadGeneratedScreens(session.id);
  }
  const count = loadVersionCount(project.id);
  for (let entry = FIRST_EDITABLE_VERSION; entry <= count; entry += 1) {
    created[versionFolderKey(project.id, entry)] = loadGeneratedScreens(
      versionFolderKey(project.id, entry),
    );
    for (const sub of loadSubfoldersSafe(project.id, entry)) {
      const subKey = subfolderStorageKey(project.id, entry, sub.id);
      created[subKey] = loadGeneratedScreens(subKey);
    }
  }
  const folder = projectVersionFolders(
    project,
    created,
    count,
    loadVersionStatuses(project.id),
    loadRemovedVersions(project.id),
  ).find((entry) => entry.versionNumber === version);
  return {
    files: folder?.files ?? [],
    folders: (folder?.children ?? []).map((child) => ({ name: child.name, files: child.files })),
  };
}

/** Every storage key a round's designs live under: its own, then its folders'. */
function versionStorageKeys(projectId: string, version: number): string[] {
  return [
    versionFolderKey(projectId, version),
    ...loadSubfoldersSafe(projectId, version).map((sub) =>
      subfolderStorageKey(projectId, version, sub.id),
    ),
  ];
}

/**
 * Every design a round holds — the files at its root, then those in the folders
 * inside it.
 *
 * A round is what the team has, whichever folder of it a file sits in. Anything
 * reading "the round" — to copy it, to fork it, to compare against it — wants
 * all of it; reading only the root quietly drops whatever someone filed away.
 */
export function versionScreens(projectId: string, version: number): SketchScreen[] {
  return versionStorageKeys(projectId, version).flatMap((key) => loadGeneratedScreens(key));
}

/**
 * Every design a round already holds, by name, wherever in the round it sits.
 *
 * Carrying over tops a round up rather than doubling it, and the question spans
 * the whole round rather than its root: a file the user filed into a folder is
 * one the round has, and copying it in again would put two of it in the tree —
 * under one id, for an html file, whose id is fixed by the round it is in.
 */
function roundHoldings(
  projectId: string,
  version: number,
): Map<string, { key: string; screen: SketchScreen }> {
  const held = new Map<string, { key: string; screen: SketchScreen }>();
  for (const key of versionStorageKeys(projectId, version)) {
    for (const screen of loadGeneratedScreens(key)) held.set(screen.name, { key, screen });
  }
  return held;
}

/**
 * Copies design files into one folder of a round. Each copy is independent —
 * new screen id, new block ids — so editing the new round never touches what
 * shipped. `held` is updated as it goes, so the same file cannot land twice.
 */
function copyFilesInto(
  key: string,
  files: DesignFile[],
  version: number,
  today: string,
  held: Map<string, { key: string; screen: SketchScreen }>,
): SketchScreen[] {
  const copies: SketchScreen[] = [];

  for (const file of files) {
    const prototype = findPrototypeFile(file.id);
    const already = held.get(file.name);
    if (already) {
      // An html file that came over as a plain canvas — by an older round, or
      // before it was one — is replaced by the real html screen. Anything else
      // the round already holds stays where the user has it.
      const stale =
        prototype &&
        already.key === key &&
        already.screen.id !== versionedPrototypeId(prototype.id, version);
      if (!stale) continue;
      removeGeneratedScreen(key, already.screen.id);
    }

    const blocks = loadScreenBlocks(file.id, file.seedPattern, () =>
      isPrototypeFile(file.id) ? prototypeDesignBlocks(file.id) : null,
    );

    // An html file is carried over as the same html screen — its id keeps the
    // prototype it came from, so the copy previews the real page and exports
    // the real html, with a layout of its own to edit.
    const copy = prototype
      ? addPrototypeCopy(
          key,
          {
            id: versionedPrototypeId(prototype.id, version),
            name: prototype.name,
            route: prototype.route,
            blocks,
            status: { label: 'Carried over', tone: 'slate' },
          },
          today,
        )
      : addCopiedScreen(
          key,
          {
            name: file.name,
            route: file.route,
            seedPattern: file.seedPattern,
            blocks,
            status: { label: 'Carried over', tone: 'slate' },
          },
          today,
        );
    if (prototype) copyPrototypeConfig(file.id, copy.id);

    held.set(copy.name, { key, screen: copy });
    copies.push(copy);
  }

  return copies;
}

/** The folder of that name inside a round, opened if it is not there yet. */
function ensureSubfolderNamed(
  projectId: string,
  version: number,
  name: string,
  today: string,
): VersionSubfolder {
  const existing = loadSubfoldersSafe(projectId, version).find((entry) => entry.name === name);
  return existing ?? addSubfolder(projectId, version, name, today);
}

/** A round filled from the one before it. */
export interface RoundCopy {
  /** The round this one was cut from. */
  from: number;
  /** Every design that came across, in the order they were copied. */
  screens: SketchScreen[];
  /** Where each copy landed, by storage key — what the tree has to re-read. */
  byKey: Record<string, SketchScreen[]>;
  /** How many folders the round gained. */
  folders: number;
}

/**
 * Fills a new round with a copy of the released one, so it opens up to date
 * with the product rather than empty.
 *
 * The whole round comes across, shape and all: the files at its root, and every
 * folder inside it with copies of the files in that folder. A round is how the
 * team has arranged the work, and starting the next one by flattening that
 * arrangement threw away the part that took the longest to decide.
 */
export function cloneReleasedInto(
  project: DesignProject,
  version: number,
  today: string,
): RoundCopy | null {
  const from = sourceVersionFor(project.id, version);
  if (from === null) return null;
  // A released round is the record of what shipped; nothing is written into it.
  if (isVersionLocked(version, loadVersionStatuses(project.id))) return null;

  const source = versionContents(project, from);
  const held = roundHoldings(project.id, version);
  const hadFolders = new Set(loadSubfoldersSafe(project.id, version).map((entry) => entry.name));

  const byKey: Record<string, SketchScreen[]> = {};
  const screens: SketchScreen[] = [];
  let folders = 0;

  const rootKey = versionFolderKey(project.id, version);
  const root = copyFilesInto(rootKey, source.files, version, today, held);
  if (root.length > 0) byKey[rootKey] = root;
  screens.push(...root);

  for (const child of source.folders) {
    const target = ensureSubfolderNamed(project.id, version, child.name, today);
    if (!hadFolders.has(child.name)) folders += 1;
    const key = subfolderStorageKey(project.id, version, target.id);
    const copies = copyFilesInto(key, child.files, version, today, held);
    if (copies.length > 0) byKey[key] = copies;
    screens.push(...copies);
  }

  return { from, screens, byKey, folders };
}

/**
 * The version a design moves into, opening a new round if none is open — and a
 * round that opens here starts from the released one, same as anywhere else.
 */
export function ensureInProgressVersion(projectId: string, project?: DesignProject): number {
  const open = findInProgressVersion(projectId);
  if (open !== null) return open;
  const next = Math.max(loadVersionCount(projectId) + 1, FIRST_EDITABLE_VERSION);
  saveVersionCount(projectId, next);
  if (project) cloneReleasedInto(project, next, new Date().toISOString().slice(0, 10));
  return next;
}

/* ------------------------------------------------------------------ */
/* Rounds that were dropped                                            */
/* ------------------------------------------------------------------ */

/**
 * A round can be opened by accident — the picker's "new version", a design that
 * was moved somewhere else — and an empty folder in the tree is just noise. A
 * dropped round is recorded rather than renumbered, so every other version
 * keeps its number, its files and its links.
 */
const REMOVED_KEY = 'we-adk:business:versions-removed';

export function loadRemovedVersions(projectId: string): number[] {
  try {
    const raw = window.localStorage.getItem(`${REMOVED_KEY}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => Number.isInteger(entry)) : [];
  } catch {
    return [];
  }
}

function saveRemovedVersions(projectId: string, versions: number[]): void {
  try {
    window.localStorage.setItem(`${REMOVED_KEY}:${projectId}`, JSON.stringify(versions));
  } catch {
    // Storage unavailable — the folder comes back on reload.
  }
}

/**
 * Drops a round: its design files go, and the folder stops being listed. The
 * baseline cannot be dropped. Removing the newest round just lowers the count,
 * so the number is free again; removing one in the middle leaves a gap.
 */
export function removeVersion(
  projectId: string,
  version: number,
): { count: number; removed: number[] } {
  const count = loadVersionCount(projectId);
  const removed = loadRemovedVersions(projectId);
  if (version === BASELINE_VERSION) return { count, removed };

  // The round's own files, then every folder inside it — otherwise the blocks
  // linger and a later round reusing the number would inherit ghosts.
  for (const sub of loadSubfolders(projectId, version)) {
    removeSubfolder(projectId, version, sub.id);
  }
  try {
    window.localStorage.removeItem(subfolderListKey(projectId, version));
  } catch {
    // ignore
  }
  const key = versionFolderKey(projectId, version);
  for (const screen of loadGeneratedScreens(key)) removeGeneratedScreen(key, screen.id);
  try {
    window.localStorage.removeItem(`we-adk:sketcher:generated:${key}`);
  } catch {
    // ignore — the list is empty either way
  }

  if (version >= count) {
    // Trailing rounds: shrink instead of remembering a hole. Anything already
    // marked above the new ceiling can be forgotten too.
    let next = version - 1;
    while (next > BASELINE_VERSION && removed.includes(next)) next -= 1;
    const kept = removed.filter((entry) => entry < next);
    saveRemovedVersions(projectId, kept);
    saveVersionCount(projectId, Math.max(next, BASELINE_VERSION));
    return { count: Math.max(next, BASELINE_VERSION), removed: kept };
  }

  const kept = removed.includes(version) ? removed : [...removed, version].sort((a, b) => a - b);
  saveRemovedVersions(projectId, kept);
  return { count, removed: kept };
}

/** Starts a copy off with the layout the screen has right now. */
function copyPrototypeConfig(fromScreenId: string, toScreenId: string): void {
  const from = prototypeConfigKeyForScreen(fromScreenId);
  const to = prototypeConfigKeyForScreen(toScreenId);
  if (!from || !to) return;
  try {
    const raw = window.localStorage.getItem(from);
    if (raw) window.localStorage.setItem(to, raw);
    else window.localStorage.removeItem(to);
  } catch {
    // Storage unavailable — the copy opens on the screen's default layout.
  }
}

/** `Cash Receipt Detail` → `cash-receipt-detail.html`. */
function htmlFileName(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'screen';
  return `${slug}.html`;
}

/** A version a design can be put into — what a destination picker offers. */
export interface VersionTarget {
  version: number;
  status: VersionStatus;
  /** False for the next round, which is only opened if someone picks it. */
  exists: boolean;
}

/**
 * Whether a new round can be opened.
 *
 * One round at a time: while a version is still in progress it is where work
 * belongs, so the next one cannot be started until that one is released.
 */
export function canOpenNewVersion(projectId: string): boolean {
  return findInProgressVersion(projectId) === null;
}

/**
 * Every round a design could go into: the rounds still open, plus the next one
 * when nothing is in progress. Neither the baseline nor a released round is
 * offered — a design cannot be added to something that has shipped.
 */
export function versionTargets(projectId: string): VersionTarget[] {
  const count = loadVersionCount(projectId);
  const statuses = loadVersionStatuses(projectId);
  const removed = loadRemovedVersions(projectId);
  const targets: VersionTarget[] = [];
  for (let version = FIRST_EDITABLE_VERSION; version <= count; version += 1) {
    if (removed.includes(version)) continue;
    if (isVersionLocked(version, statuses)) continue;
    targets.push({ version, status: resolveVersionStatus(version, statuses), exists: true });
  }
  // A round already open is where the work goes; the next one waits for it.
  if (canOpenNewVersion(projectId)) {
    targets.push({
      version: Math.max(count + 1, FIRST_EDITABLE_VERSION),
      status: 'In progress',
      exists: false,
    });
  }
  return targets;
}

/**
 * Opens a round if it is not there yet, and returns the number either way —
 * unless another round is still in progress, in which case that one is used
 * instead. One round at a time, whichever door the caller came in by.
 */
export function ensureVersion(projectId: string, version: number): number {
  if (version <= loadVersionCount(projectId)) return version;
  const open = findInProgressVersion(projectId);
  if (open !== null) return open;
  saveVersionCount(projectId, version);
  return version;
}

/**
 * Finds a design file created inside a version, anywhere in the project list.
 * Browser-only — reads localStorage.
 */
export function findVersionScreen(
  screenId: string,
): { project: DesignProject; version: number; screen: SketchScreen } | null {
  for (const project of PROJECTS) {
    const count = loadVersionCount(project.id);
    const removed = loadRemovedVersions(project.id);
    for (let version = FIRST_EDITABLE_VERSION; version <= count; version += 1) {
      if (removed.includes(version)) continue;
      const keys = [
        versionFolderKey(project.id, version),
        ...loadSubfolders(project.id, version).map((sub) =>
          subfolderStorageKey(project.id, version, sub.id),
        ),
      ];
      for (const key of keys) {
        const screen = loadGeneratedScreens(key).find((entry) => entry.id === screenId);
        if (screen) return { project, version, screen };
      }
    }
  }
  return null;
}

function versionLabel(project: DesignProject, version: number): string {
  if (version !== BASELINE_VERSION) return `Version ${version} · added in Business`;
  return project.id === PROTOTYPE_PROJECT_ID
    ? 'Baseline · the html prototype of the live app'
    : 'Baseline · every design from the meetings';
}

/** A prototype html file as it reads inside the version folder. */
function prototypeDesignFile(file: PrototypeFile, folderId: string, label: string): DesignFile {
  return {
    id: file.id,
    fileName: file.fileName,
    name: file.name,
    route: file.route,
    // Only used if a file ever falls back to the wireframe canvas.
    seedPattern: 'listPage',
    status: file.status,
    updatedAt: file.updatedAt,
    kind: 'prototype',
    folderId,
    folderLabel: label,
    removable: false,
  };
}

/**
 * The version folders of a project, baseline first.
 *
 * `created` holds the files the user made, keyed the same way the rest of the
 * mock keys them: by meeting id for anything drawn against a meeting, and by
 * version key for anything added inside a version. The caller reads those from
 * localStorage after mount, so this stays renderable on the server.
 */
export function projectVersionFolders(
  project: DesignProject,
  created: Record<string, SketchScreen[]> = {},
  count: number = BASELINE_VERSION,
  statuses: VersionStatuses = {},
  removed: number[] = [],
): DesignFolder[] {
  const nameById = new Map(
    projectSketchScreens(project).map((screen) => [screen.id, screen.name] as const),
  );

  const folders: DesignFolder[] = [];

  for (let version = BASELINE_VERSION; version <= Math.max(count, BASELINE_VERSION); version += 1) {
    if (removed.includes(version)) continue;
    const label = versionLabel(project, version);
    const storageKey = versionFolderKey(project.id, version);
    const folder: DesignFolder = {
      id: versionFolderId(version),
      name: `version ${version}`,
      label,
      kind: 'version',
      versionNumber: version,
      versionStatus: resolveVersionStatus(version, statuses),
      // The baseline takes no new files, so it advertises no storage key.
      storageKey: version === BASELINE_VERSION ? undefined : storageKey,
      files: [],
    };

    if (version === BASELINE_VERSION && project.id === PROTOTYPE_PROJECT_ID) {
      // The eACC project ships a working prototype, so its baseline is the html
      // files of that app rather than wireframes drawn from the notes. The
      // meeting designs are still on the board, where they were made.
      for (const file of PROTOTYPE_FILES) {
        folder.files.push(prototypeDesignFile(file, folder.id, label));
      }
    } else if (version === BASELINE_VERSION) {
      // Everything the meetings produced — seeded sketches plus whatever the
      // board generated from those notes — reads as the baseline.
      for (const session of project.sessions) {
        const target = { id: folder.id, label, storageKey: session.id };
        for (const screen of [...session.screens, ...(created[session.id] ?? [])]) {
          folder.files.push(
            designFileFromScreen(
              screen,
              target,
              screen.variantOf ? nameById.get(screen.variantOf) : undefined,
            ),
          );
        }
      }
    } else {
      // Folders someone made inside this round, each with its own files.
      folder.children = loadSubfoldersSafe(project.id, version).map((sub) => {
        const subKey = subfolderStorageKey(project.id, version, sub.id);
        const subTarget = {
          id: subfolderFolderId(version, sub.id),
          label: `${label} · ${sub.name}`,
          storageKey: subKey,
        };
        return {
          id: subTarget.id,
          name: sub.name,
          label: subTarget.label,
          kind: 'group' as const,
          versionNumber: version,
          // A folder inside a round is part of that round, so it carries the
          // round's status. Without it, a file in here read as editable after
          // the round shipped.
          versionStatus: folder.versionStatus,
          storageKey: subKey,
          files: (created[subKey] ?? []).map((screen) => {
            const file = designFileFromScreen(screen, subTarget);
            const prototype = findPrototypeFile(screen.id);
            return {
              ...file,
              fileName: prototype ? prototype.fileName : htmlFileName(screen.name),
              kind: prototype ? ('prototype' as const) : file.kind,
              route: file.route ?? prototype?.route,
            };
          }),
        };
      });

      const target = { id: folder.id, label, storageKey };
      for (const screen of created[storageKey] ?? []) {
        // A round is a round of the html prototype, so its files are html files
        // — same as the baseline. The canvas behind them is unchanged; only the
        // name and the icon say what kind of thing this is.
        const file = designFileFromScreen(screen, target);
        // A carried-over html file keeps the name it had in the round it came
        // from; anything else in a round is html of this round's making.
        const prototype = findPrototypeFile(screen.id);
        folder.files.push({
          ...file,
          fileName: prototype ? prototype.fileName : htmlFileName(screen.name),
          kind: prototype ? 'prototype' : file.kind,
          route: file.route ?? prototype?.route,
        });
      }
    }

    folders.push(folder);
  }

  return folders;
}
