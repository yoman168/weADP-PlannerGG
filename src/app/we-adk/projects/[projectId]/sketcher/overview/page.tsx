'use client';

/**
 * Report — one round, read whole.
 *
 * Main shows the designs, Task shows the work and Draft shows what each member
 * has. All three are working views: they answer "what am I doing next". Nobody
 * had a view that answered "what is this round", which is the question asked at
 * a hand-off, at a status meeting, and by anyone who did not sit through the
 * round being built.
 *
 * So this reads across the tabs for one round and puts the answer in one place —
 * and then exports it, because the people who ask that question are usually not
 * the people with this app open.
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ClipboardList,
  Download,
  ExternalLink,
  FileCode2,
  Layers,
  Lock,
  Pencil,
  SquareStack,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Separator, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { findProject, type DesignFile, type DesignFolder } from '@/lib/we-adk-mock/projects';
import { loadGeneratedScreens, type SketchScreen } from '@/lib/we-adk-mock/sketches';
import {
  loadSurfaces,
  resolveSurface,
  SURFACE_LABELS,
  type SurfaceMap,
} from '@/lib/we-adk-mock/design-surface';
import {
  BASELINE_VERSION,
  isVersionLocked,
  loadRemovedVersions,
  loadSubfolders,
  loadVersionCount,
  loadVersionNames,
  loadVersionStatuses,
  projectVersionFolders,
  removeVersion,
  resolveVersionStatus,
  setVersionName,
  setVersionStatus,
  subfolderStorageKey,
  versionDisplayName,
  versionFolderId,
  versionFolderKey,
  type VersionNames,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';
import { versionChanges, type FileDiff } from '@/lib/we-adk/version-diff';
import { loadUploadedFiles } from '@/lib/we-adk-mock/meeting-files';
import { taskFilesKey } from '@/lib/we-adk/task-design';
import { loadTaskDesignRefs } from '@/lib/we-adk/task-design-refs';
import { loadArtifacts } from '@/lib/we-adk/board-artifacts';
import {
  applyTaskAssignmentOverrides,
  applyTaskStatusOverrides,
  applyTaskVersionOverrides,
  applyTestedByOverrides,
  isBuildTask,
  loadTaskAssignmentOverrides,
  loadTaskStatusOverrides,
  loadTaskVersionOverrides,
  loadTestedByOverrides,
  loadUserTasks,
  projectRounds,
  projectTasks,
  type ProjectTask,
} from '@/lib/we-adk-mock/tasks';
import { taskRound } from '@/components/we-adk/version-rail';
import {
  downloadReportBundle,
  openReportHtml,
  reportFileName,
  type ReportDesign,
  type ReportDesignFile,
  type VersionReport,
} from '@/lib/we-adk/version-report';
import { designToHtml } from '@/lib/we-adk/design-html';
import { findPrototypeFile, prototypeHtmlHref } from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { loadScreenBlocks } from '@/lib/we-adk-mock/sketcher';
import { describeBlocks } from '@/lib/we-adk/design-spec';
import { projectEnvironment, ROLE_LABELS } from '@/lib/we-adk-mock/environment';
import { loadTestCases } from '@/lib/we-adk-mock/qa';
import { workspaceStore } from '@/lib/api/workspace-store';

/* ------------------------------------------------------------------ */
/* Reading the round                                                   */
/* ------------------------------------------------------------------ */

/** Every file in a round, with the folder it sits in named. */
function roundFiles(folder: DesignFolder): { file: DesignFile; folder?: string }[] {
  return [
    ...folder.files.map((file) => ({ file })),
    ...(folder.children ?? []).flatMap((child) =>
      child.files.map((file) => ({ file, folder: child.name })),
    ),
  ];
}

interface RoundState {
  folders: DesignFolder[];
  /** Meeting id → the designs generated from its notes, added to the seeded ones. */
  sessionScreens: Record<string, SketchScreen[]>;
  statuses: VersionStatuses;
  names: VersionNames;
  rounds: number[];
  changes: Record<string, FileDiff>;
  surfaces: SurfaceMap;
  tasks: ProjectTask[];
  /** How many acceptance tests are on the QA sheet — read, not derivable here. */
  tests: number;
}

/** What a task was worked from — the three lists the export carries per task. */
interface TaskReferences {
  files: { name: string; note?: string }[];
  designs: { name: string; fileName: string; route?: string; note?: string }[];
  boards: { title: string; caption?: string }[];
}

const NO_REFERENCES: TaskReferences = { files: [], designs: [], boards: [] };

const EMPTY: RoundState = {
  folders: [],
  sessionScreens: {},
  statuses: {},
  names: {},
  rounds: [],
  changes: {},
  surfaces: {},
  tasks: [],
  tests: 0,
};

/* ------------------------------------------------------------------ */
/* Pieces                                                             */
/* ------------------------------------------------------------------ */

/**
 * One figure of the round, as a card.
 *
 * The figure and the sentence that qualifies it belong together: "13" and "13 —
 * 13 screens, 0 popups" are the same fact, and only the second can be read
 * without going somewhere else to find out what was counted. So every card
 * carries a number and the breakdown behind it, never one alone.
 *
 * The icon tile stays neutral. Five categories in five colours would be five
 * accents invented for decoration, and the house rule is that colour means state
 * or identity — so the only colour on a card is `accent`, which a card sets when
 * its detail says something worth noticing.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  detail: string;
  /** Tints the detail line — for a figure that is asking for attention. */
  accent?: string;
}) {
  return (
    <div className="bg-background flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-3.5" />
        </span>
        <p className="text-muted-foreground min-w-0 truncate text-[11px] font-medium">{label}</p>
      </div>
      <div>
        <p className="text-2xl leading-none font-semibold tabular-nums">{value}</p>
        <p className={cn('text-muted-foreground mt-2 text-[11px] leading-relaxed', accent)}>
          {detail}
        </p>
      </div>
    </div>
  );
}

/**
 * One line of "what goes in the file".
 *
 * A count, always — including a zero. A zero is the useful half: it is how you
 * see that the round has no acceptance tests before you hand the document to
 * somebody expecting to build from it, and dimming it rather than hiding it
 * keeps the gap visible without shouting about it.
 */
function ContentsRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-0">
      <span className={cn('text-xs', count === 0 && 'text-muted-foreground')}>{label}</span>
      <span
        className={cn(
          'shrink-0 font-mono text-xs tabular-nums',
          count === 0 ? 'text-muted-foreground/60' : 'font-medium',
        )}
      >
        {count}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function OverviewContent() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();
  const project = findProject(params.projectId);
  const [state, setState] = useState<RoundState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  /** Bumped when the rail toggles a version status. */
  const [statusRevision, setStatusRevision] = useState(0);

  useEffect(() => {
    const onStatusChange = () => setStatusRevision((r) => r + 1);
    window.addEventListener('we-adk:version-status', onStatusChange);
    return () => window.removeEventListener('we-adk:version-status', onStatusChange);
  }, []);
  /** Task id → the material it was worked from, for the export. */
  const [taskRefs, setTaskRefs] = useState<Record<string, TaskReferences>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<'In progress' | 'Released'>('In progress');
  const [whatsNewEditing, setWhatsNewEditing] = useState(false);
  const [whatsNewNotes, setWhatsNewNotes] = useState('');

  /**
   * Everything this view reads is workspace state, so it is read after mount
   * — and re-read when the round changes, because the rail navigates by query
   * rather than telling this page anything.
   */
  useEffect(() => {
    if (!project) return;

    const count = loadVersionCount(project.id);
    const removed = loadRemovedVersions(project.id);
    const statuses = loadVersionStatuses(project.id);

    const created: Record<string, SketchScreen[]> = {};
    for (const session of project.sessions) {
      created[session.id] = loadGeneratedScreens(session.id);
    }
    for (let version = BASELINE_VERSION; version <= Math.max(count, BASELINE_VERSION); version++) {
      if (removed.includes(version)) continue;
      const key = versionFolderKey(project.id, version);
      created[key] = loadGeneratedScreens(key);
      for (const sub of loadSubfolders(project.id, version)) {
        const subKey = subfolderStorageKey(project.id, version, sub.id);
        created[subKey] = loadGeneratedScreens(subKey);
      }
    }

    const folders = projectVersionFolders(project, created, count, statuses, removed);
    const merged = [...projectTasks(project.id), ...loadUserTasks(project.id)];
    setState({
      folders,
      sessionScreens: created,
      statuses,
      names: loadVersionNames(project.id),
      rounds: projectRounds(project.id),
      changes: versionChanges(project.id, folders),
      surfaces: loadSurfaces(project.id),
      tests: loadTestCases(project.id).length,
      tasks: applyTaskAssignmentOverrides(
        applyTaskVersionOverrides(
          applyTestedByOverrides(
            applyTaskStatusOverrides(merged, loadTaskStatusOverrides(project.id)),
            loadTestedByOverrides(project.id),
          ),
          loadTaskVersionOverrides(project.id),
        ),
        loadTaskAssignmentOverrides(project.id),
      ),
    });
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, searchParams, statusRevision]);

  /** The round on screen — the rail's `?folder=`, else the newest still open. */
  const version = useMemo(() => {
    const folder = searchParams.get('folder');
    const fromFolder = folder?.startsWith('version-')
      ? Number.parseInt(folder.slice('version-'.length), 10)
      : Number.NaN;
    if (state.rounds.includes(fromFolder)) return fromFolder;
    return (
      state.rounds.find((round) => !isVersionLocked(round, state.statuses)) ??
      state.rounds[0] ??
      null
    );
  }, [searchParams, state.rounds, state.statuses]);

  const round = state.folders.find((folder) => folder.versionNumber === version) ?? null;

  // Load saved What's New notes for this version
  useEffect(() => {
    if (!project || version === null) return;
    try {
      const raw = workspaceStore.getItem(`we-adk:whats-new:${project.id}:v${version}`);
      setWhatsNewNotes(raw ?? '');
    } catch { setWhatsNewNotes(''); }
    setWhatsNewEditing(false);
  }, [project, version]);

  /**
   * The round's files as the explorer holds them, kept beside the report's own
   * shape. The document only needs a name and a route; producing the file needs
   * the canvas id and its seed pattern, which are not facts about the report.
   */
  const roundFileList = useMemo(() => (round ? roundFiles(round) : []), [round]);

  /** The designs in the round, each with its surface and its diff marker. */
  const designs: ReportDesign[] = useMemo(() => {
    if (!round) return [];
    return roundFiles(round).map(({ file, folder }) => ({
      name: file.name,
      fileName: file.fileName,
      route: file.route,
      surface: resolveSurface(file.id, state.surfaces),
      folder,
      change: state.changes[file.id]?.change ?? 'unchanged',
      status: file.status.label,
      // Filled in when a document is built. Reading every canvas out of storage
      // on each render would be work for a page that shows three numbers.
      blocks: [],
    }));
  }, [round, state.changes, state.surfaces]);

  /** The tasks filed against this round, builds excluded — they are not board work. */
  const tasks = useMemo(() => {
    if (version === null) return [];
    return state.tasks.filter(
      (task) => !isBuildTask(task.id) && taskRound(task, state.rounds, state.statuses) === version,
    );
  }, [state.tasks, state.rounds, state.statuses, version]);

  /**
   * The material behind each task in this round.
   *
   * A second pass rather than part of the first: it is keyed on the round's
   * tasks, which are only known once the first pass has read the rounds and the
   * query has said which one is selected. Scoped to the round for the same
   * reason — reading three storage keys for every task in the project would be
   * work done for tasks this document will never mention.
   */
  useEffect(() => {
    if (!project) return;
    const next: Record<string, TaskReferences> = {};
    for (const task of tasks) {
      const key = taskFilesKey(project.id, task.id);
      next[task.id] = {
        files: loadUploadedFiles(key).map((file) => ({ name: file.name, note: file.note })),
        designs: loadTaskDesignRefs(project.id, task.id).map((ref) => ({
          name: ref.name,
          fileName: ref.fileName,
          route: ref.route,
          note: ref.note,
        })),
        boards: loadArtifacts(key).map((artifact) => ({
          title: artifact.title,
          caption: artifact.caption,
        })),
      };
    }
    setTaskRefs(next);
  }, [project, tasks]);

  if (!project) {
    return (
      <p className="text-muted-foreground px-6 py-16 text-center text-sm">
        That project does not exist.
      </p>
    );
  }

  if (!loaded) {
    return <div className="flex-1" />;
  }

  if (version === null || round === null) {
    return (
      <p className="text-muted-foreground mx-6 my-16 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        No rounds yet. Open one from the rail on the left and its report appears here.
      </p>
    );
  }

  const status = resolveVersionStatus(version, state.statuses);
  const complete = isVersionLocked(version, state.statuses);
  const roundName = versionDisplayName(version, state.names);
  const screens = designs.filter((design) => design.surface === 'screen');
  const popups = designs.filter((design) => design.surface === 'popup');
  const added = designs.filter((design) => design.change === 'added').length;
  const modified = designs.filter((design) => design.change === 'modified').length;

  const carried = designs.filter((design) => design.change === 'unchanged').length;

  /**
   * Every task on the board, whichever round it sits in.
   *
   * Build tasks stay out, exactly as they do on the boards: a build is raised
   * from a design rather than filed by anyone, and a register that listed them
   * would describe work nobody put there.
   */
  const boardTasks = state.tasks.filter((task) => !isBuildTask(task.id));

  /** What the document will say, counted — the panel under the cards. */
  const decisionCount = project.sessions.reduce(
    (total, session) => total + (session.decisions?.length ?? 0),
    0,
  );
  const openCount = project.sessions.reduce(
    (total, session) => total + (session.openQuestions?.length ?? 0),
    0,
  );
  const serviceCount = projectEnvironment(project.id).services.length;
  const meetingCount = project.sessions.length;
  const fileNames = { projectName: project.name, roundName, version };

  /** Tasks by status, biggest group first — the state of play in one line. */
  const taskCounts = (() => {
    const groups = new Map<string, number>();
    for (const task of tasks) groups.set(task.status, (groups.get(task.status) ?? 0) + 1);
    return [...groups.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  })();

  /**
   * The document, assembled once and handed to whichever button was pressed.
   *
   * Built from exactly what is on screen — the same designs, the same tasks, the
   * same round — so the file cannot say something this page does not.
   */
  const buildReport = (): VersionReport => ({
    projectName: project.name,
    customer: project.customer,
    owner: project.owner,
    summary: project.summary,
    roundName,
    version,
    status,
    complete,
    preparedOn: new Date().toISOString().slice(0, 10),
    designs: roundFileList.map(({ file, folder }) => ({
      name: file.name,
      fileName: file.fileName,
      route: file.route,
      surface: resolveSurface(file.id, state.surfaces),
      folder,
      change: state.changes[file.id]?.change ?? 'unchanged',
      status: file.status.label,
      blocks: describeBlocks(
        loadScreenBlocks(file.id, file.seedPattern, () => prototypeDesignBlocks(file.id)),
      ),
    })),
    tasks: tasks.map((task) => {
      const refs = taskRefs[task.id] ?? NO_REFERENCES;
      return {
        code: task.code,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        testedBy: task.testedBy ?? 'Not tested',
        priority: task.priority,
        description: task.description,
        files: refs.files,
        designs: refs.designs,
        boards: refs.boards,
      };
    }),
    meetings: project.sessions.map((session) => ({
      title: session.title,
      metAt: session.metAt,
      kind: session.kind,
      attendees: session.attendees,
      durationMin: session.durationMin,
      notes: session.notes,
      decisions: session.decisions ?? [],
      openQuestions: session.openQuestions ?? [],
      // Seeded and generated together: which of the two a design came from is a
      // fact about this mock, not about the meeting.
      screens: [...session.screens, ...(state.sessionScreens[session.id] ?? [])].map((screen) => ({
        name: screen.name,
        route: screen.route,
      })),
    })),
    profile: {
      stage: project.stage,
      status: project.status.label,
      spend: project.spend,
      solution: project.solution,
    },
    rounds: state.rounds.map((round) => ({
      version: round,
      name: versionDisplayName(round, state.names),
      status: isVersionLocked(round, state.statuses)
        ? 'Released'
        : resolveVersionStatus(round, state.statuses),
      complete: isVersionLocked(round, state.statuses),
      designs:
        (state.folders.find((folder) => folder.versionNumber === round)?.files.length ?? 0) +
        (state.folders
          .find((folder) => folder.versionNumber === round)
          ?.children?.reduce((total, child) => total + child.files.length, 0) ?? 0),
      tasks: boardTasks.filter((task) => taskRound(task, state.rounds, state.statuses) === round)
        .length,
      current: round === version,
    })),
    allTasks: boardTasks.map((task) => {
      const round = taskRound(task, state.rounds, state.statuses);
      return {
        code: task.code,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        // `taskRound` has no round to give when the project has none, and an
        // undefined here would print as the string "undefined" in the document.
        round: round == null ? 'Unassigned' : versionDisplayName(round, state.names),
      };
    }),
    stack: (() => {
      const environment = projectEnvironment(project.id);
      return {
        name: environment.stack,
        services: environment.services.map((service) => ({
          id: service.id,
          role: ROLE_LABELS[service.role],
          image: service.image,
          ports: service.ports,
          source: service.source,
          note: service.note,
        })),
      };
    })(),
    tests: loadTestCases(project.id).map((test) => ({
      code: test.testCaseId,
      module: test.module,
      title: test.title,
      description: test.description,
      precondition: test.precondition,
      // A step can carry its own expected result, and where it does that is part
      // of the instruction rather than a separate field the document has room for.
      steps: test.steps.map((step) =>
        step.expectedResult ? `${step.instruction} → ${step.expectedResult}` : step.instruction,
      ),
      expected: test.expectedResult,
      type: test.testType,
      priority: test.priority,
      status: test.status,
      assignee: test.assignee,
      linkedTask: test.linkedDeveloperTaskId,
      linkedDesign: test.linkedDesignId,
    })),
  });

  /**
   * The round's designs as html, gathered when Export is pressed.
   *
   * At click time rather than on render: seventeen screens is seventeen canvases
   * read out of storage and, for the prototype ones, seventeen requests. Doing
   * that on every render of a page whose job is to show five numbers would be
   * work for a download nobody has asked for yet.
   *
   * A prototype design is fetched rather than re-rendered — it has a real html
   * page behind it, and handing over a wireframe drawing of a screen that exists
   * would be a worse copy of the thing the reader is being given. Anything else
   * is drawn from its blocks, which is all there is.
   */
  const gatherDesigns = async (): Promise<ReportDesignFile[]> => {
    const out: ReportDesignFile[] = [];

    for (const { file, folder } of roundFileList) {
      const prototype = findPrototypeFile(file.id);

      if (prototype) {
        try {
          const response = await fetch(prototypeHtmlHref(prototype));
          if (response.ok) {
            out.push({ fileName: file.fileName, folder, html: await response.text() });
            continue;
          }
        } catch {
          // Offline or the route moved — fall through to drawing the blocks,
          // which is worse than the real page but better than a missing file.
        }
      }

      out.push({
        fileName: file.fileName,
        folder,
        html: designToHtml({
          name: file.name,
          route: file.route,
          origin: `${project.name} · ${roundName}`,
          blocks: loadScreenBlocks(file.id, file.seedPattern, () => prototypeDesignBlocks(file.id)),
        }),
      });
    }

    return out;
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex w-full flex-col gap-4">
        {/* ---- Which round, and what to do with it ---- */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              {roundName}
              {complete && <Lock aria-hidden className="text-muted-foreground size-3.5" />}
            </h1>
            <p className="text-muted-foreground text-xs">
              <span
                className={cn(
                  'font-medium',
                  complete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-blue-600 dark:text-blue-400',
                )}
              >
                {complete ? 'Released' : status}
              </span>{' '}
              · {project.name} for {project.customer}
            </p>
          </div>

          <span className="flex-1" />

          {/* Version management — update and delete */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              setEditName(state.names[version] ?? '');
              setEditStatus(complete ? 'Released' : (status as 'In progress' | 'Released'));
              setEditOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
            Update
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => openReportHtml(buildReport())}
          >
            <ExternalLink className="size-3.5" />
            {t('overview.preview')}
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={async () => downloadReportBundle(buildReport(), await gatherDesigns())}
            title={t('overview.exportHint')}
          >
            <Download className="size-3.5" />
            {t('overview.export')}
          </Button>
        </header>


        <Separator />

        {/* ---- What's New — editable release notes ---- */}
        <section className="bg-background rounded-xl border p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white">
              <Layers className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">What&apos;s New</h2>
              <p className="text-muted-foreground text-[11px]">{roundName} · {complete ? 'Released' : status}</p>
            </div>
            {!whatsNewEditing ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setWhatsNewEditing(true)}
              >
                <Pencil className="size-3" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    try {
                      workspaceStore.setItem(`we-adk:whats-new:${project.id}:v${version}`, whatsNewNotes);
                    } catch { /* ignore */ }
                    setWhatsNewEditing(false);
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    try {
                      const raw = workspaceStore.getItem(`we-adk:whats-new:${project.id}:v${version}`);
                      setWhatsNewNotes(raw ?? '');
                    } catch { setWhatsNewNotes(''); }
                    setWhatsNewEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {whatsNewEditing ? (
            <textarea
              autoFocus
              value={whatsNewNotes}
              onChange={(e) => setWhatsNewNotes(e.target.value)}
              placeholder={`Write release notes for ${roundName}...`}
              className="border-input min-h-[120px] w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : whatsNewNotes ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{whatsNewNotes}</div>
          ) : (
            <p className="text-muted-foreground text-xs">No release notes yet. Click Edit to add notes for this version.</p>
          )}
        </section>

        {/* ---- The round, as cards ---- */}
        {/* One grid, not a card row above a list of the same figures. The two
            said the same things twice and neither said them completely, which is
            how a summary stops being read. Five across on a wide screen, so the
            round is one glance rather than a scroll. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={FileCode2}
            label={t('overview.designs')}
            value={String(designs.length)}
            detail={`${screens.length} ${t('overview.screens').toLowerCase()} · ${popups.length} ${
              popups.length === 1 ? SURFACE_LABELS.popup.toLowerCase() : 'popups'
            }`}
          />
          <StatCard
            icon={Layers}
            label={t('overview.change')}
            value={added + modified === 0 ? '—' : String(added + modified)}
            detail={
              designs.length === 0
                ? t('overview.noDesigns')
                : `${added} ${t('overview.new')} · ${modified} ${t('overview.changed')} · ${carried} ${t('overview.carried')}`
            }
          />
          <StatCard
            icon={ClipboardList}
            label={t('overview.tasks')}
            value={String(tasks.length)}
            detail={
              tasks.length === 0
                ? t('overview.noTasks')
                : taskCounts
                    .map((entry) => `${entry.count} ${entry.status.toLowerCase()}`)
                    .join(' · ')
            }
          />
        </div>

        {/* ---- What the download actually is ---- */}
        {/* The three cards say how big the round is; they never said what the
            export contains, so the page was a summary with the rest of the
            screen left blank. This is the document's own contents, counted from
            the same data it will be built from — so a gap here is a gap in the
            file, visible before it is handed to somebody. */}
        <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
          <section className="bg-background flex flex-col gap-1 rounded-xl border p-4">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold">What the export contains</h2>
              <p className="text-muted-foreground text-[11px]">14 sections</p>
            </div>

            <ContentsRow label="Meetings, with notes and decisions in full" count={meetingCount} />
            <ContentsRow
              label="Rounds, with their design and task counts"
              count={state.rounds.length}
            />
            <ContentsRow label="Tasks across the project" count={boardTasks.length} />
            <ContentsRow label="Screens" count={screens.length} />
            <ContentsRow label="Popups" count={popups.length} />
            <ContentsRow label="Screen specifications, element by element" count={designs.length} />
            <ContentsRow label="Tasks in this round, in detail" count={tasks.length} />
            <ContentsRow label="Acceptance tests, with steps" count={state.tests} />
            <ContentsRow label="Services in the stack" count={serviceCount} />
            <ContentsRow label="Decisions" count={decisionCount} />
            <ContentsRow label="Open questions" count={openCount} />
          </section>

          <aside className="bg-background flex flex-col gap-0 rounded-xl border p-5">
            <p className="mb-4 text-xs font-semibold">
              <span className="text-rose-500">EXPORT</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-muted-foreground">{roundName}</span>
            </p>
            {[
              '/html/',
              '/prd/PRD.md',
              '/frd/FRD.md',
              '/ia/structure.md',
              '/tasks/history.md',
              '/assets/',
            ].map((name) => (
              <div key={name} className="py-1.5">
                <p className="font-mono text-[13px]">{name}</p>
              </div>
            ))}
            <p className="mt-4 font-mono text-sm font-bold">
              weplanner-export-{roundName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip
            </p>
          </aside>
        </div>
      </div>

      {/* Update version dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update {roundName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={roundName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Status</Label>
              <div className="flex gap-2">
                {(['In progress', 'Released'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      editStatus === s
                        ? s === 'Released'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const names = setVersionName(project.id, version, editName);
                  const statuses = setVersionStatus(project.id, version, editStatus);
                  setState((prev) => ({ ...prev, names, statuses }));
                  setEditOpen(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete version dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {roundName}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will permanently remove <strong>{roundName}</strong> and all its design files,
            tasks, and IA data. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                removeVersion(project.id, version);
                setDeleteOpen(false);
                // Navigate to another round, or bare overview if none left
                const remaining = state.rounds.filter((r) => r !== version);
                const next = remaining.find((r) => !isVersionLocked(r, state.statuses)) ?? remaining[0];
                const base = `/we-adk/projects/${project.id}/sketcher/overview`;
                router.push(next !== undefined ? `${base}?folder=${versionFolderId(next)}` : base);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <OverviewContent />
    </Suspense>
  );
}
