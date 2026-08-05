/**
 * The thread under a task: what people said, and what the task did.
 *
 * Two kinds of entry share one list, the way an issue tracker mixes them —
 * a `comment` someone wrote, and a `system` line the app appended when the
 * status moved, a design was generated or a comment was pinned. The tabs at the
 * top of the thread are just a filter over that one list.
 *
 * A task that nobody has touched still reads as a thread: `seedTaskHistory`
 * derives an opening entry or two from the task itself. Those are not written
 * to storage until someone acts on them, so an untouched task costs nothing.
 */
import { type ProjectTask } from './tasks';

export type TaskEntryKind = 'comment' | 'system';

export interface TaskComment {
  id: string;
  kind: TaskEntryKind;
  /** Display name, as it is shown on the entry. */
  author: string;
  /** `YYYY-MM-DDTHH:mm`, so the list sorts as text and renders the same twice. */
  at: string;
  text: string;
  pinned?: boolean;
  /** Who liked it; the reader goes in and out as the button is pressed. */
  likes?: string[];
  /** Names only, like the chat keeps them. */
  attachments?: { name: string }[];
}

/**
 * Who "me" is. The mockup has one signed-in person — the planner in the app
 * shell — and the shell hides them inside a project, so the thread is the only
 * place their name shows up next to something they did.
 */
export const CURRENT_PERSON = '설욱환';

const KEY = 'we-adk:task-comments';

function storeKey(projectId: string, taskId: string): string {
  return `${KEY}:${projectId}:${taskId}`;
}

function isTaskCommentArray(value: unknown): value is TaskComment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { text?: unknown }).text === 'string',
    )
  );
}

/* ------------------------------------------------------------------ */
/* Seeded history                                                      */
/* ------------------------------------------------------------------ */

/**
 * The entries a task starts life with, derived from the task so they are the
 * same on every render: it was created, and — if it has moved on from Request
 * — the status change that got it where it is.
 */
export function seedTaskHistory(task: ProjectTask): TaskComment[] {
  const history: TaskComment[] = [
    {
      id: `${task.id}-seed-created`,
      kind: 'system',
      author: task.assignee,
      at: `${task.updatedAt}T09:12`,
      text: `${task.assignee} created [${task.code}].`,
    },
  ];

  if (task.status !== 'Request') {
    history.push({
      id: `${task.id}-seed-status`,
      kind: 'system',
      author: task.assignee,
      at: `${task.updatedAt}T10:56`,
      text: `'Request' → '${task.status}' Status has been updated.`,
    });
  }

  return history;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function readStored(projectId: string, taskId: string): TaskComment[] | null {
  try {
    const raw = window.localStorage.getItem(storeKey(projectId, taskId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTaskCommentArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(projectId: string, taskId: string, entries: TaskComment[]): TaskComment[] {
  const next = sortEntries(entries).slice(-200);
  try {
    window.localStorage.setItem(storeKey(projectId, taskId), JSON.stringify(next));
  } catch {
    // Storage unavailable — the thread simply won't survive a reload.
  }
  return next;
}

/** Oldest first, the way a thread reads. */
function sortEntries(entries: TaskComment[]): TaskComment[] {
  return [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** The thread as it should be shown: what was stored, or the seeded opening. */
export function loadTaskComments(projectId: string, task: ProjectTask): TaskComment[] {
  return sortEntries(readStored(projectId, task.id) ?? seedTaskHistory(task));
}

let counter = 0;

function mint(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** `YYYY-MM-DDTHH:mm` for right now, in local time — this is a wall clock. */
export function stampNow(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}`;
}

export function addTaskComment(
  projectId: string,
  task: ProjectTask,
  input: { author: string; text: string; attachments?: { name: string }[] },
): TaskComment[] {
  const comment: TaskComment = {
    id: mint('tc'),
    kind: 'comment',
    author: input.author,
    at: stampNow(),
    text: input.text,
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  };
  return write(projectId, task.id, [...loadTaskComments(projectId, task), comment]);
}

/** Appends one of the app's own lines — a status move, a generation, a pin. */
export function logTaskEvent(
  projectId: string,
  task: ProjectTask,
  text: string,
  author = CURRENT_PERSON,
): TaskComment[] {
  const entry: TaskComment = {
    id: mint('ts'),
    kind: 'system',
    author,
    at: stampNow(),
    text,
  };
  return write(projectId, task.id, [...loadTaskComments(projectId, task), entry]);
}

export function toggleTaskCommentLike(
  projectId: string,
  task: ProjectTask,
  entryId: string,
  actor = CURRENT_PERSON,
): TaskComment[] {
  const next = loadTaskComments(projectId, task).map((entry) => {
    if (entry.id !== entryId) return entry;
    const likes = entry.likes ?? [];
    return {
      ...entry,
      likes: likes.includes(actor) ? likes.filter((name) => name !== actor) : [...likes, actor],
    };
  });
  return write(projectId, task.id, next);
}

/**
 * Pins or unpins an entry. Pinning is worth a line of its own — that is what the
 * thread is for — so the caller gets told whether to log one.
 */
export function toggleTaskCommentPin(
  projectId: string,
  task: ProjectTask,
  entryId: string,
): { entries: TaskComment[]; pinned: boolean } {
  const current = loadTaskComments(projectId, task);
  const pinned = !current.find((entry) => entry.id === entryId)?.pinned;
  const next = current.map((entry) => (entry.id === entryId ? { ...entry, pinned } : entry));
  return { entries: write(projectId, task.id, next), pinned };
}

export function removeTaskComment(
  projectId: string,
  task: ProjectTask,
  entryId: string,
): TaskComment[] {
  return write(
    projectId,
    task.id,
    loadTaskComments(projectId, task).filter((entry) => entry.id !== entryId),
  );
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

/** `2026-07-06T10:18` → `06/07/2026 10:18`, the way the thread stamps a line. */
export function formatEntryTime(at: string): string {
  const [date, time = ''] = at.split('T');
  const [year, month, day] = (date ?? '').split('-');
  if (!year || !month || !day) return at;
  return `${day}/${month}/${year}${time ? ` ${time.slice(0, 5)}` : ''}`;
}

/** How many of the entries are things people wrote. */
export function commentCount(entries: TaskComment[]): number {
  return entries.filter((entry) => entry.kind === 'comment').length;
}
