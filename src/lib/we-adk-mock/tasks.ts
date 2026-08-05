/**
 * Mock task data for the Task tab in the Business workspace.
 *
 * Each project carries a flat list of tasks — bug fixes, feature requests,
 * change requests — each with a code, title, status, and optional count.
 */
import { type Chip } from './types';

export type TaskStatus = 'Complete' | 'Request' | 'Progress' | 'Feedback';

export type TaskCategory =
  'Research' | 'Design' | 'Development' | 'Testing' | 'Documentation' | 'Other';

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
}

/** Tasks keyed by project id. */
export const PROJECT_TASKS: Record<string, ProjectTask[]> = {
  'proj-eacc-cloud': [
    {
      id: 'task-f2-09',
      code: 'F2_09',
      title: 'Do not display Bills that have negative value in the remaining',
      status: 'Complete',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-15',
      priority: 2,
      description:
        'Bills with a negative remaining value should be hidden from the list view. The accountant workshop flagged this — negative values confuse the month-end close checklist.',
      tags: ['bug', 'bills'],
    },
    {
      id: 'task-ab1',
      code: 'AB1',
      title: 'Attendance',
      status: 'Request',
      assignee: 'Namwon Moon',
      updatedAt: '2026-07-28',
      priority: 2,
      description:
        'Add an attendance tracking module. The travel desk needs to reconcile trip plans against actual attendance records.',
      tags: ['feature', 'attendance'],
    },
    {
      id: 'task-aa1',
      code: 'AA1',
      title: 'Services',
      count: 1,
      status: 'Request',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-27',
      priority: 3,
      description:
        'Integrate external services API for invoice validation. One service endpoint needs to be connected.',
      tags: ['feature', 'services'],
    },
    {
      id: 'task-d6-04',
      code: 'D6_04',
      title: 'DAELYUK - Page Break Issue When Printing',
      status: 'Complete',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-10',
      priority: 1,
      description:
        'Page breaks were not rendering correctly when printing tax invoices. Fixed the CSS print media query to handle multi-page documents.',
      tags: ['bug', 'printing'],
    },
    {
      id: 'task-d7',
      code: 'D7',
      title: 'Bills',
      count: 31,
      status: 'Progress',
      assignee: 'Namwon Moon',
      updatedAt: '2026-07-29',
      priority: 1,
      description:
        'Batch of 31 bill-related improvements. Includes column reordering, default filters, and the receipt number replacement from the June change request.',
      tags: ['feature', 'bills'],
    },
    {
      id: 'task-z1',
      code: 'Z1',
      title: 'Standard Mobile',
      count: 2,
      status: 'Request',
      assignee: 'Moka',
      updatedAt: '2026-07-25',
      priority: 2,
      description:
        'Two mobile-specific layout adjustments for the standard expense screens. Touch targets too small on the approval buttons.',
      tags: ['feature', 'mobile'],
    },
    {
      id: 'task-f2',
      code: 'F2',
      title: 'Payment Deposits',
      count: 12,
      status: 'Request',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-26',
      priority: 2,
      description:
        'Twelve deposit-related tasks covering auto-matching, duplicate detection, and the settlement date display the accountants asked for.',
      tags: ['feature', 'payment'],
    },
    {
      id: 'task-v3',
      code: 'V3',
      title: 'Multiple Language (ML)',
      count: 14,
      status: 'Request',
      assignee: 'Moka',
      updatedAt: '2026-07-24',
      priority: 2,
      description:
        'Fourteen translation entries need adding for the new screens. Khmer and English are the priority; Korean follows.',
      tags: ['feature', 'i18n'],
    },
    {
      id: 'task-v2',
      code: 'V2',
      title: 'Multiple Language (ML)',
      count: 50,
      status: 'Complete',
      assignee: 'Moka',
      updatedAt: '2026-07-12',
      priority: 2,
      description:
        'Previous batch of 50 translation strings. All delivered and verified across Khmer and English.',
      tags: ['feature', 'i18n'],
    },
    {
      id: 'task-y1',
      code: 'Y1',
      title: 'Settings -> Zalo OA',
      count: 1,
      status: 'Request',
      assignee: 'Namwon Moon',
      updatedAt: '2026-07-23',
      priority: 3,
      description:
        'Connect the Zalo Official Account settings page. One integration point for push notifications.',
      tags: ['feature', 'settings'],
    },
    {
      id: 'task-d6',
      code: 'D6',
      title: 'Bills',
      count: 50,
      status: 'Progress',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-28',
      priority: 1,
      description:
        'Major bills overhaul — 50 items covering list performance, search, and the new close-status screen from the accountant workshop.',
      tags: ['feature', 'bills'],
    },
    {
      id: 'task-c3-15',
      code: 'C3_15',
      title: 'PROD - Error upload customer with customer ID is number, error',
      status: 'Complete',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-08',
      priority: 1,
      description:
        'Customer upload failed when the customer ID was numeric. The validation regex expected at least one letter. Fixed to accept all-numeric IDs.',
      tags: ['bug', 'customer'],
    },
    {
      id: 'task-f1-39',
      code: 'F1_39',
      title: 'PROD - Cannot scraping Shinhan bank',
      status: 'Complete',
      assignee: 'Namwon Moon',
      updatedAt: '2026-07-05',
      priority: 1,
      description:
        'Shinhan bank scraping broke after their site redesign. Updated the scraper selectors and added a health-check endpoint.',
      tags: ['bug', 'scraping'],
    },
    {
      id: 'task-d5-29',
      code: 'D5_29',
      title: 'PROD - Daelyuk - Error display payment result',
      status: 'Feedback',
      assignee: 'Taehyuk Park',
      updatedAt: '2026-07-20',
      priority: 2,
      description:
        'Payment result screen shows incorrect totals when multiple currencies are involved. Awaiting feedback from the Daelyuk team on expected behaviour for mixed-currency settlements.',
      tags: ['bug', 'payment'],
    },
    {
      id: 'task-w1',
      code: 'W1',
      title: 'Admin -> Report',
      count: 3,
      status: 'Progress',
      assignee: 'Namwon Moon',
      updatedAt: '2026-07-29',
      priority: 2,
      description:
        'Three new admin reports: monthly expense summary, per-department breakdown, and approval turnaround time.',
      tags: ['feature', 'admin'],
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
/* User-created tasks (localStorage)                                   */
/* ------------------------------------------------------------------ */

const USER_TASKS_KEY = 'we-adk:user-tasks';

export function loadUserTasks(projectId: string): ProjectTask[] {
  try {
    const raw = window.localStorage.getItem(`${USER_TASKS_KEY}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProjectTask[]) : [];
  } catch {
    return [];
  }
}

export function saveUserTasks(projectId: string, tasks: ProjectTask[]): void {
  try {
    window.localStorage.setItem(`${USER_TASKS_KEY}:${projectId}`, JSON.stringify(tasks));
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
    const raw = window.localStorage.getItem(`${STATUS_OVERRIDE_KEY}:${projectId}`);
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
    window.localStorage.setItem(`${STATUS_OVERRIDE_KEY}:${projectId}`, JSON.stringify(next));
  } catch {
    // Storage unavailable — the move simply won't survive a reload.
  }
  return next;
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
