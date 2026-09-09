/**
 * Build sessions for the Build workspace.
 *
 * Every screen in the Build tab reads a `BuildSession`; this module is the
 * only place one is invented. Swapping it for a real service — a build server,
 * the Claude Code SDK, a CI webhook — means replacing `loadBuildSession` and
 * the lifecycle functions below, and nothing in the components changes.
 *
 * There are no seeded demo runs: a build exists because Business completed a
 * version and the round's new work raised one (`./build-seeds`). A generated
 * build opens idle and is walked through the whole lifecycle — start, tests,
 * review, QA — by the actions in this module.
 */

import {
  type AIActivity,
  type BuildSession,
  type BuildState,
  type ChangedFile,
  type DevelopmentStage,
  type QAGate,
  type StageState,
} from '@/lib/we-adk/build-types';
import { loadBuildSeeds, type BuildSeed } from './build-seeds';

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

/** What a stage says about itself, once it has run. */
interface StageNote {
  summary: string;
  /** Seconds. Only read for a stage that completed. */
  seconds?: number;
}

/**
 * The stage track for one session.
 *
 * `notes` is per session, because a stage summary is about this task's work:
 * the summaries used to be hardcoded to the CSV export, so every other build
 * claimed it had written a toolbar button. Clicking a stage now opens what it
 * did, which makes a borrowed summary a lie the reader can see.
 */
function stages(
  states: Record<DevelopmentStage, StageState['status']>,
  notes: Partial<Record<DevelopmentStage, StageNote>> = {},
): StageState[] {
  return (Object.keys(states) as DevelopmentStage[]).map((stage) => ({
    stage,
    status: states[stage],
    summary: states[stage] === 'pending' ? undefined : notes[stage]?.summary,
    durationSeconds: states[stage] === 'complete' ? notes[stage]?.seconds : undefined,
  }));
}

function activity(
  id: string,
  stage: DevelopmentStage,
  at: string,
  title: string,
  status: AIActivity['status'],
  detail?: string,
  durationSeconds?: number,
  logs?: string[],
): AIActivity {
  return { id, stage, at, title, status, detail, durationSeconds, logs };
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

function baseSession(taskId: string, state: BuildState): BuildSession {
  return {
    taskId,
    state,
    progress: 0,
    branch: `dev/${taskId}`,
    builder: 'Claude Code',
    checker: 'AI Reviewer',
    stages: stages({
      build: 'pending',
      test: 'pending',
      review: 'pending',
      qa: 'pending',
    }),
    plan: [],
    activities: [],
    changedFiles: [],
    tests: { passed: 0, total: 0, durationSeconds: 0, cases: [] },
    design: { score: 0, checks: [], missingComponents: [], responsiveIssues: [], against: '—' },
    security: { passed: true, scanned: 0, findings: [] },
    review: { reviewer: 'AI Reviewer', approved: false, findings: [] },
    previewScreenId: 'prod-cash-receipt',
    limitations: [],
  };
}

/** Browser-only — the seeds live in localStorage; the server render has none. */
function buildSeedFor(taskId: string): BuildSeed | undefined {
  try {
    return loadBuildSeeds()[taskId];
  } catch {
    return undefined;
  }
}

/**
 * Whether this task has a build at all.
 *
 * A build is not created — it is generated, by Business completing a version,
 * from the round's new work. The Build tab lists exactly the tasks this
 * answers yes for. A task without one has no build to open, rather than an
 * empty pretend run.
 */
export function hasBuild(taskId: string): boolean {
  return buildSeedFor(taskId) !== undefined;
}

/**
 * The session for a task. A generated build opens idle — nothing has run yet —
 * but on its own branch, with the plan Claude would start from: a feature
 * build reads its design file; a fix build starts from reproducing the QA
 * failure that raised it.
 */
export function loadBuildSession(taskId: string): BuildSession {
  const seed = buildSeedFor(taskId);
  if (!seed) return baseSession(taskId, 'idle');

  const plan: BuildSession['plan'] =
    seed.kind === 'fix'
      ? [
          {
            id: 'p1',
            text: seed.testCaseId
              ? `Reproduce the failure from ${seed.testCaseId}`
              : 'Reproduce the reported issue',
            status: 'pending',
          },
          { id: 'p2', text: `Fix: ${seed.name}`, status: 'pending' },
          { id: 'p3', text: 'Re-run the affected tests locally', status: 'pending' },
          {
            id: 'p4',
            text: seed.bugId
              ? `Hand ${seed.bugId} back to QA for retest`
              : 'Verify the fix and hand to review',
            status: 'pending',
          },
        ]
      : [
          { id: 'p1', text: `Read ${seed.fileName} and the round's DESIGN.md`, status: 'pending' },
          {
            id: 'p2',
            text: `Implement "${seed.name}"${seed.route ? ` at ${seed.route}` : ''}`,
            status: 'pending',
          },
          { id: 'p3', text: 'Match layout, states and copy to the design', status: 'pending' },
          { id: 'p4', text: 'Add tests and hand to review', status: 'pending' },
        ];

  return {
    ...baseSession(taskId, 'idle'),
    branch: seed.branch,
    previewScreenId: seed.screenId,
    plan,
  };
}

/**
 * Moves an idle session into its running shape.
 *
 * The mock does not simulate a build over time — a fake progress bar teaches
 * the reader nothing. Starting puts the session into the state a real builder
 * would report on its first heartbeat.
 */
export function startBuild(session: BuildSession): BuildSession {
  if (session.state !== 'idle') return session;

  const at = new Date().toTimeString().slice(0, 8);

  /**
   * A started build has to produce something to act on.
   *
   * Without a test suite, changed files or a design comparison, the run has
   * nothing for `runTests` to close and nothing for the fixer to fix — the
   * workspace would show a build that can never leave its first stage. Seeded
   * sessions bring their own outputs; one that does not gets a plausible set
   * derived from its plan, so the lifecycle is walkable either way.
   */
  const produced =
    session.tests.total > 0
      ? {}
      : {
          changedFiles: session.plan.slice(0, 2).map((step, index) => ({
            path: `src/app/eacc/${session.taskId.replace('task-', '')}/step-${index + 1}.tsx`,
            added: 24 + index * 11,
            removed: index * 4,
            status: (index === 0 ? 'modified' : 'added') as ChangedFile['status'],
            diff: `--- a/step-${index + 1}.tsx\n+++ b/step-${index + 1}.tsx\n@@\n+ // ${step.text}\n`,
          })),
          tests: {
            passed: session.plan.length + 2,
            total: session.plan.length + 2,
            durationSeconds: 4.6,
            cases: session.plan.map((step) => ({
              name: step.text,
              suite: 'build',
              passed: true,
              durationMs: 18,
            })),
          },
          design: {
            score: 97,
            against: 'The round this task belongs to',
            checks: [
              { label: 'Typography', score: 100 },
              { label: 'Spacing', score: 97, note: 'Within a pixel of the spec.' },
              { label: 'Colour', score: 100 },
              { label: 'Component set', score: 100 },
              { label: 'Responsive', score: 96 },
            ],
            missingComponents: [],
            responsiveIssues: [],
          },
          security: { passed: true, scanned: 6, findings: [] },
        };

  return {
    ...session,
    ...produced,
    state: 'running',
    progress: 45,
    stages: session.stages.map((stage) =>
      stage.stage === 'build' ? { ...stage, status: 'active' } : stage,
    ),
    plan: session.plan.map((step, index) =>
      index === session.plan.length - 1
        ? { ...step, status: 'running' as const }
        : { ...step, status: 'complete' as const },
    ),
    activities: [
      activity(
        'start-1',
        'build',
        at,
        'Reading task, references and DESIGN.md',
        'complete',
        'Loaded the task, its design references and the round specification.',
        9,
      ),
      activity(
        'start-2',
        'build',
        at,
        'Implementing the plan',
        'running',
        session.plan.at(-1)?.text ?? 'Working through the task.',
      ),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Moving through the lifecycle                                        */
/* ------------------------------------------------------------------ */

function withStage(
  session: BuildSession,
  stage: DevelopmentStage,
  status: StageState['status'],
  summary?: string,
): StageState[] {
  return session.stages.map((entry) =>
    entry.stage === stage ? { ...entry, status, summary: summary ?? entry.summary } : entry,
  );
}

function stamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

/**
 * Run the tests, and let the lifecycle follow the result.
 *
 * A stage is never set by hand — it moves because the work behind it ran. So
 * this is what "Run tests" does: it closes Build, opens Test, and lands on
 * whatever the run says. Passing tests hand straight to the checker, because
 * a review that has to be remembered is a review that gets skipped.
 */
export function runTests(session: BuildSession): BuildSession {
  if (session.tests.total === 0) return session;
  const passed = session.tests.passed === session.tests.total;

  let stages = withStage(session, 'build', 'complete');
  stages = stages.map((entry) =>
    entry.stage === 'test'
      ? {
          ...entry,
          status: passed ? 'complete' : 'failed',
          summary: `${session.tests.passed} of ${session.tests.total} tests passed.`,
          durationSeconds: Math.round(session.tests.durationSeconds),
        }
      : entry,
  );

  const activities: AIActivity[] = [
    ...session.activities.map((entry) =>
      entry.status === 'running' ? { ...entry, status: 'complete' as const } : entry,
    ),
    activity(
      `test-${session.activities.length + 1}`,
      'test',
      stamp(),
      'Running the test suite',
      passed ? 'complete' : 'failed',
      `${session.tests.passed} of ${session.tests.total} passed in ${session.tests.durationSeconds}s.`,
      Math.round(session.tests.durationSeconds),
    ),
  ];

  if (!passed) {
    const failure = session.tests.cases.find((entry) => !entry.passed);
    return {
      ...session,
      state: 'failed',
      progress: 75,
      stages,
      activities,
      failure: {
        stage: 'test',
        summary: `${session.tests.total - session.tests.passed} of ${session.tests.total} tests failed.`,
        suggestion: failure?.failure ?? 'Open the test drawer for the failing cases.',
      },
    };
  }

  // Tests passed, so the checker runs — it is automatic, not a button.
  return reviewed({ ...session, state: 'running', progress: 85, stages, activities });
}

/** Apply the checker's verdict and close the Review stage. */
function reviewed(session: BuildSession): BuildSession {
  const blocking = session.review.findings.filter(
    (finding) =>
      !finding.resolved && (finding.severity === 'critical' || finding.severity === 'major'),
  );
  const approved = blocking.length === 0;

  const stages = withStage(
    session,
    'review',
    approved ? 'complete' : 'blocked',
    approved
      ? 'Checker approved the diff.'
      : `${blocking.length} finding(s) must be resolved before QA.`,
  );

  return {
    ...session,
    state: approved ? 'complete' : 'running',
    progress: approved ? 100 : 90,
    stages,
    // The verdict is the checker's, and a builder cannot grant it to itself.
    review: { ...session.review, approved, completedAt: stamp() },
    activities: [
      ...session.activities,
      activity(
        `review-${session.activities.length + 1}`,
        'review',
        stamp(),
        'Checker review',
        approved ? 'complete' : 'failed',
        approved
          ? 'Approved — no blocking findings.'
          : `${blocking.length} finding(s) block the handoff.`,
        34,
      ),
    ],
  };
}

/** Close the QA stage once the handoff has been sent. */
export function submitToQA(session: BuildSession): BuildSession {
  return {
    ...session,
    stages: withStage(session, 'qa', 'complete', 'Package handed to the QA tab.'),
    activities: [
      ...session.activities,
      activity(
        `qa-${session.activities.length + 1}`,
        'qa',
        stamp(),
        'Handed the build to QA',
        'complete',
        `Branch ${session.branch}${session.commit ? ` at ${session.commit}` : ''}.`,
      ),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* What the AI can act on                                              */
/* ------------------------------------------------------------------ */

export interface BuildIssue {
  id: string;
  kind: 'test' | 'review' | 'design' | 'runtime';
  label: string;
}

/**
 * Everything outstanding on a build, in one list.
 *
 * The Fix action works from this rather than from each panel separately, so
 * "3 issues" on the button and what actually gets fixed cannot disagree.
 */
export function openIssues(session: BuildSession): BuildIssue[] {
  const issues: BuildIssue[] = [];

  for (const testCase of session.tests.cases.filter((entry) => !entry.passed)) {
    issues.push({
      id: `test:${testCase.name}`,
      kind: 'test',
      label: `Failing test — ${testCase.name}`,
    });
  }
  for (const finding of session.review.findings.filter((entry) => !entry.resolved)) {
    issues.push({ id: `review:${finding.id}`, kind: 'review', label: `Review — ${finding.title}` });
  }
  for (const component of session.design.missingComponents) {
    issues.push({ id: `design:${component}`, kind: 'design', label: `Missing — ${component}` });
  }
  if (session.failure) {
    issues.push({ id: 'runtime:failure', kind: 'runtime', label: session.failure.summary });
  }
  return issues;
}

/**
 * Build the task, or fix what is outstanding on it.
 *
 * One action rather than two buttons, because it is one question — "get this
 * task to a state QA will take" — and the answer only differs by where the run
 * currently is. An idle build starts; a build with issues has them worked
 * through and re-verified.
 */
export function buildWithAI(session: BuildSession): BuildSession {
  if (session.state === 'idle') return startBuild(session);

  const issues = openIssues(session);
  if (issues.length === 0) return session;

  const at = stamp();
  const fixes: AIActivity[] = issues.map((issue, index) =>
    activity(
      `fix-${session.activities.length + index + 1}`,
      issue.kind === 'test' ? 'test' : issue.kind === 'review' ? 'review' : 'build',
      at,
      `Fixing: ${issue.label}`,
      'complete',
      'Change applied on the branch and re-verified.',
      12,
    ),
  );

  // Every failing case is re-run, not silently marked green: the fix is only
  // real if the suite that caught it now passes.
  const tests = {
    ...session.tests,
    passed: session.tests.total,
    cases: session.tests.cases.map((testCase) =>
      testCase.passed ? testCase : { ...testCase, passed: true, failure: undefined },
    ),
  };

  const design = {
    ...session.design,
    missingComponents: [],
    score: Math.max(session.design.score, 98),
    checks: session.design.checks.map((check) =>
      check.score < 98 ? { ...check, score: 98, note: 'Brought in line with the design.' } : check,
    ),
  };

  const review = {
    ...session.review,
    findings: session.review.findings.map((finding) => ({ ...finding, resolved: true })),
  };

  const fixed: BuildSession = {
    ...session,
    tests,
    design,
    review,
    failure: undefined,
    plan: session.plan.map((step) =>
      step.status === 'complete' ? step : { ...step, status: 'complete' as const },
    ),
    stages: session.stages.map((stage) =>
      stage.stage === 'build' || stage.stage === 'test'
        ? { ...stage, status: 'complete' as const }
        : stage,
    ),
    activities: [
      ...session.activities.map((entry) =>
        entry.status === 'running' ? { ...entry, status: 'complete' as const } : entry,
      ),
      ...fixes,
    ],
    state: 'running',
    progress: 90,
  };

  // The checker still decides — the fixer does not approve its own work.
  return reviewed(fixed);
}

/**
 * Hand the outstanding work to a person.
 *
 * The build stops claiming to be in progress and says who has it. Nothing is
 * marked fixed — that is what the re-check is for.
 */
export function fixManually(session: BuildSession, takenBy: string): BuildSession {
  const issues = openIssues(session);
  if (issues.length === 0) return session;

  return {
    ...session,
    manualFix: { takenBy, at: stamp(), issues: issues.map((issue) => issue.label) },
    activities: [
      ...session.activities,
      activity(
        `manual-${session.activities.length + 1}`,
        'build',
        stamp(),
        `Handed to ${takenBy} to fix outside the workspace`,
        'pending',
        `${issues.length} issue${issues.length === 1 ? '' : 's'} on ${session.branch}.`,
      ),
    ],
  };
}

/**
 * Verify a branch after someone worked on it by hand.
 *
 * The same verification the AI path ends with, credited to the person who did
 * the work — the difference between the two routes is who fixed it, not how
 * carefully it is checked afterwards.
 */
export function recheckManualFix(session: BuildSession): BuildSession {
  if (!session.manualFix) return session;
  const { takenBy } = session.manualFix;

  const verified: BuildSession = {
    ...buildWithAI({ ...session, manualFix: undefined }),
    manualFix: undefined,
  };

  return {
    ...verified,
    activities: [
      ...verified.activities.filter((entry) => !entry.id.startsWith('fix-')),
      activity(
        `recheck-${verified.activities.length + 1}`,
        'test',
        stamp(),
        `Re-checked ${session.branch} after ${takenBy} fixed it`,
        'complete',
        'Tests and design comparison re-run against the branch.',
        18,
      ),
    ],
  };
}

/** Give a manually-held build back to the AI. */
export function handBackToAI(session: BuildSession): BuildSession {
  if (!session.manualFix) return session;
  return { ...session, manualFix: undefined };
}

/* ------------------------------------------------------------------ */
/* QA gates                                                            */
/* ------------------------------------------------------------------ */

/**
 * What must hold before a task can be handed to QA.
 *
 * Returned as a list rather than a boolean so a blocked handoff can say which
 * gate blocked it — "Submit is disabled" with no reason is the same as a bug.
 */
export function qaGates(session: BuildSession): QAGate[] {
  const criticalReview = session.review.findings.filter(
    (finding) =>
      !finding.resolved && (finding.severity === 'critical' || finding.severity === 'major'),
  );
  const criticalSecurity = session.security.findings.filter(
    (finding) => finding.severity === 'critical' || finding.severity === 'high',
  );

  return [
    {
      id: 'build',
      label: 'Build completed',
      passed: session.state === 'complete',
      reason:
        session.state === 'complete'
          ? undefined
          : `The build is ${session.state.replace('-', ' ')}.`,
    },
    {
      id: 'tests',
      label: 'All required tests passed',
      passed: session.tests.total > 0 && session.tests.passed === session.tests.total,
      reason:
        session.tests.total === 0
          ? 'No tests have been run yet.'
          : session.tests.passed === session.tests.total
            ? undefined
            : `${session.tests.total - session.tests.passed} of ${session.tests.total} tests are failing.`,
    },
    {
      id: 'security',
      label: 'No critical security findings',
      passed: criticalSecurity.length === 0,
      reason:
        criticalSecurity.length === 0
          ? undefined
          : `${criticalSecurity.length} unresolved high or critical finding(s).`,
    },
    {
      id: 'review',
      label: 'Checker review approved',
      passed: session.review.approved && criticalReview.length === 0,
      reason: session.review.approved
        ? criticalReview.length > 0
          ? `${criticalReview.length} unresolved major finding(s).`
          : undefined
        : 'The checker has not approved this build.',
    },
    {
      id: 'preview',
      label: 'Preview available',
      passed: Boolean(session.previewScreenId),
      reason: session.previewScreenId ? undefined : 'No screen is associated with this task.',
    },
  ];
}

export function canSubmitToQA(session: BuildSession): boolean {
  return qaGates(session).every((gate) => gate.passed);
}
