/**
 * A team member's own workspace, and who is on the team.
 *
 * This lived inside the User tab until the Task tab needed it too: a design
 * generated from a task is handed to the person who owns the task rather than
 * dropped straight into a round, so both tabs write to the same place and agree
 * on what a workspace is.
 *
 * Browser-only — every member and every forked screen lives in localStorage.
 */
import {
  addBlankDesign,
  loadGeneratedScreens,
  saveGeneratedScreens,
  type SeedPattern,
  type SketchScreen,
} from '@/lib/we-adk-mock/sketches';
import {
  FIRST_EDITABLE_VERSION,
  isVersionLocked,
  loadRemovedVersions,
  loadVersionCount,
  loadVersionStatuses,
  versionFolderId,
  versionScreens,
} from '@/lib/we-adk-mock/versions';
import { forkScreenForMember } from '@/lib/we-adk/user-merge';
import { memberScopedId, readPrototypeId } from '@/lib/we-adk/prototype';

export type MemberRole = 'Project Lead' | 'Developer' | 'Designer' | 'QA' | 'PM' | 'Other';

export const MEMBER_ROLES: MemberRole[] = [
  'Project Lead',
  'Developer',
  'Designer',
  'QA',
  'PM',
  'Other',
];

export interface TeamMember {
  id: string;
  name: string;
  role: MemberRole;
  email?: string;
  department?: string;
}

/* ------------------------------------------------------------------ */
/* Seeded team data                                                    */
/* ------------------------------------------------------------------ */

export const PROJECT_TEAMS: Record<string, TeamMember[]> = {
  'proj-eacc-cloud': [
    {
      id: 'tm-1',
      name: 'Taehyuk Park',
      role: 'Project Lead',
      email: 'taehyuk@kosign.com',
      department: 'Engineering',
    },
    {
      id: 'tm-2',
      name: 'Namwon Moon',
      role: 'Developer',
      email: 'namwon@kosign.com',
      department: 'Engineering',
    },
    { id: 'tm-3', name: 'Moka', role: 'Designer', email: 'moka@kosign.com', department: 'Design' },
  ],
  'proj-hd-trip': [
    {
      id: 'tm-4',
      name: 'Seongmin Yoo',
      role: 'PM',
      email: 'seongmin@kosign.com',
      department: 'Product',
    },
    { id: 'tm-5', name: 'Moka', role: 'Designer', email: 'moka@kosign.com', department: 'Design' },
  ],
  'proj-nonghyup-loan': [
    {
      id: 'tm-6',
      name: 'Moka',
      role: 'Project Lead',
      email: 'moka@kosign.com',
      department: 'Design',
    },
    {
      id: 'tm-7',
      name: 'Taehyuk Park',
      role: 'Developer',
      email: 'taehyuk@kosign.com',
      department: 'Engineering',
    },
  ],
  'proj-sk-hynix': [
    {
      id: 'tm-8',
      name: 'Seongmin Yoo',
      role: 'PM',
      email: 'seongmin@kosign.com',
      department: 'Product',
    },
    { id: 'tm-9', name: '설욱환', role: 'Developer', department: 'Engineering' },
  ],
  'proj-harim-voucher': [
    {
      id: 'tm-10',
      name: 'Moka',
      role: 'Project Lead',
      email: 'moka@kosign.com',
      department: 'Design',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* localStorage — team members                                        */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'we-adk:team-members';

export function loadUserMembers(projectId: string): TeamMember[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TeamMember[]) : [];
  } catch {
    return [];
  }
}

export function saveUserMembers(projectId: string, members: TeamMember[]): void {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(members));
  } catch {}
}

export function isUserMember(id: string): boolean {
  return id.startsWith('tm-user-');
}

/* ------------------------------------------------------------------ */
/* Per-user screen storage                                             */
/* ------------------------------------------------------------------ */

const USER_SCREENS_KEY = 'we-adk:user-screens';

export function userScreensStorageKey(
  projectId: string,
  userId: string,
  version: number,
  /** A folder inside the round, when the screens belong to one. */
  subfolderId?: string,
): string {
  const base = `${USER_SCREENS_KEY}:${projectId}:${userId}:${version}`;
  return subfolderId ? `${base}:${subfolderId}` : base;
}

/** Load the user's own screen list for a version, or null if not initialised. */
export function loadUserScreens(
  projectId: string,
  userId: string,
  version: number,
): SketchScreen[] | null {
  try {
    const raw = window.localStorage.getItem(userScreensStorageKey(projectId, userId, version));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SketchScreen[]) : null;
  } catch {
    return null;
  }
}

export function saveUserScreens(
  projectId: string,
  userId: string,
  version: number,
  screens: SketchScreen[],
): void {
  try {
    window.localStorage.setItem(
      userScreensStorageKey(projectId, userId, version),
      JSON.stringify(screens),
    );
  } catch {}
}

/**
 * Load the user's screens for a version, forking the round's designs into their
 * own files the first time.
 *
 * The fork is what makes the workspace a workspace: their own file ids, their
 * own canvases, their own layout edits. Earlier builds stored the round's
 * screens by reference, so every edit landed straight in Main and there was
 * nothing left to merge — a list saved like that is re-forked here rather than
 * left broken.
 *
 * The whole round is forked, including the files Main keeps in folders: a
 * member's folders are their own arrangement, so the round arrives as one list
 * for them to arrange. Reading only Main's root would hide those files here.
 */
export function initUserScreens(
  projectId: string,
  userId: string,
  version: number,
): SketchScreen[] {
  const existing = loadUserScreens(projectId, userId, version);
  const source = existing ?? versionScreens(projectId, version);
  const shared = source.filter((screen) => readPrototypeId(screen.id).member === null);
  if (existing !== null && shared.length === 0) return existing;

  const forked = source.map((screen) =>
    readPrototypeId(screen.id).member === null ? forkScreenForMember(screen, userId) : screen,
  );
  saveUserScreens(projectId, userId, version, forked);
  return forked;
}

/** Moves a screen to a new position in the user's list. */
export function reorderUserScreen(
  projectId: string,
  userId: string,
  version: number,
  screenId: string,
  toIndex: number,
): void {
  const screens = initUserScreens(projectId, userId, version);
  const fromIndex = screens.findIndex((s) => s.id === screenId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  const [item] = screens.splice(fromIndex, 1) as [SketchScreen];
  screens.splice(toIndex, 0, item);
  saveUserScreens(projectId, userId, version, screens);
}

/* ------------------------------------------------------------------ */
/* Folders and files a member makes for themselves                     */
/* ------------------------------------------------------------------ */

/**
 * A folder a member made inside their copy of a round.
 *
 * Theirs, not the round's: two people working from version 2 arrange their
 * workspaces differently, and a folder one of them adds has no business appearing
 * in the other's tree. Hence keyed by member as well as by round, unlike Main's.
 */
export interface UserSubfolder {
  id: string;
  name: string;
  createdAt: string;
}

const USER_SUBFOLDERS_KEY = 'we-adk:user-subfolders';

function userSubfolderListKey(projectId: string, userId: string, version: number): string {
  return `${USER_SUBFOLDERS_KEY}:${projectId}:${userId}:${version}`;
}

/** The id the tree uses: `version-2--usf-…`, the shape Main's subfolders have. */
export function userSubfolderFolderId(version: number, subfolderId: string): string {
  return `${versionFolderId(version)}--${subfolderId}`;
}

export function loadUserSubfolders(
  projectId: string,
  userId: string,
  version: number,
): UserSubfolder[] {
  try {
    const raw = window.localStorage.getItem(userSubfolderListKey(projectId, userId, version));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is UserSubfolder =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string',
    );
  } catch {
    return [];
  }
}

function saveUserSubfolders(
  projectId: string,
  userId: string,
  version: number,
  folders: UserSubfolder[],
): void {
  try {
    window.localStorage.setItem(
      userSubfolderListKey(projectId, userId, version),
      JSON.stringify(folders),
    );
  } catch {
    // Storage unavailable — the folder simply will not persist.
  }
}

let subfolderCounter = 0;

export function addUserSubfolder(
  projectId: string,
  userId: string,
  version: number,
  name: string,
  today: string,
): UserSubfolder {
  subfolderCounter += 1;
  const folder: UserSubfolder = {
    id: `usf-${subfolderCounter}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'New folder',
    createdAt: today,
  };
  saveUserSubfolders(projectId, userId, version, [
    ...loadUserSubfolders(projectId, userId, version),
    folder,
  ]);
  return folder;
}

/** Renames a subfolder. */
export function renameUserSubfolder(
  projectId: string,
  userId: string,
  version: number,
  subfolderId: string,
  name: string,
): void {
  const list = loadUserSubfolders(projectId, userId, version);
  const next = list.map((entry) =>
    entry.id === subfolderId ? { ...entry, name: name.trim() || entry.name } : entry,
  );
  saveUserSubfolders(projectId, userId, version, next);
}

/** Drops a folder and whatever was inside it. */
export function removeUserSubfolder(
  projectId: string,
  userId: string,
  version: number,
  subfolderId: string,
): UserSubfolder[] {
  const next = loadUserSubfolders(projectId, userId, version).filter(
    (entry) => entry.id !== subfolderId,
  );
  saveUserSubfolders(projectId, userId, version, next);
  try {
    window.localStorage.removeItem(userScreensStorageKey(projectId, userId, version, subfolderId));
  } catch {
    // Nothing to clean up.
  }
  return next;
}

/**
 * A blank design in a member's workspace — in the round itself, or in one of their
 * folders.
 *
 * Forked screens carry `~memberId` so a canvas cannot be confused with the round's
 * own copy; one made here is scoped the same way, for the same reason.
 */
export function addUserDesign(
  projectId: string,
  userId: string,
  version: number,
  input: { name: string; route?: string; seedPattern: SeedPattern },
  today: string,
  subfolderId?: string,
): SketchScreen {
  const key = userScreensStorageKey(projectId, userId, version, subfolderId);
  const screen = addBlankDesign(key, input, today);
  const scoped: SketchScreen = { ...screen, id: memberScopedId(screen.id, userId) };

  if (subfolderId) {
    // A folder's list *is* the generated store for its key, so rewrite the entry
    // under the scoped id and the row and the canvas agree.
    saveGeneratedScreens(
      key,
      loadGeneratedScreens(key).map((entry) => (entry.id === screen.id ? scoped : entry)),
    );
    return scoped;
  }

  // In the round itself the member's own list is the authority, not the generated
  // store — so move the screen across rather than leaving it in both.
  saveGeneratedScreens(
    key,
    loadGeneratedScreens(key).filter((entry) => entry.id !== screen.id),
  );
  saveUserScreens(projectId, userId, version, [
    ...(loadUserScreens(projectId, userId, version) ?? []),
    scoped,
  ]);
  return scoped;
}

/* ------------------------------------------------------------------ */
/* Who is on the team                                                  */
/* ------------------------------------------------------------------ */

/** The seeded team plus anyone added since, in that order. */
export function projectTeam(projectId: string): TeamMember[] {
  return [...(PROJECT_TEAMS[projectId] ?? []), ...loadUserMembers(projectId)];
}

/**
 * The member a name refers to. Tasks carry an assignee's *name*, not an id, so
 * handing a design to "the person whose task this is" has to go through this.
 */
export function findMemberByName(projectId: string, name: string): TeamMember | null {
  const wanted = name.trim().toLowerCase();
  return projectTeam(projectId).find((entry) => entry.name.toLowerCase() === wanted) ?? null;
}

/* ------------------------------------------------------------------ */
/* Handing a design to someone                                         */
/* ------------------------------------------------------------------ */

/**
 * The round a workspace mirrors: the newest one that still exists. Null when the
 * project has no round after the baseline yet.
 */
export function memberWorkspaceVersion(projectId: string): number | null {
  const count = loadVersionCount(projectId);
  const removed = loadRemovedVersions(projectId);
  for (let version = count; version >= FIRST_EDITABLE_VERSION; version -= 1) {
    if (!removed.includes(version)) return version;
  }
  return null;
}

/** Why a design cannot be handed over, or null when it can. */
export type HandoffBlocker = 'no-round' | 'released' | null;

export function handoffBlocker(projectId: string): HandoffBlocker {
  const version = memberWorkspaceVersion(projectId);
  if (version === null) return 'no-round';
  // A workspace mirrors a round, so a shipped round takes nothing here either.
  if (isVersionLocked(version, loadVersionStatuses(projectId))) return 'released';
  return null;
}

/**
 * Puts a copy of a screen into a member's workspace.
 *
 * The copy is forked — its own id, canvas and layout — so the member can change
 * it without touching the task's sample or the round. Getting it into Main is a
 * separate, deliberate step: they merge it from the User tab.
 */
export function giveScreenToMember(
  projectId: string,
  memberId: string,
  screen: SketchScreen,
): { version: number; screen: SketchScreen } | null {
  if (handoffBlocker(projectId) !== null) return null;
  const version = memberWorkspaceVersion(projectId);
  if (version === null) return null;

  const forked = forkScreenForMember(screen, memberId);
  const current = initUserScreens(projectId, memberId, version);
  // Handing the same design over twice tops the workspace up rather than
  // doubling it.
  const next = current.some((entry) => entry.id === forked.id)
    ? current.map((entry) => (entry.id === forked.id ? forked : entry))
    : [...current, forked];
  saveUserScreens(projectId, memberId, version, next);
  return { version, screen: forked };
}
