/**
 * The QA workspace's domain model.
 *
 * QA is the fourth room of the lifecycle: Business asks, Design draws,
 * Developer builds, QA proves. These types describe that proof — the test
 * cases, what running them found, and the bugs that go back to Developer.
 * Nothing here is UI state.
 *
 * Everything is joined by reference, not by copy: a test case points at the
 * requirement it checks, the design screen it exercises, the developer task
 * that built it, and the bugs it raised — so opening TC-10 answers "where did
 * this come from and where did it go" without a second source of truth.
 *
 * The data currently comes from `@/lib/we-adk-mock/qa`. Replacing that module
 * with a real service is the only change needed to make this live.
 */

/* ------------------------------------------------------------------ */
/* Test cases                                                          */
/* ------------------------------------------------------------------ */

/**
 * Where a test stands. The last two are lifecycle states, not verdicts:
 * `Fixing` means its failure is in a developer's hands, `Ready for Retest`
 * means the fix came back and QA owes it another run.
 */
export type TestStatus =
  'Not Run' | 'Running' | 'Passed' | 'Failed' | 'Blocked' | 'Fixing' | 'Ready for Retest';

export type TestPriority = 'High' | 'Medium' | 'Low';

export type TestType = 'Functional' | 'Regression' | 'Smoke' | 'UI';

export type StepStatus = 'Pending' | 'Running' | 'Passed' | 'Failed';

export interface TestStep {
  id: string;
  order: number;
  instruction: string;
  /** What this step alone should show, when it differs from the whole. */
  expectedResult?: string;
  status: StepStatus;
}

export type EvidenceType = 'screenshot' | 'recording' | 'console' | 'network' | 'note';

export interface TestEvidence {
  id: string;
  type: EvidenceType;
  /** File name or note text — the mock has no real files behind these. */
  label: string;
  createdAt: string;
}

/** One line of a test's story: ran, failed, sent to a developer, verified. */
export interface TestHistoryEntry {
  id: string;
  at: string;
  text: string;
  /** Who did it — a person, or the AI agent. */
  by: string;
}

export interface TestCase {
  id: string;
  /** The code people say out loud — `TC-10`. */
  testCaseId: string;
  /** The suite it files under — an eACC module. */
  module: string;
  title: string;
  description: string;
  precondition: string;
  steps: TestStep[];
  expectedResult: string;
  testType: TestType;
  priority: TestPriority;
  status: TestStatus;
  assignee: string;
  evidence: TestEvidence[];
  history: TestHistoryEntry[];
  /** Traceability — ids, never copies. */
  linkedRequirementId?: string;
  linkedDesignId?: string;
  linkedDeveloperTaskId?: string;
  linkedBugIds: string[];
  /** The screen the live preview opens on, as a canvas id. */
  previewScreenId?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* AI runs                                                             */
/* ------------------------------------------------------------------ */

/** What the AI concluded about one test, for a person to confirm or override. */
export interface AIResult {
  verdict: 'Passed' | 'Failed' | 'Blocked';
  expected: string;
  actual: string;
  /** Evidence labels the run captured. */
  evidence: string[];
  /** 0–100. The agent's own certainty, shown so a person can weigh it. */
  confidence: number;
  /** One short paragraph of analysis, in the reader's language. */
  analysis: string;
}

/* ------------------------------------------------------------------ */
/* Bugs                                                                */
/* ------------------------------------------------------------------ */

export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

/**
 * Where a bug is in the loop. `draft` exists so a failed test proposes a bug
 * without publishing one — sending it to Developer is a person's decision.
 */
export type BugStatus = 'draft' | 'sent' | 'in-progress' | 'fixed' | 'verified';

export interface Bug {
  id: string;
  /** The code people say out loud — `BUG-021`. */
  bugId: string;
  /** The test that raised it. */
  testCaseId: string;
  title: string;
  expected: string;
  actual: string;
  severity: BugSeverity;
  status: BugStatus;
  evidence: string[];
  /** The AI's read on the cause, when the AI raised it. */
  aiAnalysis?: string;
  /** The developer task carrying the fix, once it has been sent. */
  developerTaskId?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Runs and reporting                                                  */
/* ------------------------------------------------------------------ */

export interface QARun {
  id: string;
  /** `QA Run #14`. */
  number: number;
  environment: string;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  /** 0–100 — how much of the suite completed. */
  completion: number;
  at: string;
  /** Test codes with their verdicts, so a run can be opened later. */
  results: { testCaseId: string; verdict: 'Passed' | 'Failed' | 'Blocked' }[];
}

export interface QAStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
  fixing: number;
  readyForRetest: number;
  /** 0–100 — tests with any verdict or in the fix loop, over the total. */
  completion: number;
}
