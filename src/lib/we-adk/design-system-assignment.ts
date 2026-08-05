/**
 * Which design system applies to which part of a round.
 *
 * A round is not always one look. The eACC screens in it want the dense,
 * table-first system; a landing or onboarding screen in the same round wants the
 * warm marketing one. So the assignment is a tree of overrides rather than a
 * single choice: the round sets a default, a folder can override it for
 * everything inside, and a single file can override that.
 *
 * Resolution is file → folder → round → the shipped default. Narrowest wins,
 * which is the rule people already expect from every other settings tree.
 */

import {
  DEFAULT_DESIGN_SYSTEM_ID,
  isPatched,
  type ComponentPatch,
  type SystemPatch,
  type TypePatch,
} from './design-systems';

export interface SystemAssignment {
  /** The round's default — what everything inherits unless told otherwise. */
  round: string;
  /** Folder id → system id. Applies to every file in that folder. */
  folders: Record<string, string>;
  /** Canvas id → system id. The last word for that one file. */
  files: Record<string, string>;
  /**
   * System id → the edits made to it.
   *
   * Tuning belongs to the system, not to the node that selected it: two folders
   * on Adora are on the same Adora, so an edit made from one shows up in the
   * other. Anything else would quietly fork the system per folder and make
   * "which Adora is this" a real question.
   */
  overrides: Record<string, SystemPatch>;
  /**
   * Canvas block id → the fields overridden on that one block.
   *
   * The escape hatch from the system, and deliberately a separate map: an edit
   * made here is an exception, and exceptions should be countable. A round with
   * forty block overrides is not using a design system, and keeping them apart is
   * what makes that visible instead of invisible.
   */
  blocks: Record<string, ComponentPatch>;
}

/** What a resolved assignment came from — so the UI can say "inherited". */
export type AssignmentScope = 'file' | 'folder' | 'round';

export const EMPTY_ASSIGNMENT: SystemAssignment = {
  round: DEFAULT_DESIGN_SYSTEM_ID,
  folders: {},
  files: {},
  overrides: {},
  blocks: {},
};

function storageKey(projectId: string, version: number): string {
  return `we-adk:design:systems:${projectId}:v${version}`;
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

/**
 * Stored patches are checked shallowly: the shape is ours, the risk is a hand-
 * edited or stale localStorage entry, and a wrong `weight` costs a odd-looking
 * preview rather than a crash. Anything unrecognised is dropped on read.
 */
function isPatchMap(value: unknown): value is Record<string, SystemPatch> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
    )
  );
}

export function loadAssignment(projectId: string, version: number): SystemAssignment {
  if (typeof window === 'undefined') return EMPTY_ASSIGNMENT;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId, version));
    if (!raw) return EMPTY_ASSIGNMENT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_ASSIGNMENT;
    const record = parsed as Record<string, unknown>;
    return {
      round: typeof record.round === 'string' ? record.round : DEFAULT_DESIGN_SYSTEM_ID,
      folders: isRecordOfStrings(record.folders) ? record.folders : {},
      files: isRecordOfStrings(record.files) ? record.files : {},
      overrides: isPatchMap(record.overrides) ? record.overrides : {},
      blocks: isPatchMap(record.blocks) ? (record.blocks as Record<string, ComponentPatch>) : {},
    };
  } catch {
    return EMPTY_ASSIGNMENT;
  }
}

export function saveAssignment(
  projectId: string,
  version: number,
  assignment: SystemAssignment,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId, version), JSON.stringify(assignment));
  } catch {
    // A full or blocked store is not worth failing the interaction over — the
    // choice still holds for this session, it just will not survive a reload.
  }
}

/**
 * The system a file ends up with, and where that came from.
 *
 * Takes the folder id rather than looking it up: the caller is walking the tree
 * already and knows which folder the row sits in, and a file at the root of a
 * round has no folder to consult.
 */
export function resolveSystem(
  assignment: SystemAssignment,
  fileId: string,
  folderId?: string,
): { systemId: string; scope: AssignmentScope } {
  const file = assignment.files[fileId];
  if (file) return { systemId: file, scope: 'file' };

  const folder = folderId ? assignment.folders[folderId] : undefined;
  if (folder) return { systemId: folder, scope: 'folder' };

  return { systemId: assignment.round, scope: 'round' };
}

/** The system a folder row shows: its own override, or the round's default. */
export function resolveFolderSystem(
  assignment: SystemAssignment,
  folderId: string,
): { systemId: string; scope: AssignmentScope } {
  const folder = assignment.folders[folderId];
  return folder
    ? { systemId: folder, scope: 'folder' }
    : { systemId: assignment.round, scope: 'round' };
}

/**
 * Setting the round's default clears the overrides that merely restated it.
 *
 * Without this, switching the round default leaves folders pinned to the old
 * system with no visible reason — the row looks overridden because at some
 * point it agreed with a default that has since moved.
 */
export function setRoundSystem(assignment: SystemAssignment, systemId: string): SystemAssignment {
  const folders = Object.fromEntries(
    Object.entries(assignment.folders).filter(([, value]) => value !== assignment.round),
  );
  const files = Object.fromEntries(
    Object.entries(assignment.files).filter(([, value]) => value !== assignment.round),
  );
  return { ...assignment, round: systemId, folders, files };
}

/** Pin a folder, or clear the pin by passing null. */
export function setFolderSystem(
  assignment: SystemAssignment,
  folderId: string,
  systemId: string | null,
): SystemAssignment {
  const folders = { ...assignment.folders };
  if (systemId === null) delete folders[folderId];
  else folders[folderId] = systemId;
  return { ...assignment, folders };
}

/** Pin a single file, or clear the pin by passing null. */
export function setFileSystem(
  assignment: SystemAssignment,
  fileId: string,
  systemId: string | null,
): SystemAssignment {
  const files = { ...assignment.files };
  if (systemId === null) delete files[fileId];
  else files[fileId] = systemId;
  return { ...assignment, files };
}

/**
 * Fold a patch fragment into a system's overrides.
 *
 * A patch that ends up saying nothing is deleted rather than stored empty:
 * `{}` and absent must not be two states, or "is this system edited" gets two
 * answers and the reset button appears with nothing to reset.
 */
function patchSystem(
  assignment: SystemAssignment,
  systemId: string,
  fragment: SystemPatch,
): SystemAssignment {
  const current = assignment.overrides[systemId] ?? {};
  const next: SystemPatch = {
    ...current,
    ...fragment,
    colors: { ...(current.colors ?? {}), ...(fragment.colors ?? {}) },
    radius: { ...(current.radius ?? {}), ...(fragment.radius ?? {}) },
    display: { ...(current.display ?? {}), ...(fragment.display ?? {}) },
    body: { ...(current.body ?? {}), ...(fragment.body ?? {}) },
    components: mergeComponents(current.components, fragment.components),
  };

  // Drop the empty sub-objects the spread above always creates.
  if (Object.keys(next.colors ?? {}).length === 0) delete next.colors;
  if (Object.keys(next.radius ?? {}).length === 0) delete next.radius;
  if (Object.keys(next.display ?? {}).length === 0) delete next.display;
  if (Object.keys(next.body ?? {}).length === 0) delete next.body;
  if (Object.keys(next.components ?? {}).length === 0) delete next.components;

  const overrides = { ...assignment.overrides };
  if (isPatched(next)) overrides[systemId] = next;
  else delete overrides[systemId];

  return { ...assignment, overrides };
}

/** Per-component merge, one level deeper than the rest of the patch. */
function mergeComponents(
  current: Record<string, ComponentPatch> | undefined,
  fragment: Record<string, ComponentPatch> | undefined,
): Record<string, ComponentPatch> {
  const merged: Record<string, ComponentPatch> = { ...(current ?? {}) };
  for (const [id, patch] of Object.entries(fragment ?? {})) {
    const next = { ...(merged[id] ?? {}), ...patch };
    if (Object.keys(next).length === 0) delete merged[id];
    else merged[id] = next;
  }
  return merged;
}

/**
 * Edit one field of one component, or clear the whole component's edits by
 * passing null.
 */
export function setComponent(
  assignment: SystemAssignment,
  systemId: string,
  componentId: string,
  fragment: ComponentPatch | null,
): SystemAssignment {
  const overrides = { ...assignment.overrides };
  const current = { ...(overrides[systemId] ?? {}) };
  const components = { ...(current.components ?? {}) };

  if (fragment === null) delete components[componentId];
  else components[componentId] = { ...(components[componentId] ?? {}), ...fragment };

  if (Object.keys(components).length === 0) delete current.components;
  else current.components = components;

  if (isPatched(current)) overrides[systemId] = current;
  else delete overrides[systemId];

  return { ...assignment, overrides };
}

/** Recolour one token, or clear the edit by passing null. */
export function setTokenColor(
  assignment: SystemAssignment,
  systemId: string,
  token: string,
  value: string | null,
): SystemAssignment {
  const current = assignment.overrides[systemId]?.colors ?? {};
  const colors = { ...current };
  if (value === null) delete colors[token];
  else colors[token] = value;
  // Assigning the whole map rather than merging, so a cleared token really goes.
  return patchSystem({ ...assignment, overrides: stripColors(assignment, systemId) }, systemId, {
    colors,
  });
}

/** Set one radius step, or clear it by passing null. */
export function setRadius(
  assignment: SystemAssignment,
  systemId: string,
  key: string,
  value: string | null,
): SystemAssignment {
  const current = assignment.overrides[systemId]?.radius ?? {};
  const radius = { ...current };
  if (value === null) delete radius[key];
  else radius[key] = value;
  return patchSystem({ ...assignment, overrides: stripRadius(assignment, systemId) }, systemId, {
    radius,
  });
}

export function setSpacingBase(
  assignment: SystemAssignment,
  systemId: string,
  base: number | null,
): SystemAssignment {
  const overrides = { ...assignment.overrides };
  const current = { ...(overrides[systemId] ?? {}) };
  if (base === null) delete current.spacingBase;
  else current.spacingBase = base;
  if (isPatched(current)) overrides[systemId] = current;
  else delete overrides[systemId];
  return { ...assignment, overrides };
}

export function setTypography(
  assignment: SystemAssignment,
  systemId: string,
  role: 'display' | 'body',
  fragment: TypePatch,
): SystemAssignment {
  return patchSystem(assignment, systemId, { [role]: fragment });
}

/** Clearing a whole map has to replace it, not merge into it. */
function stripColors(assignment: SystemAssignment, systemId: string): Record<string, SystemPatch> {
  const overrides = { ...assignment.overrides };
  const current = overrides[systemId];
  if (current) {
    const { colors: _dropped, ...rest } = current;
    overrides[systemId] = rest;
  }
  return overrides;
}

function stripRadius(assignment: SystemAssignment, systemId: string): Record<string, SystemPatch> {
  const overrides = { ...assignment.overrides };
  const current = overrides[systemId];
  if (current) {
    const { radius: _dropped, ...rest } = current;
    overrides[systemId] = rest;
  }
  return overrides;
}

/**
 * Override one block, or clear its exception by passing null.
 *
 * Scoped to the block rather than to the block-and-component pair: a block is one
 * component, so a second key would only let the two disagree.
 */
export function setBlock(
  assignment: SystemAssignment,
  blockId: string,
  fragment: ComponentPatch | null,
): SystemAssignment {
  const blocks = { ...assignment.blocks };
  if (fragment === null) delete blocks[blockId];
  else blocks[blockId] = { ...(blocks[blockId] ?? {}), ...fragment };
  return { ...assignment, blocks };
}

/** Drop every edit made to one system. */
export function resetSystem(assignment: SystemAssignment, systemId: string): SystemAssignment {
  const overrides = { ...assignment.overrides };
  delete overrides[systemId];
  return { ...assignment, overrides };
}

/** How many systems are actually in play — drives the "mixed round" notice. */
export function distinctSystemCount(assignment: SystemAssignment): number {
  return new Set([
    assignment.round,
    ...Object.values(assignment.folders),
    ...Object.values(assignment.files),
  ]).size;
}
