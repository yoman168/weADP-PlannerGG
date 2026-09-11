/**
 * The QA service — seeded test cases, and everything that happens to them.
 *
 * Every screen in the QA tab reads through this module; nothing in the
 * components invents data. Swapping it for a real service — a test runner, an
 * agent, a bug tracker — means replacing these functions and nothing else.
 *
 * Seeds are static and overlays are workspace state, the same pattern the
 * task board uses: the seeded case is the fact, the overlay is what has
 * happened to it in this browser. Bugs and extra evidence are overlay-only.
 *
 * The ecosystem links are real: a bug sent to Developer writes an actual task
 * into the store the Developer tab reads, and verifying the fix closes that
 * task. QA is a room in the same house, not an annex.
 */

import {
  type AIResult,
  type Bug,
  type BugSeverity,
  type QARun,
  type QAStats,
  type TestCase,
  type TestEvidence,
  type TestStatus,
} from '@/lib/we-adk/qa-types';
import { isSeededProject } from './projects';
import { seedFixBuild } from './build-seeds';
import { loadUserTasks, saveUserTasks, setTaskStatusOverride, type ProjectTask } from './tasks';
import { workspaceStore } from '@/lib/api/workspace-store';

/* ------------------------------------------------------------------ */
/* Seeded test cases                                                   */
/* ------------------------------------------------------------------ */

interface SeedCase {
  n: number;
  module: string;
  title: string;
  description: string;
  precondition: string;
  steps: string[];
  expected: string;
  type: TestCase['testType'];
  priority: TestCase['priority'];
  assignee: string;
  requirement?: string;
  designId?: string;
  devTask?: string;
  screen?: string;
  /**
   * What an AI run of this case finds. Deterministic per case, so the demo
   * tells the same story twice — a couple of cases fail on purpose, because a
   * QA tab where everything passes teaches nobody the failure flow.
   */
  ai?: { verdict: 'Failed' | 'Blocked'; actual: string; analysis: string; failStep: number };
}

const SEEDS: SeedCase[] = [
  {
    n: 1,
    module: 'Login',
    title: 'Wrong password shows the inline field error',
    description: 'The round replaced the browser alert with an inline error under the field.',
    precondition: 'A registered user exists; the tester is signed out.',
    steps: ['Open the login screen', 'Enter a valid email and a wrong password', 'Submit the form'],
    expected:
      'An inline error appears under the password field; no browser alert; submit re-enables after edit.',
    type: 'Functional',
    priority: 'High',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-003',
    designId: 'proto-login',
    devTask: 'DEV_05',
    screen: 'proto-login',
  },
  {
    n: 2,
    module: 'Login',
    title: 'Submit stays disabled while signing in',
    description: 'Double submission created duplicate sessions in UAT.',
    precondition: 'The tester is signed out.',
    steps: [
      'Open the login screen',
      'Enter valid credentials',
      'Submit and watch the button state',
    ],
    expected: 'The button disables until the response lands; a second click does nothing.',
    type: 'UI',
    priority: 'Medium',
    assignee: 'Moka',
    requirement: 'REQ-003',
    designId: 'proto-login',
    screen: 'proto-login',
  },
  {
    n: 10,
    module: 'Approvals',
    title: 'Reject flow functional + Remark column',
    description: 'Rejecting an item must record the reason where reviewers read it.',
    precondition: 'Admin is viewing an approval whose status is "In Progress".',
    steps: [
      'Open the Approval Queue',
      'Select an item with status "In Progress"',
      'Click Reject',
      'Enter a rejection reason',
      'Submit',
    ],
    expected:
      'Status changes to "Rejected". The rejection reason appears in the Remark column. The item leaves the In Progress queue.',
    type: 'Functional',
    priority: 'High',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-014',
    designId: 'proto-approvals',
    devTask: 'DEV_04',
    screen: 'proto-approvals',
    ai: {
      verdict: 'Failed',
      actual: 'Status changed to Rejected, but the Remark column stayed empty.',
      analysis:
        'The reject dialog posts the reason, but the queue table renders remark from the list payload, which is not refetched after the mutation — a stale-row issue rather than a missing field.',
      failStep: 4,
    },
  },
  {
    n: 11,
    module: 'Approvals',
    title: 'Keyboard navigation moves the selection',
    description: 'Reviewers work the queue top to bottom without the mouse.',
    precondition: 'The queue holds at least three items.',
    steps: [
      'Open the Approval Queue',
      'Press ArrowDown twice',
      'Press A on the focused row',
      'Confirm the approval',
    ],
    expected: 'Focus stays visible while moving; A approves only the focused item.',
    type: 'Functional',
    priority: 'Medium',
    assignee: 'Moka',
    requirement: 'REQ-014',
    designId: 'proto-approvals',
    devTask: 'DEV_04',
    screen: 'proto-approvals',
  },
  {
    n: 20,
    module: 'Corporate Card',
    title: 'Bulk approve totals only the selected rows',
    description: 'The confirm step shows the amount being approved.',
    precondition: 'The card screen lists at least five unapproved expenses.',
    steps: [
      'Open Corporate Card',
      'Select three of five expenses',
      'Click Bulk approve',
      'Read the total on the confirm step',
    ],
    expected: 'The confirm dialog totals exactly the three selected rows.',
    type: 'Functional',
    priority: 'High',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-009',
    designId: 'proto-corp-card-bulk',
    devTask: 'DEV_02',
    screen: 'proto-corp-card-bulk',
    ai: {
      verdict: 'Failed',
      actual: 'The total included two rows outside the active filter.',
      analysis:
        'The selection set is kept by row index rather than row id, so rows hidden by the filter stay counted. Likely in the selection reducer, not the dialog.',
      failStep: 3,
    },
  },
  {
    n: 21,
    module: 'Corporate Card',
    title: 'Mixed selection skips already-approved rows',
    description: 'Select-all must not resubmit approved expenses.',
    precondition: 'The list mixes approved and unapproved expenses.',
    steps: ['Open Corporate Card', 'Select all', 'Click Bulk approve', 'Confirm'],
    expected: 'Approved rows are skipped and say so; only pending rows submit.',
    type: 'Regression',
    priority: 'High',
    assignee: 'Moka',
    requirement: 'REQ-009',
    designId: 'proto-corp-card',
    devTask: 'DEV_02',
    screen: 'proto-corp-card',
  },
  {
    n: 30,
    module: 'Cash Receipt',
    title: 'CSV export matches the visible columns',
    description: 'The export is the table, not the dataset.',
    precondition: 'The receipt list is filtered to one supplier.',
    steps: [
      'Open Cash Receipt',
      'Apply a supplier filter',
      'Export CSV',
      'Open the file and compare columns',
    ],
    expected: 'Rows, column order and date format match the screen; filtered-out rows are absent.',
    type: 'Functional',
    priority: 'High',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-011',
    designId: 'proto-cash-receipt',
    devTask: 'DEV_01',
    screen: 'proto-cash-receipt',
  },
  {
    n: 31,
    module: 'Cash Receipt',
    title: 'Oversize attachment is rejected with a message',
    description: 'A 12MB scan used to fail silently and strand the receipt.',
    precondition: 'A receipt is open for editing; a 12MB PDF is at hand.',
    steps: ['Open a receipt', 'Attach a 12MB file', 'Read the attachment row'],
    expected: 'The upload is refused before it starts and the row states the 10MB limit.',
    type: 'Functional',
    priority: 'Medium',
    assignee: 'Moka',
    requirement: 'REQ-011',
    designId: 'proto-receipt-detail',
    screen: 'proto-receipt-detail',
  },
  {
    n: 40,
    module: 'Dashboard',
    title: '12 months of history renders within budget',
    description: 'The spend chart was recomputing on every render.',
    precondition: 'An account holds a full year of activity.',
    steps: ['Open the Dashboard', 'Switch the range to 12 months', 'Scroll the category chart'],
    expected: 'The chart renders under the 250ms budget and scrolling stays smooth.',
    type: 'Regression',
    priority: 'Medium',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-007',
    designId: 'proto-dashboard',
    devTask: 'DEV_03',
    screen: 'proto-dashboard',
  },
  {
    n: 41,
    module: 'Dashboard',
    title: 'Spend by category matches the ledger total',
    description: 'The chart and the table must agree to the cent.',
    precondition: 'The demo ledger is loaded.',
    steps: ['Open the Dashboard', 'Sum the category chart', 'Compare with the ledger total'],
    expected: 'The two totals are identical.',
    type: 'Smoke',
    priority: 'Low',
    assignee: 'Moka',
    designId: 'proto-dashboard',
    screen: 'proto-dashboard',
  },
  {
    n: 50,
    module: 'Close',
    title: 'Checklist export keeps the screen order',
    description: 'The auditor reads the PDF in the order the close screen shows.',
    precondition: 'A close period exists with open blockers.',
    steps: ['Open Month-end Close', 'Export the checklist', 'Compare row order with the screen'],
    expected: 'The PDF lists rows, owners and sign-off times in the screen order.',
    type: 'Functional',
    priority: 'Medium',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-016',
    designId: 'proto-close-status',
    screen: 'proto-close-status',
  },
  {
    n: 51,
    module: 'Close',
    title: 'Blockers roll up by cost centre',
    description: 'The blockers view groups what the status view lists.',
    precondition: 'At least two cost centres carry blockers.',
    steps: ['Open Close Blockers', 'Compare group counts with the status list'],
    expected: 'Every blocker appears in exactly one cost-centre group.',
    type: 'Functional',
    priority: 'Low',
    assignee: 'Moka',
    designId: 'proto-close-blockers',
    screen: 'proto-close-blockers',
  },
  {
    n: 60,
    module: 'Tax Invoice',
    title: 'Invoice list paginates without gaps',
    description: 'Page boundaries lost a row in an earlier round.',
    precondition: 'More than one page of invoices exists.',
    steps: ['Open Purchase Tax Invoice', 'Note the last row of page 1', 'Open page 2'],
    expected: 'No row is skipped or repeated across the boundary.',
    type: 'Regression',
    priority: 'Medium',
    assignee: 'Seongmin Yoo',
    designId: 'proto-tax-invoice',
    screen: 'proto-tax-invoice',
  },
  {
    n: 61,
    module: 'Personal Expense',
    title: 'Returned expense shows the reviewer note',
    description: 'The owner must see why it came back.',
    precondition: 'An expense report has been returned with a note.',
    steps: ['Open Personal Expense', 'Open the returned report', 'Read the banner'],
    expected: 'The reviewer note reads verbatim at the top of the detail.',
    type: 'Functional',
    priority: 'Medium',
    assignee: 'Moka',
    designId: 'proto-expense-detail',
    screen: 'proto-expense-detail',
    ai: {
      verdict: 'Blocked',
      actual: 'No returned report exists in the SIT dataset, so the flow cannot start.',
      analysis:
        'Environment data gap, not a product defect — the precondition cannot be met on SIT.',
      failStep: 2,
    },
  },
  {
    n: 62,
    module: 'Settings',
    title: 'Two-factor enrolment gates approvals',
    description: 'Approvers without TOTP are pushed to enrol after the grace window.',
    precondition: 'A finance approver account past the grace window, not enrolled.',
    steps: ['Sign in as the approver', 'Open the Approval Queue', 'Attempt an approval'],
    expected: 'The approval is blocked and the enrolment screen opens with recovery codes offered.',
    type: 'Functional',
    priority: 'High',
    assignee: 'Seongmin Yoo',
    requirement: 'REQ-021',
    designId: 'proto-settings',
    screen: 'proto-settings',
  },
];

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const KEY = {
  status: 'we-adk:qa:status',
  evidence: 'we-adk:qa:evidence',
  history: 'we-adk:qa:history',
  bugs: 'we-adk:qa:bugs',
  runs: 'we-adk:qa:runs',
  links: 'we-adk:qa:bug-links',
  edits: 'we-adk:qa:case-edits',
  userCases: 'we-adk:qa:user-cases',
  removed: 'we-adk:qa:removed-cases',
  share: 'we-adk:qa:share-token',
} as const;

function read<T>(key: string, projectId: string, fallback: T): T {
  try {
    const raw = workspaceStore.getItem(`${key}:${projectId}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, projectId: string, value: unknown): void {
  try {
    workspaceStore.setItem(`${key}:${projectId}`, JSON.stringify(value));
  } catch {
    // Storage unavailable — the change won't survive a reload.
  }
}

function now(): string {
  return new Date().toISOString();
}

function stamp(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/* ------------------------------------------------------------------ */
/* Test cases                                                          */
/* ------------------------------------------------------------------ */

type StatusOverlay = Record<string, TestStatus>;
type EvidenceOverlay = Record<string, TestEvidence[]>;
type HistoryOverlay = Record<string, TestCase['history']>;
type BugLinkOverlay = Record<string, string[]>;

/** The fields a person can rewrite in the sheet. Status moves separately. */
export interface TestCasePatch {
  module?: string;
  title?: string;
  precondition?: string;
  /** One instruction per entry — the sheet edits them as lines. */
  steps?: string[];
  expectedResult?: string;
  testType?: TestCase['testType'];
  priority?: TestCase['priority'];
  /** Who handles the test. Empty means nobody has picked it up. */
  assignee?: string;
}

type EditsOverlay = Record<string, TestCasePatch>;

/** A case someone added in the sheet — no seed behind it. */
interface StoredCase {
  id: string;
  n: number;
  module: string;
  title: string;
  precondition: string;
  steps: string[];
  expected: string;
  type: TestCase['testType'];
  priority: TestCase['priority'];
  createdAt: string;
}

function buildSteps(id: string, instructions: string[]): TestCase['steps'] {
  return instructions.map((instruction, index) => ({
    id: `${id}-s${index + 1}`,
    order: index + 1,
    instruction,
    status: 'Pending' as const,
  }));
}

function seedToCase(seed: SeedCase, projectId: string): TestCase {
  const id = `tc-${seed.n}`;
  const statuses = read<StatusOverlay>(KEY.status, projectId, {});
  const evidence = read<EvidenceOverlay>(KEY.evidence, projectId, {});
  const history = read<HistoryOverlay>(KEY.history, projectId, {});
  const links = read<BugLinkOverlay>(KEY.links, projectId, {});
  const edits = read<EditsOverlay>(KEY.edits, projectId, {})[id] ?? {};
  return {
    id,
    testCaseId: `TC-${String(seed.n).padStart(2, '0')}`,
    module: edits.module ?? seed.module,
    title: edits.title ?? seed.title,
    description: seed.description,
    precondition: edits.precondition ?? seed.precondition,
    steps: buildSteps(id, edits.steps ?? seed.steps),
    expectedResult: edits.expectedResult ?? seed.expected,
    testType: edits.testType ?? seed.type,
    priority: edits.priority ?? seed.priority,
    status: statuses[id] ?? 'Not Run',
    assignee: edits.assignee ?? seed.assignee,
    evidence: evidence[id] ?? [],
    history: history[id] ?? [],
    linkedRequirementId: seed.requirement,
    linkedDesignId: seed.designId,
    linkedDeveloperTaskId: seed.devTask,
    linkedBugIds: links[id] ?? [],
    previewScreenId: seed.screen,
    createdAt: '2026-08-05',
    updatedAt: '2026-08-07',
  };
}

function storedToCase(stored: StoredCase, projectId: string): TestCase {
  const statuses = read<StatusOverlay>(KEY.status, projectId, {});
  const evidence = read<EvidenceOverlay>(KEY.evidence, projectId, {});
  const history = read<HistoryOverlay>(KEY.history, projectId, {});
  const links = read<BugLinkOverlay>(KEY.links, projectId, {});
  const edits = read<EditsOverlay>(KEY.edits, projectId, {})[stored.id] ?? {};
  return {
    id: stored.id,
    testCaseId: `TC-${String(stored.n).padStart(2, '0')}`,
    module: edits.module ?? stored.module,
    title: edits.title ?? stored.title,
    description: '',
    precondition: edits.precondition ?? stored.precondition,
    steps: buildSteps(stored.id, edits.steps ?? stored.steps),
    expectedResult: edits.expectedResult ?? stored.expected,
    testType: edits.testType ?? stored.type,
    priority: edits.priority ?? stored.priority,
    status: statuses[stored.id] ?? 'Not Run',
    assignee: edits.assignee ?? '',
    evidence: evidence[stored.id] ?? [],
    history: history[stored.id] ?? [],
    linkedBugIds: links[stored.id] ?? [],
    createdAt: stored.createdAt,
    updatedAt: stored.createdAt,
  };
}

/**
 * Every test case — seeded plus sheet-added — with this browser's edits applied.
 *
 * The seeded cases are written against the sample products, down to the screens
 * they name, so a project created here starts with an empty sheet rather than
 * fifteen tests for someone else's login form.
 */
export function loadTestCases(projectId: string): TestCase[] {
  const stored = read<StoredCase[]>(KEY.userCases, projectId, []);
  const removed = read<string[]>(KEY.removed, projectId, []);
  return [
    ...(isSeededProject(projectId) ? SEEDS.map((seed) => seedToCase(seed, projectId)) : []),
    ...stored.map((entry) => storedToCase(entry, projectId)),
  ].filter((entry) => !removed.includes(entry.id));
}

/* ------------------------------------------------------------------ */
/* Sharing                                                             */
/* ------------------------------------------------------------------ */

/**
 * The public view-only link's token. One per project, minted on first share
 * and stable after — resharing must hand out the same URL, or every share
 * would quietly invalidate the one before it.
 */
export function ensureShareToken(projectId: string): string {
  const existing = read<string | null>(KEY.share, projectId, null);
  if (existing) return existing;
  const token = Math.random().toString(36).slice(2, 10);
  write(KEY.share, projectId, token);
  return token;
}

/**
 * Whether a share link may open. A mismatched token on a browser that knows
 * the real one is refused; a browser that has never minted a token accepts —
 * that is the visitor's machine, where the mock has no server to ask.
 */
export function shareTokenValid(projectId: string, token: string): boolean {
  const stored = read<string | null>(KEY.share, projectId, null);
  return stored === null || stored === token;
}

/**
 * Drops a case from the sheet. A sheet-added row is removed outright; a
 * seeded one is remembered as removed — the seed itself is code, so removal
 * is an overlay the same way every other change to it is.
 */
export function deleteTestCase(projectId: string, caseId: string): void {
  const stored = read<StoredCase[]>(KEY.userCases, projectId, []);
  if (stored.some((entry) => entry.id === caseId)) {
    write(
      KEY.userCases,
      projectId,
      stored.filter((entry) => entry.id !== caseId),
    );
    return;
  }
  const removed = read<string[]>(KEY.removed, projectId, []);
  if (!removed.includes(caseId)) write(KEY.removed, projectId, [...removed, caseId]);
}

/** Rewrites the editable fields of a case; the change survives a reload. */
export function updateTestCase(projectId: string, caseId: string, patch: TestCasePatch): void {
  const edits = read<EditsOverlay>(KEY.edits, projectId, {});
  write(KEY.edits, projectId, { ...edits, [caseId]: { ...edits[caseId], ...patch } });
}

/** Appends a blank row to the sheet, numbered after the highest case. */
export function addTestCase(projectId: string): TestCase {
  const existing = loadTestCases(projectId);
  const next =
    existing.reduce(
      (highest, entry) => Math.max(highest, Number(entry.testCaseId.replace('TC-', '')) || 0),
      0,
    ) + 1;
  const stored: StoredCase = {
    id: uid('tc-user'),
    n: next,
    module: 'General',
    title: 'New test case',
    precondition: '',
    steps: ['Open the screen'],
    expected: '',
    type: 'Functional',
    priority: 'Medium',
    createdAt: now().slice(0, 10),
  };
  const all = read<StoredCase[]>(KEY.userCases, projectId, []);
  write(KEY.userCases, projectId, [...all, stored]);
  return storedToCase(stored, projectId);
}

/** The deterministic AI outcome for a case — pass unless the seed says why not. */
export function aiOutcomeFor(testCase: TestCase): AIResult & { failStep: number } {
  const seed = SEEDS.find((entry) => `tc-${entry.n}` === testCase.id);
  if (seed?.ai) {
    return {
      verdict: seed.ai.verdict,
      expected: testCase.expectedResult,
      actual: seed.ai.actual,
      evidence:
        seed.ai.verdict === 'Failed'
          ? ['screenshot-02.png', 'console-log.txt', 'network-log.json']
          : ['screenshot-01.png'],
      confidence: seed.ai.verdict === 'Failed' ? 94 : 88,
      analysis: seed.ai.analysis,
      failStep: seed.ai.failStep,
    };
  }
  return {
    verdict: 'Passed',
    expected: testCase.expectedResult,
    actual: 'Behaviour matched the expected result at every step.',
    evidence: ['screenshot-01.png'],
    confidence: 97,
    analysis: 'All steps completed; console and network stayed clean through the run.',
    failStep: -1,
  };
}

function appendHistory(projectId: string, caseId: string, text: string, by: string): void {
  const all = read<HistoryOverlay>(KEY.history, projectId, {});
  const entry = { id: uid('h'), at: now(), text, by };
  write(KEY.history, projectId, { ...all, [caseId]: [...(all[caseId] ?? []), entry] });
}

/** Moves a test and records the move — the history tab is this trail. */
export function setTestStatus(
  projectId: string,
  caseId: string,
  status: TestStatus,
  by: string,
  note?: string,
): void {
  const statuses = read<StatusOverlay>(KEY.status, projectId, {});
  write(KEY.status, projectId, { ...statuses, [caseId]: status });
  appendHistory(projectId, caseId, note ?? `Marked ${status}`, by);
}

export function addEvidence(
  projectId: string,
  caseId: string,
  type: TestEvidence['type'],
  label: string,
): void {
  const all = read<EvidenceOverlay>(KEY.evidence, projectId, {});
  const entry: TestEvidence = { id: uid('ev'), type, label, createdAt: now() };
  write(KEY.evidence, projectId, { ...all, [caseId]: [...(all[caseId] ?? []), entry] });
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function qaStats(cases: TestCase[]): QAStats {
  const by = (status: TestStatus) => cases.filter((entry) => entry.status === status).length;
  const total = cases.length;
  const passed = by('Passed');
  const failed = by('Failed');
  const blocked = by('Blocked');
  const fixing = by('Fixing');
  const readyForRetest = by('Ready for Retest');
  const touched = total - by('Not Run') - by('Running');
  return {
    total,
    passed,
    failed,
    blocked,
    fixing,
    readyForRetest,
    notRun: by('Not Run'),
    completion: total === 0 ? 0 : Math.round((touched / total) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Bugs                                                                */
/* ------------------------------------------------------------------ */

export function loadBugs(projectId: string): Bug[] {
  return read<Bug[]>(KEY.bugs, projectId, []);
}

function saveBugs(projectId: string, bugs: Bug[]): void {
  write(KEY.bugs, projectId, bugs);
}

function linkBug(projectId: string, caseId: string, bugId: string): void {
  const links = read<BugLinkOverlay>(KEY.links, projectId, {});
  write(KEY.links, projectId, { ...links, [caseId]: [...(links[caseId] ?? []), bugId] });
}

/**
 * A failed test proposes a bug. It arrives as a draft — publishing it into the
 * Developer tab is a person's decision, so the AI never files work directly.
 */
export function createBugFromFailure(
  projectId: string,
  testCase: TestCase,
  detail: { actual: string; evidence: string[]; aiAnalysis?: string },
): Bug {
  const bugs = loadBugs(projectId);
  const severity: BugSeverity =
    testCase.priority === 'High' ? 'High' : testCase.priority === 'Medium' ? 'Medium' : 'Low';
  const bug: Bug = {
    id: uid('bug'),
    bugId: `BUG-${String(21 + bugs.length).padStart(3, '0')}`,
    testCaseId: testCase.testCaseId,
    title: `${testCase.title} — failed on ${testCase.module}`,
    expected: testCase.expectedResult,
    actual: detail.actual,
    severity,
    status: 'draft',
    evidence: detail.evidence,
    aiAnalysis: detail.aiAnalysis,
    createdAt: now(),
  };
  saveBugs(projectId, [bug, ...bugs]);
  linkBug(projectId, testCase.id, bug.bugId);
  appendHistory(projectId, testCase.id, `Raised ${bug.bugId} from the failure`, 'AI QA Agent');
  return bug;
}

/**
 * Publishes a bug into the Developer tab: a real task in the store that board
 * reads, carrying the trace — bug, test, requirement, design, evidence. The
 * test moves to Fixing, because its failure is now in a developer's hands.
 */
export function sendBugToDeveloper(projectId: string, bug: Bug, testCase: TestCase): Bug {
  const tasks = loadUserTasks(projectId);
  const taskId = uid('task-qa');
  const task: ProjectTask = {
    id: taskId,
    code: bug.bugId,
    title: bug.title,
    status: 'Request',
    assignee: 'Unassigned',
    updatedAt: now().slice(0, 10),
    priority: bug.severity === 'Critical' || bug.severity === 'High' ? 1 : 2,
    description: [
      `QA failure — raised by ${bug.testCaseId} (${testCase.module}).`,
      '',
      `Expected: ${bug.expected}`,
      `Actual: ${bug.actual}`,
      '',
      `Evidence: ${bug.evidence.join(', ') || 'none captured'}.`,
      testCase.linkedRequirementId ? `Requirement: ${testCase.linkedRequirementId}.` : '',
      testCase.linkedDesignId ? `Design: ${testCase.linkedDesignId}.` : '',
      bug.aiAnalysis ? `AI analysis: ${bug.aiAnalysis}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    tags: ['bug', 'qa', bug.testCaseId],
    category: 'Development',
    testedBy: 'Both',
    tester: testCase.assignee,
  };
  saveUserTasks(projectId, [task, ...tasks]);

  // The task alone would sit on the board with nowhere to be worked — the
  // fix build is what puts it in the Build tab, on its own fix/ branch,
  // previewing the screen the failing test exercises.
  seedFixBuild(
    projectId,
    {
      taskId,
      bugId: bug.bugId,
      testCaseId: bug.testCaseId,
      title: bug.title,
      screenId: testCase.previewScreenId,
    },
    now().slice(0, 10),
  );

  const next: Bug = { ...bug, status: 'sent', developerTaskId: taskId };
  saveBugs(
    projectId,
    loadBugs(projectId).map((entry) => (entry.id === bug.id ? next : entry)),
  );
  setTestStatus(
    projectId,
    testCase.id,
    'Fixing',
    testCase.assignee,
    `Sent ${bug.bugId} to Developer — fix build raised`,
  );
  return next;
}

/**
 * The developer's side of the loop, simulated: the fix lands, the task
 * completes, and the test comes back owing a retest.
 */
export function markBugFixed(projectId: string, bug: Bug, caseId: string): Bug {
  if (bug.developerTaskId) setTaskStatusOverride(projectId, bug.developerTaskId, 'Complete');
  const next: Bug = { ...bug, status: 'fixed' };
  saveBugs(
    projectId,
    loadBugs(projectId).map((entry) => (entry.id === bug.id ? next : entry)),
  );
  setTestStatus(
    projectId,
    caseId,
    'Ready for Retest',
    'Claude Code',
    `${bug.bugId} fixed — ready for retest`,
  );
  return next;
}

/**
 * The Build tab's side of the loop: submitting a fix build to QA is the fix
 * landing. Finds the bug the build's task carries, marks it fixed, and puts
 * the test back in QA's queue as Ready for Retest. Null when the task is not
 * a fix build — an ordinary feature build changes nothing here.
 */
export function completeFixBuild(
  projectId: string,
  taskId: string,
): { bug: Bug; testCaseId: string } | null {
  const bug = loadBugs(projectId).find(
    (entry) =>
      entry.developerTaskId === taskId &&
      (entry.status === 'sent' || entry.status === 'in-progress'),
  );
  if (!bug) return null;
  const testCase = loadTestCases(projectId).find((entry) => entry.testCaseId === bug.testCaseId);
  if (!testCase) return null;
  markBugFixed(projectId, bug, testCase.id);
  return { bug, testCaseId: bug.testCaseId };
}

/** A passing retest closes the loop: test Passed, bug Verified. */
export function verifyBug(projectId: string, bug: Bug, caseId: string, by: string): Bug {
  const next: Bug = { ...bug, status: 'verified' };
  saveBugs(
    projectId,
    loadBugs(projectId).map((entry) => (entry.id === bug.id ? next : entry)),
  );
  setTestStatus(projectId, caseId, 'Passed', by, `Retest passed — ${bug.bugId} verified`);
  return next;
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

const SEED_RUNS: QARun[] = [
  {
    id: 'run-13',
    number: 13,
    environment: 'SIT',
    total: 15,
    passed: 14,
    failed: 1,
    blocked: 0,
    completion: 100,
    at: '2026-08-04',
    results: [],
  },
  {
    id: 'run-14',
    number: 14,
    environment: 'SIT',
    total: 15,
    passed: 12,
    failed: 2,
    blocked: 1,
    completion: 100,
    at: '2026-08-06',
    results: [],
  },
];

/** Past runs, newest first — and only the samples have a past. */
export function loadRuns(projectId: string): QARun[] {
  const extra = read<QARun[]>(KEY.runs, projectId, []);
  const seeded = isSeededProject(projectId) ? SEED_RUNS : [];
  return [...extra, ...seeded].sort((a, b) => b.number - a.number);
}

export function recordRun(
  projectId: string,
  environment: string,
  results: QARun['results'],
): QARun {
  const existing = loadRuns(projectId);
  const run: QARun = {
    id: uid('run'),
    number: (existing[0]?.number ?? 14) + 1,
    environment,
    total: results.length,
    passed: results.filter((entry) => entry.verdict === 'Passed').length,
    failed: results.filter((entry) => entry.verdict === 'Failed').length,
    blocked: results.filter((entry) => entry.verdict === 'Blocked').length,
    completion: 100,
    at: now().slice(0, 10),
    results,
  };
  write(KEY.runs, projectId, [run, ...read<QARun[]>(KEY.runs, projectId, [])]);
  return run;
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

export interface QAReportData {
  stats: QAStats;
  byModule: { module: string; total: number; passed: number; failed: number; blocked: number }[];
  byPriority: { priority: TestCase['priority']; total: number; passed: number }[];
  openBugs: number;
  verifiedFixes: number;
  failingHighPriority: TestCase[];
  ready: boolean;
}

export function reportData(cases: TestCase[], bugs: Bug[]): QAReportData {
  const modules = [...new Set(cases.map((entry) => entry.module))];
  const failingHighPriority = cases.filter(
    (entry) =>
      entry.priority === 'High' &&
      (entry.status === 'Failed' || entry.status === 'Fixing' || entry.status === 'Blocked'),
  );
  return {
    stats: qaStats(cases),
    byModule: modules.map((module) => {
      const inModule = cases.filter((entry) => entry.module === module);
      return {
        module,
        total: inModule.length,
        passed: inModule.filter((entry) => entry.status === 'Passed').length,
        failed: inModule.filter((entry) => entry.status === 'Failed' || entry.status === 'Fixing')
          .length,
        blocked: inModule.filter((entry) => entry.status === 'Blocked').length,
      };
    }),
    byPriority: (['High', 'Medium', 'Low'] as const).map((priority) => {
      const inPriority = cases.filter((entry) => entry.priority === priority);
      return {
        priority,
        total: inPriority.length,
        passed: inPriority.filter((entry) => entry.status === 'Passed').length,
      };
    }),
    openBugs: bugs.filter((entry) => entry.status !== 'verified').length,
    verifiedFixes: bugs.filter((entry) => entry.status === 'verified').length,
    failingHighPriority,
    ready: failingHighPriority.length === 0 && cases.some((entry) => entry.status === 'Passed'),
  };
}

export { stamp as formatQaTime };
