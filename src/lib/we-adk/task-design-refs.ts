/**
 * Design files a task points at.
 *
 * Distinct from the designs a task *produced* (`task-design.ts`): this is the
 * other direction — the screens a developer needs to look at to build the
 * task. "Make the export button match the toolbar in 10-cash-receipt.html" is
 * a reference, and pasting a screenshot of it into the description is how that
 * link goes stale the moment the design moves.
 *
 * A reference identifies the design file itself — its file name and its id —
 * not the round it happens to sit in. The id is what the preview and the
 * canvas resolve, so the reference follows the file as it moves between
 * rounds rather than pointing at a copy that stops matching.
 */

export interface TaskDesignRef {
  /** Canvas id of the design file — what the preview resolves. */
  screenId: string;
  /** Screen name, as the design tree shows it. */
  name: string;
  /** File name, e.g. `10-cash-receipt.html`. */
  fileName: string;
  route?: string;
  /** Why it is attached — the one line the developer should read first. */
  note?: string;
  attachedAt: string;
}

function key(projectId: string, taskId: string): string {
  return `we-adk:task-design-refs:${projectId}:${taskId}`;
}

export function loadTaskDesignRefs(projectId: string, taskId: string): TaskDesignRef[] {
  try {
    const raw = window.localStorage.getItem(key(projectId, taskId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TaskDesignRef[]) : [];
  } catch {
    return [];
  }
}

function save(projectId: string, taskId: string, refs: TaskDesignRef[]): void {
  try {
    window.localStorage.setItem(key(projectId, taskId), JSON.stringify(refs));
  } catch {
    // Storage unavailable — the reference simply won't survive a reload.
  }
}

/**
 * Attaching the same design twice updates it rather than listing it twice —
 * two rows for one file is a list nobody can act on.
 */
export function attachTaskDesignRef(
  projectId: string,
  taskId: string,
  ref: Omit<TaskDesignRef, 'attachedAt'>,
): TaskDesignRef[] {
  const existing = loadTaskDesignRefs(projectId, taskId);
  const attachedAt = new Date().toISOString();
  const next = existing.some((entry) => entry.screenId === ref.screenId)
    ? existing.map((entry) =>
        entry.screenId === ref.screenId ? { ...entry, ...ref, attachedAt } : entry,
      )
    : [...existing, { ...ref, attachedAt }];
  save(projectId, taskId, next);
  return next;
}

export function detachTaskDesignRef(
  projectId: string,
  taskId: string,
  screenId: string,
): TaskDesignRef[] {
  const next = loadTaskDesignRefs(projectId, taskId).filter((entry) => entry.screenId !== screenId);
  save(projectId, taskId, next);
  return next;
}
