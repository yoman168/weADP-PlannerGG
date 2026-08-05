/**
 * What the Main tab was last looking at.
 *
 * The view lives in the URL — `?screen=…&folder=…` — and in the tree's expanded
 * set, and the tab links are bare paths. Leaving for Task or User and coming back
 * dropped all of it: the folder, the file open in it, and which rounds were unfolded.
 * This remembers the lot, per project, so returning puts you back where you were
 * however you get there — a tab click, the back button, or a fresh load.
 *
 * Replaces an earlier version that stored the folder id as a bare string; that
 * shape is still read, so nobody loses their place on the way to this one.
 */

export interface LastView {
  folder: string | null;
  /** The file open in that folder, when one was. */
  screen: string | null;
  /** Ids of the folders left unfolded in the tree. */
  expanded: string[];
}

const STORAGE_KEY = 'we-adk:last-folder';

function key(projectId: string): string {
  return `${STORAGE_KEY}:${projectId}`;
}

const EMPTY: LastView = { folder: null, screen: null, expanded: [] };

export function loadLastView(projectId: string): LastView {
  try {
    const raw = window.localStorage.getItem(key(projectId));
    if (!raw) return EMPTY;
    // The old format: just the folder id.
    if (!raw.startsWith('{')) return { ...EMPTY, folder: raw };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const record = parsed as Partial<LastView>;
    return {
      folder: typeof record.folder === 'string' ? record.folder : null,
      screen: typeof record.screen === 'string' ? record.screen : null,
      expanded: Array.isArray(record.expanded)
        ? record.expanded.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return EMPTY;
  }
}

/* ------------------------------------------------------------------ */
/* The User tab                                                        */
/* ------------------------------------------------------------------ */

/**
 * The same idea for the User tab, which keeps its place in state rather than in the
 * URL — so leaving for Main or Task lost the member you had open, the design you
 * were looking at and the shape of their tree.
 *
 * A separate record with its own names: calling a member a "folder" to reuse the
 * shape above would save a few lines and cost every future reader a moment.
 */
export interface LastUserView {
  member: string | null;
  /** The design open in that member's workspace. */
  file: string | null;
  expanded: string[];
}

const USER_KEY = 'we-adk:last-user-view';

const EMPTY_USER: LastUserView = { member: null, file: null, expanded: [] };

export function loadLastUserView(projectId: string): LastUserView {
  try {
    const raw = window.localStorage.getItem(`${USER_KEY}:${projectId}`);
    if (!raw) return EMPTY_USER;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_USER;
    const record = parsed as Partial<LastUserView>;
    return {
      member: typeof record.member === 'string' ? record.member : null,
      file: typeof record.file === 'string' ? record.file : null,
      expanded: Array.isArray(record.expanded)
        ? record.expanded.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return EMPTY_USER;
  }
}

export function saveLastUserView(projectId: string, patch: Partial<LastUserView>): void {
  try {
    const next: LastUserView = { ...loadLastUserView(projectId), ...patch };
    if (!next.member && !next.file && next.expanded.length === 0) {
      window.localStorage.removeItem(`${USER_KEY}:${projectId}`);
      return;
    }
    window.localStorage.setItem(`${USER_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the view simply will not be restored next time.
  }
}

/** Merges into what is already stored, so each caller can save only its part. */
export function saveLastView(projectId: string, patch: Partial<LastView>): void {
  try {
    const next: LastView = { ...loadLastView(projectId), ...patch };
    if (!next.folder && !next.screen && next.expanded.length === 0) {
      window.localStorage.removeItem(key(projectId));
      return;
    }
    window.localStorage.setItem(key(projectId), JSON.stringify(next));
  } catch {
    // Storage unavailable — the view simply will not be restored next time.
  }
}
