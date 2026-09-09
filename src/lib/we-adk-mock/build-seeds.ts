/**
 * Builds generated from a completed design round.
 *
 * A build cannot be opened by hand: the Build tab has no "new build", and a
 * task alone is not one. What creates builds is Business completing a version
 * — Claude reads the round's diff and raises one build per file of new work,
 * each with the development task behind it, a branch to do the work on, and
 * the screen it must match. The Build tab then lists exactly those.
 *
 * A seed is remembered per task id, so completing the round again tops the
 * list up for what moved since rather than doubling what exists — and a file
 * the round never touched raises nothing at all.
 */

import { type FileDiff } from '@/lib/we-adk/version-diff';
import { type DesignFile } from './projects';
import { loadUserTasks, saveUserTasks, type ProjectTask } from './tasks';
import { findInProgressVersion, isVersionLocked, loadVersionStatuses } from './versions';

export interface BuildSeed {
  taskId: string;
  projectId: string;
  /** The round whose completion raised this build. */
  version: number;
  branch: string;
  /** The design file the build implements — also what the preview renders. */
  screenId: string;
  fileName: string;
  name: string;
  route?: string;
  createdAt: string;
  /**
   * What kind of work this is. A `feature` build implements a design file; a
   * `fix` build repairs a QA failure — its plan starts from reproducing the
   * failing test rather than reading a design.
   */
  kind?: 'feature' | 'fix';
  /** Set on a fix build: the bug it repairs and the test that raised it. */
  bugId?: string;
  testCaseId?: string;
  /** The build the issue was reported from, so that build can list its fixes. */
  raisedFrom?: string;
}

const SEED_KEY = 'we-adk:build-seeds';

/** Every seed, keyed by task id — the shape `loadBuildSession` asks in. */
export function loadBuildSeeds(): Record<string, BuildSeed> {
  try {
    const raw = window.localStorage.getItem(SEED_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, BuildSeed>)
      : {};
  } catch {
    return {};
  }
}

function saveBuildSeeds(seeds: Record<string, BuildSeed>): void {
  try {
    window.localStorage.setItem(SEED_KEY, JSON.stringify(seeds));
  } catch {
    // Storage unavailable — the generated builds won't survive a reload.
  }
}

/** `Cash Receipt Detail` → `cash-receipt-detail`. */
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'screen'
  );
}

let generatedCounter = 0;

/**
 * Raises builds for a completed round: one per design file of new work, and
 * new work only.
 *
 * A round opens as a copy of the one before it, so most of its files are the
 * same screen the product already has — carried over, not updated, not
 * modified. A build for one of those is work nobody needs done, so nothing is
 * raised for them, whether or not an earlier round ever raised one. What
 * counts is what the round's own diff says: a file this round added, or a
 * file it changed. Each of those gets a development task — filed in this
 * round, so the board and the build agree on where the work belongs — and a
 * seed carrying the branch and the screen to build against.
 */
export function generateBuildsForRound(
  projectId: string,
  version: number,
  files: DesignFile[],
  today: string,
  /** The round's diff markers, keyed by file id — `versionChanges` output. */
  changes: Record<string, FileDiff> = {},
): BuildSeed[] {
  const seeds = loadBuildSeeds();
  const mine = Object.values(seeds).filter((seed) => seed.projectId === projectId);
  // This exact file already raised one — completing the round twice tops up.
  const seededScreens = new Set(mine.map((seed) => seed.screenId));
  // Whether an earlier round built a design by this name — an edit to one of
  // those reads as an update rather than a first implementation.
  const seededNames = new Set(mine.map((seed) => seed.name));

  const existingTasks = loadUserTasks(projectId);
  const startIndex = mine.length + 1;

  const created: BuildSeed[] = [];
  const newTasks: ProjectTask[] = [];

  for (const file of files) {
    if (seededScreens.has(file.id)) continue;
    // The same screen, no update, no modification — no build. The diff is the
    // authority: only what this round added or changed is work to hand over.
    const change = changes[file.id]?.change;
    if (change !== 'added' && change !== 'modified') continue;

    generatedCounter += 1;
    const taskId = `task-bld-${Date.now().toString(36)}-${generatedCounter}`;
    const code = `BLD_${String(startIndex + created.length).padStart(2, '0')}`;

    newTasks.push({
      id: taskId,
      code,
      // A screen an earlier round built reads as an update, not a rebuild.
      title: `${seededNames.has(file.name) ? 'Update' : 'Implement'} "${file.name}"`,
      status: 'Request',
      assignee: 'Unassigned',
      updatedAt: today,
      priority: 2,
      description: `Generated when version ${version} was completed. Build the screen the design file ${file.fileName} specifies${file.route ? ` (${file.route})` : ''}, matching the round's DESIGN.md — layout, states and copy included.`,
      tags: ['build', `v${version}`],
      category: 'Development',
      testedBy: 'AI',
      version,
    });

    const seed: BuildSeed = {
      taskId,
      projectId,
      version,
      branch: `dev/v${version}-${slug(file.name)}`,
      screenId: file.id,
      fileName: file.fileName,
      name: file.name,
      route: file.route,
      createdAt: today,
    };
    seeds[taskId] = seed;
    created.push(seed);
  }

  if (created.length > 0) {
    saveUserTasks(projectId, [...newTasks, ...existingTasks]);
    saveBuildSeeds(seeds);
  }
  return created;
}

/**
 * Raises a fix build — the second door into the Build tab.
 *
 * A completed round raises feature builds; this raises repairs. Two things
 * come through it: a bug QA sent back (`bugId`/`testCaseId` set, and
 * submitting the build flips the bug to fixed), and an issue a developer
 * raised in the Build tab itself — same `fix/` branch, same pipeline, no bug
 * behind it. Either way the fix travels the pipeline rather than being
 * marked done by hand.
 */
export function seedFixBuild(
  projectId: string,
  fix: {
    taskId: string;
    title: string;
    screenId?: string;
    /** Set when QA raised it; absent for a developer-raised issue. */
    bugId?: string;
    testCaseId?: string;
    /** The build it was reported from, when it was reported from one. */
    raisedFrom?: string;
  },
  today: string,
): BuildSeed {
  const seeds = loadBuildSeeds();
  const seed: BuildSeed = {
    taskId: fix.taskId,
    projectId,
    version: 0,
    branch: `fix/${fix.bugId ? `${fix.bugId.toLowerCase()}-` : ''}${slug(fix.title)}`,
    screenId: fix.screenId ?? 'proto-login',
    fileName: fix.testCaseId ?? 'fix-issue',
    name: fix.title,
    createdAt: today,
    kind: 'fix',
    bugId: fix.bugId,
    testCaseId: fix.testCaseId,
    raisedFrom: fix.raisedFrom,
  };
  seeds[fix.taskId] = seed;
  saveBuildSeeds(seeds);
  return seed;
}

/* ------------------------------------------------------------------ */
/* Reporting something broken                                          */
/* ------------------------------------------------------------------ */

/**
 * Reports a broken thing, as a build.
 *
 * Reporting used to file a record and a `FIX_xx` task, and someone had to come
 * back later and promote it into a build. That middle state earned nothing: an
 * issue worth typing out is work someone intends to do, and the record only
 * added a queue to triage before the work could start. So a report is a build
 * now — the `FIX_xx` task on the board, its own `fix/` branch, and the same
 * pipeline a QA bug travels.
 *
 * Returns the task and the seed, so the caller can put the reader straight on
 * the build that was just raised.
 */
export function reportFixIssue(
  projectId: string,
  fields: {
    title: string;
    detail?: string;
    screenId?: string;
    /** The build it was reported from, so the fix records where it came from. */
    raisedFrom?: string;
    evidence?: string[];
    /** Where it was reported from, when not from a build — e.g. `Monitor`. */
    source?: string;
    /**
     * The round to file it in — the one the reader is scoped to.
     *
     * Without this the fix went to the newest round in progress, which is only
     * the same round by luck: report one while looking at version 2 with version
     * 3 open and the build landed in 3, where the list you were looking at could
     * not show it. Ignored when that round has shipped, since a released round
     * takes no new work.
     */
    version?: number;
  },
  today: string,
): { task: ProjectTask; seed: BuildSeed } {
  const tasks = loadUserTasks(projectId);
  const count = tasks.filter((entry) => entry.code.startsWith('FIX_')).length + 1;
  const code = `FIX_${String(count).padStart(2, '0')}`;
  const taskId = `task-fix-${Date.now().toString(36)}-${count}`;

  const description = [
    fields.detail ?? '',
    fields.evidence && fields.evidence.length > 0 ? `Evidence: ${fields.evidence.join(', ')}.` : '',
    fields.source ? `Reported from ${fields.source}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  /**
   * The round the fix is filed in: the one being looked at, if it can take work,
   * otherwise the newest round still open.
   *
   * Stamped rather than left blank, because a task with no round follows
   * whichever round is open — so opening the next one dragged every past fix
   * into it, builds included.
   */
  const asked = fields.version;
  const version =
    asked !== undefined && !isVersionLocked(asked, loadVersionStatuses(projectId))
      ? asked
      : (findInProgressVersion(projectId) ?? undefined);

  const task: ProjectTask = {
    id: taskId,
    code,
    title: fields.title,
    status: 'Request',
    assignee: 'Unassigned',
    updatedAt: today,
    priority: 1,
    description: description || undefined,
    tags: ['fix'],
    category: 'Development',
    testedBy: 'AI',
    version,
  };
  saveUserTasks(projectId, [task, ...tasks]);

  const seed = seedFixBuild(
    projectId,
    {
      taskId,
      title: fields.title,
      screenId: fields.screenId,
      raisedFrom: fields.raisedFrom,
    },
    today,
  );

  return { task, seed };
}
