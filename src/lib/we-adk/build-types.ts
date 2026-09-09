/**
 * The Build workspace's domain model.
 *
 * The Build tab is where one task is implemented: Claude Code executes, the
 * product renders live, and the work is checked before it is handed to QA.
 * These types describe that run — the lifecycle it moves through, what the AI
 * did, what the checks found, and what QA receives. Nothing here is UI state;
 * which drawer is open and which device is selected belong to the component.
 *
 * A session is currently produced by `@/lib/we-adk-mock/build`. Replacing that
 * module with a real service is the only change needed to make this live —
 * the components read these shapes, not the mock.
 */

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

/** The stages a task moves through in the Build workspace. */
export type DevelopmentStage = 'build' | 'test' | 'review' | 'qa';

export const DEVELOPMENT_STAGES: DevelopmentStage[] = ['build', 'test', 'review', 'qa'];

export const STAGE_LABELS: Record<DevelopmentStage, string> = {
  build: 'Build',
  test: 'Test',
  review: 'Review',
  qa: 'QA',
};

/**
 * Stage outcomes. `blocked` differs from `failed`: a failure is the work being
 * wrong, a block is the work being unable to proceed — a missing decision, an
 * unavailable dependency — and the two want different responses.
 */
export type StageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'blocked';

export interface StageState {
  stage: DevelopmentStage;
  status: StageStatus;
  /** One line on what this stage produced, shown when the stage is opened. */
  summary?: string;
  /** How long it took, in seconds. Absent while pending. */
  durationSeconds?: number;
}

/* ------------------------------------------------------------------ */
/* AI activity                                                         */
/* ------------------------------------------------------------------ */

export type ActivityStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface AIActivity {
  id: string;
  /** What the AI did, in the reader's language — not a command line. */
  title: string;
  detail?: string;
  status: ActivityStatus;
  /** Wall-clock time, `HH:MM:SS`. */
  at: string;
  durationSeconds?: number;
  /** Which stage this belongs to, so the feed can be read per stage. */
  stage: DevelopmentStage;
  /** Raw log lines behind this step, for the advanced reader. */
  logs?: string[];
}

/* ------------------------------------------------------------------ */
/* The plan Claude is building to                                      */
/* ------------------------------------------------------------------ */

export type BuildPlanStepStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface BuildPlanStep {
  id: string;
  text: string;
  status: BuildPlanStepStatus;
}

/* ------------------------------------------------------------------ */
/* Quality                                                             */
/* ------------------------------------------------------------------ */

export interface TestCase {
  name: string;
  suite: string;
  passed: boolean;
  durationMs: number;
  failure?: string;
}

export interface TestSummary {
  passed: number;
  total: number;
  durationSeconds: number;
  cases: TestCase[];
}

export interface DesignComparisonCheck {
  label: string;
  /** 0–100. A percentage keeps "close but not exact" expressible. */
  score: number;
  note?: string;
}

export interface DesignComparisonResult {
  /** Overall match, 0–100. */
  score: number;
  checks: DesignComparisonCheck[];
  missingComponents: string[];
  responsiveIssues: string[];
  /** The design file this build was compared against. */
  against: string;
}

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  file?: string;
  detail: string;
}

export interface SecurityCheckResult {
  passed: boolean;
  scanned: number;
  findings: SecurityFinding[];
}

export type ReviewSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface ReviewFinding {
  id: string;
  severity: ReviewSeverity;
  title: string;
  detail: string;
  file?: string;
  line?: number;
  resolved: boolean;
}

/**
 * The checker is a separate read-only agent. `approved` is its verdict, never
 * the builder's — a builder that can approve its own work is not a review.
 */
export interface ReviewResult {
  reviewer: string;
  approved: boolean;
  findings: ReviewFinding[];
  /** Absent until the review has run. */
  completedAt?: string;
}

export interface ChangedFile {
  path: string;
  added: number;
  removed: number;
  status: 'modified' | 'added' | 'deleted';
  /** Unified diff for the drawer. */
  diff: string;
}

/* ------------------------------------------------------------------ */
/* The session                                                         */
/* ------------------------------------------------------------------ */

/** What the workspace is doing right now. */
export type BuildState = 'idle' | 'running' | 'failed' | 'complete';

export interface BuildSession {
  taskId: string;
  state: BuildState;
  /** 0–100, across the whole lifecycle. */
  progress: number;
  branch: string;
  builder: string;
  checker: string;
  stages: StageState[];
  plan: BuildPlanStep[];
  activities: AIActivity[];
  changedFiles: ChangedFile[];
  tests: TestSummary;
  design: DesignComparisonResult;
  security: SecurityCheckResult;
  review: ReviewResult;
  /** Set only in the `failed` state. */
  failure?: { stage: DevelopmentStage; summary: string; suggestion: string };
  /**
   * Set while a person is fixing this outside the workspace.
   *
   * Not every problem is one an AI should take: a decision, a change in
   * another service, something that needs a debugger. Recording the handoff
   * means the build says who has it rather than looking abandoned.
   */
  manualFix?: { takenBy: string; at: string; issues: string[] };
  /** The screen the live preview renders, as a canvas id. */
  previewScreenId: string;
  /** Known gaps the builder is aware of — carried into the QA package. */
  limitations: string[];
  /** Short commit hash, once anything has been committed. */
  commit?: string;
}

/* ------------------------------------------------------------------ */
/* QA handoff                                                          */
/* ------------------------------------------------------------------ */

export interface QAGate {
  id: string;
  label: string;
  passed: boolean;
  /** Why it failed, in the reader's language. Absent when it passed. */
  reason?: string;
}

export interface QAHandoff {
  taskCode: string;
  taskTitle: string;
  summary: string;
  changedFiles: ChangedFile[];
  tests: TestSummary;
  design: DesignComparisonResult;
  limitations: string[];
  reviewerNotes: string[];
  previewHref: string;
  branch: string;
  commit?: string;
}
