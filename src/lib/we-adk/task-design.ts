/**
 * A task as a brief for the screen generator.
 *
 * The task pane is where the work is described — title, description, category,
 * tags, and the files someone attached to explain it. That is already a brief;
 * this turns it into one Claude can read, and remembers which designs came out
 * of which task so the pane can link back to them.
 *
 * Files attached to a task are stored the same way meeting references are, under
 * a task-shaped folder key, so the existing attach/preview panel works unchanged.
 */
import { mergeReferenceText, type MeetingFile } from '@/lib/we-adk-mock/meeting-files';
import { type DesignProject } from '@/lib/we-adk-mock/projects';
import { type ProjectTask } from '@/lib/we-adk-mock/tasks';

/* ------------------------------------------------------------------ */
/* Files attached to a task                                            */
/* ------------------------------------------------------------------ */

/** Folder key for a task's attachments — a `sessionId` for the files store. */
export function taskFilesKey(projectId: string, taskId: string): string {
  return `task:${projectId}:${taskId}`;
}

/**
 * Folder key the screens a task generates are staged under.
 *
 * They start here rather than in anyone's workspace: a proposal is a sample
 * until someone has looked at it. Handing one over copies it into the workspace
 * of the person the task belongs to; the round sees it only when they merge.
 */
export function taskStageKey(projectId: string, taskId: string): string {
  return `task-designs:${projectId}:${taskId}`;
}

/* ------------------------------------------------------------------ */
/* The brief                                                           */
/* ------------------------------------------------------------------ */

export function priorityLabel(priority: 1 | 2 | 3): string {
  return priority === 1 ? 'High' : priority === 2 ? 'Medium' : 'Low';
}

function fileLine(file: MeetingFile): string {
  const parts: string[] = [file.kind];
  if (file.sizeKb !== undefined) parts.push(`${file.sizeKb} KB`);
  parts.push((file.text ?? '').trim().length > 0 ? 'text included below' : 'no extractable text');
  if (file.note) parts.push(file.note);
  return `- ${file.name} (${parts.join(', ')})`;
}

/**
 * Everything the task knows, as prose. This is the `notes` the generator reads,
 * so it has to stand on its own: what the work is, who it is for, what state it
 * is in, and what was attached to explain it.
 */
export function taskBrief(
  project: DesignProject,
  task: ProjectTask,
  files: MeetingFile[] = [],
): string {
  const parts: string[] = [
    `Design the screens for one task in ${project.name}, a product for ${project.customer}.`,
    '',
    `Task: [${task.code}] ${task.title}`,
    `Status: ${task.status} · Priority: ${priorityLabel(task.priority)} · Assignee: ${task.assignee} · Updated: ${task.updatedAt}`,
  ];

  if (task.category) parts.push(`Category: ${task.category}`);
  if (task.tags?.length) parts.push(`Tags: ${task.tags.join(', ')}`);
  if (task.count !== undefined) parts.push(`Items in scope: ${task.count}`);

  parts.push('', 'Description:', task.description?.trim() || '(none written on the task)');

  if (files.length > 0) {
    parts.push(
      '',
      `Attached files (${files.length}) — the reference material for this task:`,
      ...files.map(fileLine),
    );
  }

  parts.push(
    '',
    'What to design:',
    'The screens someone needs to actually finish this task in the product — the list they',
    'start from, the detail or form they work in, and any confirmation the flow needs.',
    'Use the wording of the task and its files for labels, columns and empty states rather',
    'than generic placeholders, and give tables real-looking rows for this customer.',
  );

  // The endpoint caps notes at 12000 characters.
  return parts.join('\n').slice(0, 11_800);
}

/** The attached files as one block of text for the generator's `references`. */
export function taskReferences(files: MeetingFile[]): {
  text: string;
  names: string[];
  read: number;
  truncated: boolean;
} {
  const merged = mergeReferenceText(files, 10_000);
  return {
    text: merged.text,
    names: files.map((file) => file.name).slice(0, 40),
    read: merged.used.length,
    truncated: merged.truncated,
  };
}

/* ------------------------------------------------------------------ */
/* What a task produced                                                */
/* ------------------------------------------------------------------ */

/** A design file generated from a task, remembered so the pane can link to it. */
export interface TaskDesign {
  screenId: string;
  name: string;
  route?: string;
  /**
   * Version folder it was moved into. Only set by the older path that published
   * straight into a round; kept so rows moved that way still read correctly.
   */
  version?: number;
  /**
   * Who it was handed to, and the copy that landed in their workspace. A design
   * generated from a task goes to the person the task belongs to — reaching Main
   * is their call, made by merging from the User tab.
   */
  handedTo?: { id: string; name: string; version: number; screenId: string };
  createdAt: string;
  /** When it was handed over or moved, for the line under the row. */
  movedAt?: string;
}

const DESIGNS_KEY = 'we-adk:task-designs';

function designsKey(projectId: string, taskId: string): string {
  return `${DESIGNS_KEY}:${projectId}:${taskId}`;
}

function isTaskDesignArray(value: unknown): value is TaskDesign[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { screenId?: unknown }).screenId === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string',
    )
  );
}

export function loadTaskDesigns(projectId: string, taskId: string): TaskDesign[] {
  try {
    const raw = window.localStorage.getItem(designsKey(projectId, taskId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isTaskDesignArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTaskDesigns(projectId: string, taskId: string, designs: TaskDesign[]): void {
  try {
    window.localStorage.setItem(designsKey(projectId, taskId), JSON.stringify(designs.slice(-40)));
  } catch {
    // Storage unavailable — the link back from the task simply won't persist.
  }
}

export function addTaskDesigns(
  projectId: string,
  taskId: string,
  designs: TaskDesign[],
): TaskDesign[] {
  const next = [...loadTaskDesigns(projectId, taskId), ...designs];
  saveTaskDesigns(projectId, taskId, next);
  return next;
}

/** Records that a copy of a sample now sits in someone's workspace. */
export function markTaskDesignHandedTo(
  projectId: string,
  taskId: string,
  screenId: string,
  handedTo: NonNullable<TaskDesign['handedTo']>,
  movedAt: string,
): TaskDesign[] {
  const next = loadTaskDesigns(projectId, taskId).map((design) =>
    design.screenId === screenId ? { ...design, handedTo, movedAt } : design,
  );
  saveTaskDesigns(projectId, taskId, next);
  return next;
}

export function removeTaskDesign(
  projectId: string,
  taskId: string,
  screenId: string,
): TaskDesign[] {
  const next = loadTaskDesigns(projectId, taskId).filter((entry) => entry.screenId !== screenId);
  saveTaskDesigns(projectId, taskId, next);
  return next;
}

/** Where a draft is meant to sit in the target project's IA, once placed. */
export interface DraftPlacement {
  /** Depth path of the parent screen, e.g. ['Accountant', 'Approval Queue']. */
  parentPath: string[];
  /** Parent screen's name, for showing the relationship without re-deriving it. */
  parentName: string;
  screenType: string;
  platform: string;
}

/** A staged design, with a line saying where it came from. */
export interface ProjectDraft extends TaskDesign {
  /** Shown under the name: the task, or the customer project it came from. */
  fromLabel: string;
  /** Set only on drafts generated from a task. */
  taskId?: string;
  /** Set only on drafts sent over with an agreed IA placement. */
  placement?: DraftPlacement;
}

/**
 * Drafts that belong to the project rather than to a task.
 *
 * A screen moved over from a Customer project has no task behind it, but it is
 * the same kind of thing — a screen waiting for a decision about which round it
 * belongs in. It is stored per project rather than being given a fake task.
 */
const PROJECT_DRAFTS_KEY = 'we-adk:project-drafts';

function projectDraftsKey(projectId: string): string {
  return `${PROJECT_DRAFTS_KEY}:${projectId}`;
}


export interface StandaloneDraft extends TaskDesign {
  fromLabel: string;
  /**
   * Agreed before the move, not after: a screen arriving with no idea where it
   * belongs is the thing that makes a Drafts pile hard to clear.
   */
  placement?: DraftPlacement;
}

export function loadStandaloneDrafts(projectId: string): StandaloneDraft[] {
  try {
    const raw = window.localStorage.getItem(projectDraftsKey(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StandaloneDraft[]) : [];
  } catch {
    return [];
  }
}

/** Adds a draft that came from somewhere other than a task. */
export function addStandaloneDraft(projectId: string, draft: StandaloneDraft): StandaloneDraft[] {
  const next = [...loadStandaloneDrafts(projectId), draft];
  try {
    window.localStorage.setItem(projectDraftsKey(projectId), JSON.stringify(next.slice(-60)));
  } catch {
    // Storage full — the draft still exists for this session.
  }
  return next;
}

/**
 * Records that a draft has gone into a round.
 *
 * Marked rather than deleted: the row is the history of where the screen came
 * from, and `loadProjectDrafts` already skips anything carrying a version, so
 * a filed draft leaves the pile without losing what it was.
 */
export function markStandaloneDraftFiled(
  projectId: string,
  screenId: string,
  version: number,
  movedAt: string,
): StandaloneDraft[] {
  const next = loadStandaloneDrafts(projectId).map((draft) =>
    draft.screenId === screenId ? { ...draft, version, movedAt } : draft,
  );
  try {
    window.localStorage.setItem(projectDraftsKey(projectId), JSON.stringify(next));
  } catch {
    // Storage full — the move is correct for this session either way.
  }
  return next;
}

/** The same, for a draft that was generated from a task. */
export function markTaskDesignFiled(
  projectId: string,
  taskId: string,
  screenId: string,
  version: number,
  movedAt: string,
): TaskDesign[] {
  const next = loadTaskDesigns(projectId, taskId).map((design) =>
    design.screenId === screenId ? { ...design, version, movedAt } : design,
  );
  saveTaskDesigns(projectId, taskId, next);
  return next;
}

export function removeStandaloneDraft(projectId: string, screenId: string): StandaloneDraft[] {
  const next = loadStandaloneDrafts(projectId).filter((draft) => draft.screenId !== screenId);
  try {
    window.localStorage.setItem(projectDraftsKey(projectId), JSON.stringify(next));
  } catch {
    // Nothing to do — the list is correct for this session either way.
  }
  return next;
}

/**
 * Every design generated from a task in this project — what the Request tab
 * shows.
 *
 * Designs are stored per task, which is right for the task pane but means
 * nobody can see the project's whole pile of unplaced work. This gathers them,
 * newest first, and keeps the task each came from attached: a request with no
 * idea what it was for cannot be judged.
 *
 * A design that has been handed to someone is no longer waiting here — it is in
 * their workspace, and reaching Main is their decision from there.
 *
 * `includeFiled` keeps the ones already moved into a round. The tab wants them:
 * a row that vanishes the moment you move it leaves you wondering whether the
 * click worked, where a row that stays and goes quiet says plainly that it did.
 */
export function loadProjectDrafts(
  projectId: string,
  tasks: { id: string; code: string; title: string }[],
  options?: { includeFiled?: boolean },
): ProjectDraft[] {
  const keep = (design: TaskDesign) => options?.includeFiled || design.version === undefined;
  const drafts: ProjectDraft[] = [];
  for (const task of tasks) {
    for (const design of loadTaskDesigns(projectId, task.id)) {
      if (design.handedTo || !keep(design)) continue;
      drafts.push({ ...design, taskId: task.id, fromLabel: `[${task.code}] ${task.title}` });
    }
  }
  // Screens moved in from a Customer project sit alongside them — same waiting
  // room, different door.
  for (const draft of loadStandaloneDrafts(projectId)) {
    if (!keep(draft)) continue;
    drafts.push(draft);
  }
  return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
