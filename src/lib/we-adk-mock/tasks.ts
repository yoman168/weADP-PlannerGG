/**
 * Mock task data for the Task tab in the Business workspace.
 *
 * Each project carries a flat list of tasks — bug fixes, feature requests,
 * change requests — each with a code, title, status, and optional count.
 */
import { type Chip } from './types';
import {
  BASELINE_VERSION,
  isVersionLocked,
  loadRemovedVersions,
  loadVersionCount,
  loadVersionStatuses,
} from './versions';
import { workspaceStore } from '@/lib/api/workspace-store';

export type TaskStatus = 'Complete' | 'Request' | 'Progress' | 'Feedback';

export type TaskCategory =
  'Research' | 'Design' | 'Development' | 'Testing' | 'Documentation' | 'Other';

/**
 * Who verifies the task once it is built.
 *
 * A real choice, not a label: AI testing is cheap and repeatable but blind to
 * intent, human testing is the opposite, and some work wants both. Recording
 * it on the task means a reviewer can see whether "Complete" was checked by a
 * person, a machine, or nobody yet.
 */
export type TestedBy = 'Human' | 'AI' | 'Both' | 'Not tested';

export const TESTED_BY_OPTIONS: TestedBy[] = ['Not tested', 'Human', 'AI', 'Both'];

export const TASK_CATEGORIES: TaskCategory[] = [
  'Research',
  'Design',
  'Development',
  'Testing',
  'Documentation',
  'Other',
];

const STATUS_CHIPS: Record<TaskStatus, Chip> = {
  Complete: { label: 'Complete', tone: 'green' },
  Request: { label: 'Request', tone: 'blue' },
  Progress: { label: 'Progress', tone: 'green' },
  Feedback: { label: 'Feedback', tone: 'amber' },
};

export function taskStatusChip(status: TaskStatus): Chip {
  return STATUS_CHIPS[status];
}

export interface ProjectTask {
  id: string;
  /** Short code shown in brackets, e.g. "F2_09", "AB1". */
  code: string;
  /** Task title / description. */
  title: string;
  /** Optional count shown in parentheses after the title. */
  count?: number;
  status: TaskStatus;
  /** Assignee name. */
  assignee: string;
  /** Date the task was created or last updated. */
  updatedAt: string;
  /** Priority: 1 = highest, 3 = lowest. */
  priority: 1 | 2 | 3;
  /** Longer description shown in the detail panel. */
  description?: string;
  /** Tags / labels for filtering. */
  tags?: string[];
  /** What the task is about: research, design, development, etc. */
  category?: TaskCategory;
  /** Who verifies it. Absent means the question has not been answered yet. */
  testedBy?: TestedBy;
  /**
   * The person doing the human testing, when a human is doing any of it.
   *
   * Separate from `assignee`: the point of human verification is that someone
   * other than the builder looks at it, so the two are different questions and
   * deserve different answers.
   */
  tester?: string;
  /**
   * The round this task belongs to — the same versions the design rounds use,
   * not a second numbering. A project runs several rounds and each carries its
   * own tasks, so "what shipped in version 2" is a question the board answers.
   *
   * Absent means unscheduled: raised, but not yet put in a round.
   */
  version?: number;
}

/** Tasks keyed by project id. */
export const PROJECT_TASKS: Record<string, ProjectTask[]> = {
  'proj-eacc-cloud': [
    {
      id: 'task-dev-01',
      code: 'DEV_01',
      title: 'CSV export for the cash receipt list',
      status: 'Progress',
      assignee: 'Chheng Udam',
      updatedAt: '2026-08-04',
      priority: 1,
      description:
        'Accountants need to export the filtered receipt list as CSV from the toolbar. Columns and formatting must match what the table shows — dates and currency included — and the export must respect the active filters, not dump the whole dataset.',
      tags: ['feature', 'cash-receipt', 'export'],
      category: 'Development',
      testedBy: 'AI',
      version: 2,
    },
    {
      id: 'task-dev-02',
      code: 'DEV_02',
      title: 'Bulk approve on the corporate card screen',
      count: 3,
      status: 'Progress',
      assignee: 'Chheng Udam',
      updatedAt: '2026-08-03',
      priority: 1,
      description:
        'The card screen approves one expense at a time; team leads asked for select-all with a bulk approve action. Includes the checkbox column, the sticky action bar, and a confirm step showing the total amount being approved.',
      tags: ['feature', 'corp-card'],
      category: 'Development',
      testedBy: 'Human',
      tester: 'Seongmin Yoo',
      version: 2,
    },
    {
      id: 'task-dev-03',
      code: 'DEV_03',
      title: 'Dashboard loads slowly with 12 months of history',
      status: 'Request',
      assignee: 'Seongmin Yoo',
      updatedAt: '2026-08-01',
      priority: 2,
      description:
        'The spend-by-category chart recomputes on every render once an account has a full year of activity. Memoise the aggregation and move the month grouping out of the component body.',
      tags: ['performance', 'dashboard'],
      category: 'Development',
      testedBy: 'AI',
      version: 2,
    },
    {
      id: 'task-dev-04',
      code: 'DEV_04',
      title: 'Keyboard navigation in the approval queue',
      status: 'Request',
      assignee: 'Moka',
      updatedAt: '2026-07-31',
      priority: 3,
      description:
        'Reviewers work the queue top to bottom; arrow keys should move the selection and A/R should approve or return the focused item. Focus must stay visible and the shortcuts must not fire while a text field is active.',
      tags: ['feature', 'approvals', 'a11y'],
      category: 'Development',
      testedBy: 'Human',
      tester: 'Moka',
      // The round being worked on. It used to say 3 — a round Business has
      // never opened, and the only thing that put a third version on the rail.
      version: 2,
    },
    {
      id: 'task-dev-05',
      code: 'DEV_05',
      title: 'Login error states do not match the design round',
      status: 'Feedback',
      assignee: 'Chheng Udam',
      updatedAt: '2026-07-30',
      priority: 2,
      description:
        'A wrong password renders a browser alert instead of the inline field error the round specifies. Bring the error and disabled states in line with DESIGN.md — no colours or radii outside the system.',
      tags: ['bug', 'login', 'design-conformance'],
      category: 'Development',
      testedBy: 'Both',
      tester: 'Seongmin Yoo',
      version: 1,
    },
    {
      id: 'task-dev-06',
      code: 'DEV_06',
      title: 'Receipt attachments over 10MB fail silently',
      status: 'Progress',
      assignee: 'Chheng Udam',
      updatedAt: '2026-08-05',
      priority: 1,
      description:
        'Attaching a scan larger than 10MB leaves the row looking saved, but the file never reaches storage and the receipt cannot be approved. The limit must be enforced before upload with a clear message, and anything already stranded needs a repair path.',
      tags: ['bug', 'cash-receipt', 'uploads'],
      category: 'Development',
      testedBy: 'Both',
      tester: 'Seongmin Yoo',
      version: 2,
    },
    {
      id: 'task-dev-07',
      code: 'DEV_07',
      title: 'Two-factor enrolment for finance approvers',
      status: 'Progress',
      assignee: 'Seongmin Yoo',
      updatedAt: '2026-08-06',
      priority: 1,
      description:
        'Anyone who can approve money movement enrols in TOTP before their next approval. Covers the enrolment screen, recovery codes, and a grace window so nobody is locked out mid-close.',
      tags: ['feature', 'security', 'approvals'],
      category: 'Development',
      testedBy: 'Both',
      tester: 'Moka',
      version: 2,
    },
    {
      id: 'task-dev-08',
      code: 'DEV_08',
      title: 'Month-end close checklist export',
      status: 'Complete',
      assignee: 'Moka',
      updatedAt: '2026-08-04',
      priority: 2,
      description:
        'Accountants send the close checklist to the auditor as a PDF each month. Export the checklist with its blockers, owners and sign-off timestamps, in the order the close screen shows them.',
      tags: ['feature', 'close', 'export'],
      category: 'Development',
      testedBy: 'AI',
      version: 2,
    },
    {
      id: 'task-dev-09',
      code: 'DEV_09',
      title: 'Audit trail for approval overrides',
      status: 'Request',
      assignee: 'Seongmin Yoo',
      updatedAt: '2026-08-06',
      priority: 2,
      description:
        'When an approver overrides a policy warning, record who did it, what the warning said and the reason they gave. The trail is read by the auditor, so entries cannot be edited or deleted once written.',
      tags: ['feature', 'approvals', 'audit'],
      category: 'Development',
      testedBy: 'Human',
      tester: 'Seongmin Yoo',
      version: 2,
    },
  ],
  'proj-hd-trip': [
    {
      id: 'task-hd-crew',
      code: 'HD1',
      title: 'Crew member addition after submit',
      status: 'Request',
      assignee: 'Seongmin Yoo',
      updatedAt: '2026-07-30',
      priority: 1,
      description:
        'Allow adding a crew member to a submitted trip plan without starting over. Identified in UAT.',
      tags: ['feature', 'trip'],
    },
    {
      id: 'task-hd-wording',
      code: 'HD2',
      title: 'Approval status wording clarification',
      status: 'Progress',
      assignee: 'Seongmin Yoo',
      updatedAt: '2026-07-31',
      priority: 2,
      description: 'Replace "in approval" with clearer wording. Pilot users found it ambiguous.',
      tags: ['ux', 'wording'],
    },
    {
      id: 'task-hd-dup',
      code: 'HD3',
      title: 'Duplicate last trip feature',
      status: 'Progress',
      assignee: 'Seongmin Yoo',
      updatedAt: '2026-07-31',
      priority: 1,
      description:
        "Let users duplicate last month's trip. Requested during UAT — three users nodded.",
      tags: ['feature', 'trip'],
    },
  ],
  'proj-nonghyup-loan': [
    {
      id: 'task-nh-identity',
      code: 'NH1',
      title: 'Identity check before product comparison',
      status: 'Progress',
      assignee: 'Moka',
      updatedAt: '2026-07-30',
      priority: 1,
      description:
        'Compliance requires identity verification before any loan product is shown. Move the identity check screen ahead of comparison.',
      tags: ['compliance', 'flow'],
    },
    {
      id: 'task-nh-consent',
      code: 'NH2',
      title: 'Credit enquiry consent screen',
      status: 'Request',
      assignee: 'Moka',
      updatedAt: '2026-07-30',
      priority: 1,
      description:
        'Separate consent step for credit enquiry. Blocked on legal providing exact wording.',
      tags: ['compliance', 'legal'],
    },
  ],
};

/** Look up tasks for a project. Returns an empty array for projects without tasks. */
export function projectTasks(projectId: string): ProjectTask[] {
  return PROJECT_TASKS[projectId] ?? [];
}

/* ------------------------------------------------------------------ */
/* User-created tasks (workspace state)                                   */
/* ------------------------------------------------------------------ */

const USER_TASKS_KEY = 'we-adk:user-tasks';

export function loadUserTasks(projectId: string): ProjectTask[] {
  try {
    const raw = workspaceStore.getItem(`${USER_TASKS_KEY}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProjectTask[]) : [];
  } catch {
    return [];
  }
}

export function saveUserTasks(projectId: string, tasks: ProjectTask[]): void {
  try {
    workspaceStore.setItem(`${USER_TASKS_KEY}:${projectId}`, JSON.stringify(tasks));
  } catch {}
}

let taskCounter = 0;

export function createTask(
  projectId: string,
  fields: {
    title: string;
    status: TaskStatus;
    assignee: string;
    priority: 1 | 2 | 3;
    description?: string;
    tags?: string[];
    category?: TaskCategory;
    testedBy?: TestedBy;
    tester?: string;
    /** Which round it lands in. Defaults to the one that is open. */
    version?: number | null;
  },
): ProjectTask {
  taskCounter += 1;
  const task: ProjectTask = {
    id: `task-user-${Date.now().toString(36)}-${taskCounter}`,
    code: `U${taskCounter}`,
    title: fields.title,
    status: fields.status,
    assignee: fields.assignee,
    updatedAt: new Date().toISOString().slice(0, 10),
    priority: fields.priority,
    description: fields.description,
    category: fields.category,
    tags: fields.tags,
    testedBy: fields.testedBy,
    tester: fields.tester || undefined,
    // A new task belongs to the round being worked on; a shipped round takes
    // no new work, so it is never the default.
    version: fields.version === null ? undefined : (fields.version ?? openRound(projectId)),
  };
  const current = loadUserTasks(projectId);
  saveUserTasks(projectId, [task, ...current]);
  return task;
}

export function updateTask(projectId: string, updated: ProjectTask): void {
  const current = loadUserTasks(projectId);
  const next = current.map((t) => (t.id === updated.id ? updated : t));
  saveUserTasks(projectId, next);
}

export function deleteTask(projectId: string, taskId: string): void {
  const current = loadUserTasks(projectId);
  saveUserTasks(
    projectId,
    current.filter((t) => t.id !== taskId),
  );
}

/** Whether a task was created by the user (vs seeded mock data). */
export function isUserTask(taskId: string): boolean {
  return taskId.startsWith('task-user-');
}

/**
 * Whether a build owns this task.
 *
 * A build needs a task — it is what the build is keyed on, and where its code
 * and title come from — but that does not make it board work. Completing a round
 * raises one per file of new work and every reported fix raises another, so the
 * board fills with rows nobody filed and nobody triages, burying the handful
 * that a person actually wrote down. The task boards filter these out; the Build
 * tab, which is where they belong, does not.
 *
 * Read off the id rather than the tags or the code, because the id is assigned
 * by the two functions that raise builds and nothing else writes that prefix —
 * a tag can be edited and `FIX_` is a label someone could type.
 */
export function isBuildTask(taskId: string): boolean {
  return taskId.startsWith('task-bld-') || taskId.startsWith('task-fix-');
}

/* ------------------------------------------------------------------ */
/* Status moved on a seeded task                                       */
/* ------------------------------------------------------------------ */

/**
 * A seeded task cannot be rewritten — it is module data — but its status is a
 * control someone can move, and the thread under the task records that they
 * did. So the move is kept beside the task instead of inside it, and laid over
 * the seeded list wherever it is read.
 */
const STATUS_OVERRIDE_KEY = 'we-adk:task-status';

export type TaskStatusOverrides = Record<string, TaskStatus>;

export function loadTaskStatusOverrides(projectId: string): TaskStatusOverrides {
  try {
    const raw = workspaceStore.getItem(`${STATUS_OVERRIDE_KEY}:${projectId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as TaskStatusOverrides) : {};
  } catch {
    return {};
  }
}

export function setTaskStatusOverride(
  projectId: string,
  taskId: string,
  status: TaskStatus,
): TaskStatusOverrides {
  const next = { ...loadTaskStatusOverrides(projectId), [taskId]: status };
  try {
    workspaceStore.setItem(`${STATUS_OVERRIDE_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the move simply won't survive a reload.
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Who it is assigned to                                               */
/* ------------------------------------------------------------------ */

const ASSIGNMENT_KEY = 'we-adk:task-assignment';

export interface TaskAssignment {
  assignee?: string;
  tester?: string;
}

export type TaskAssignmentOverrides = Record<string, TaskAssignment>;

export function loadTaskAssignmentOverrides(projectId: string): TaskAssignmentOverrides {
  try {
    const raw = workspaceStore.getItem(`${ASSIGNMENT_KEY}:${projectId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as TaskAssignmentOverrides) : {};
  } catch {
    return {};
  }
}

/**
 * Stored as an override rather than written onto the task, for the same reason
 * status moves are: the seeded tasks are constants, and reassignment has to
 * survive a reload on those too. Patched rather than replaced so setting a
 * tester does not clear the assignee.
 */
export function setTaskAssignmentOverride(
  projectId: string,
  taskId: string,
  patch: TaskAssignment,
): TaskAssignmentOverrides {
  const current = loadTaskAssignmentOverrides(projectId);
  const next = { ...current, [taskId]: { ...current[taskId], ...patch } };
  try {
    workspaceStore.setItem(`${ASSIGNMENT_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the reassignment simply won't survive a reload.
  }
  return next;
}

export function applyTaskAssignmentOverrides(
  tasks: ProjectTask[],
  overrides: TaskAssignmentOverrides,
): ProjectTask[] {
  return tasks.map((task) => {
    const patch = overrides[task.id];
    if (!patch) return task;
    return {
      ...task,
      assignee: patch.assignee ?? task.assignee,
      // An empty string is "nobody", which is a real answer and must not fall
      // back to whatever the task was seeded with.
      tester: patch.tester === undefined ? task.tester : patch.tester || undefined,
    };
  });
}

/** Whether a human is part of verifying this task. */
export function needsHumanTester(testedBy: TestedBy | undefined): boolean {
  return testedBy === 'Human' || testedBy === 'Both';
}

/* ------------------------------------------------------------------ */
/* Which round it belongs to                                           */
/* ------------------------------------------------------------------ */

/**
 * The round new work lands in: the newest one that has not shipped.
 *
 * Imported lazily through a function rather than at module scope because the
 * versions module reads workspace state, and this file is also imported on the
 * server where that does not exist.
 */
/**
 * The rounds a task can be put in, newest first — exactly the rounds Business
 * has, and a round it dropped is not one of them.
 *
 * Business owns the rounds: it is the tab that opens and ships them, so this
 * reads its store and nothing else. It used to widen the list to cover the
 * highest round any task named, which is how the rail grew a version Business
 * had never opened — one stray number on one task invented a round, and it sat
 * there reading "In progress" next to the round actually being worked on, two
 * open rounds in a model that allows one. A task pointing at a round that does
 * not exist is a task out of the rounds; it is not a reason to make one.
 */
export function projectRounds(projectId: string): number[] {
  const count = Math.max(loadVersionCount(projectId), BASELINE_VERSION);
  const removed = loadRemovedVersions(projectId);
  const rounds: number[] = [];
  for (let version = count; version >= BASELINE_VERSION; version -= 1) {
    if (!removed.includes(version)) rounds.push(version);
  }
  return rounds;
}

function openRound(projectId: string): number | undefined {
  try {
    const statuses = loadVersionStatuses(projectId);
    return projectRounds(projectId).find((version) => !isVersionLocked(version, statuses));
  } catch {
    return undefined;
  }
}

const VERSION_KEY = 'we-adk:task-version';

/** `null` is a deliberate answer — "taken out of every round" — so it is stored. */
export type TaskVersionOverrides = Record<string, number | null>;

export function loadTaskVersionOverrides(projectId: string): TaskVersionOverrides {
  try {
    const raw = workspaceStore.getItem(`${VERSION_KEY}:${projectId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as TaskVersionOverrides) : {};
  } catch {
    return {};
  }
}

export function setTaskVersionOverride(
  projectId: string,
  taskId: string,
  version: number | null,
): TaskVersionOverrides {
  const next = { ...loadTaskVersionOverrides(projectId), [taskId]: version };
  try {
    workspaceStore.setItem(`${VERSION_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the move simply won't survive a reload.
  }
  return next;
}

export function applyTaskVersionOverrides(
  tasks: ProjectTask[],
  overrides: TaskVersionOverrides,
): ProjectTask[] {
  return tasks.map((task) =>
    task.id in overrides ? { ...task, version: overrides[task.id] ?? undefined } : task,
  );
}

export interface TaskVersionGroup {
  /** Null is the unscheduled group, which sorts last. */
  version: number | null;
  tasks: ProjectTask[];
}

/**
 * Tasks by round, newest first, with the unscheduled ones last.
 *
 * Grouping rather than filtering, because the question the board is asked is
 * "what is in each round" — a filter answers it one round at a time and hides
 * the shape of the release.
 */
export function groupTasksByVersion(tasks: ProjectTask[]): TaskVersionGroup[] {
  const groups = new Map<number | null, ProjectTask[]>();
  for (const task of tasks) {
    const key = task.version ?? null;
    const existing = groups.get(key);
    if (existing) existing.push(task);
    else groups.set(key, [task]);
  }
  return [...groups.entries()]
    .map(([version, entries]) => ({ version, tasks: entries }))
    .sort((a, b) => {
      if (a.version === null) return 1;
      if (b.version === null) return -1;
      return b.version - a.version;
    });
}

/* ------------------------------------------------------------------ */
/* Who tests it                                                        */
/* ------------------------------------------------------------------ */

const TESTED_BY_KEY = 'we-adk:task-tested-by';

export type TestedByOverrides = Record<string, TestedBy>;

export function loadTestedByOverrides(projectId: string): TestedByOverrides {
  try {
    const raw = workspaceStore.getItem(`${TESTED_BY_KEY}:${projectId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as TestedByOverrides) : {};
  } catch {
    return {};
  }
}

/**
 * Answering "who tests this?" is a decision people flip as work moves, so it
 * is stored the way a status move is rather than only being reachable through
 * the edit form.
 */
export function setTestedByOverride(
  projectId: string,
  taskId: string,
  testedBy: TestedBy,
): TestedByOverrides {
  const next = { ...loadTestedByOverrides(projectId), [taskId]: testedBy };
  try {
    workspaceStore.setItem(`${TESTED_BY_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the choice simply won't survive a reload.
  }
  return next;
}

export function applyTestedByOverrides(
  tasks: ProjectTask[],
  overrides: TestedByOverrides,
): ProjectTask[] {
  return tasks.map((task) =>
    overrides[task.id] ? { ...task, testedBy: overrides[task.id]! } : task,
  );
}

/** The list as it should read now, with any moved statuses applied. */
export function applyTaskStatusOverrides(
  tasks: ProjectTask[],
  overrides: TaskStatusOverrides,
): ProjectTask[] {
  return tasks.map((task) =>
    overrides[task.id] && overrides[task.id] !== task.status
      ? { ...task, status: overrides[task.id]! }
      : task,
  );
}
