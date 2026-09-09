'use client';

import {
  ClipboardList,
  Code2,
  Eye,
  FileCode2,
  FileText,
  Hammer,
  Filter,
  FolderInput,
  ListTree,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  SquareTerminal,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { prdForTask, screenForTask, PRD_TASK_TAGS, PRD_DOCUMENTS } from '@/lib/we-adk-mock/ia';
import { updateTask as persistTask } from '@/lib/we-adk-mock/tasks';
import { PROTOTYPE_FILES } from '@/lib/we-adk/prototype';
import { MeetingFilePanel } from '@/components/we-adk/meeting-files';
import { WhiteboardPanel } from '@/components/we-adk/whiteboard-panel';
import {
  businessEditHref,
  businessPreviewHref,
  previewHref,
} from '@/components/we-adk/mockup-board';
import { DesignThumbnail } from '@/components/we-adk/design-thumbnail';
import { MemberPicker } from '@/components/we-adk/member-picker';
import { MemberTargetSelect, useMemberTargets } from '@/components/we-adk/member-target-select';
import { StatusChip } from '@/components/we-adk/status-chip';
import { TaskCommentThread } from '@/components/we-adk/task-comments';
import { TaskGenerateDialog } from '@/components/we-adk/task-generate-dialog';
import { taskRound } from '@/components/we-adk/version-rail';
import {
  designHtmlFileName,
  designToHtml,
  downloadDesignHtml,
  openDesignHtml,
} from '@/lib/we-adk/design-html';
import {
  loadTaskDesigns,
  markTaskDesignHandedTo,
  removeTaskDesign,
  taskFilesKey,
  taskStageKey,
  type TaskDesign,
} from '@/lib/we-adk/task-design';
import { hasBuild, loadBuildSession } from '@/lib/we-adk-mock/build';
import { STAGE_LABELS } from '@/lib/we-adk/build-types';
import { loadUploadedFiles, type MeetingFile } from '@/lib/we-adk-mock/meeting-files';
import { loadScreenBlocks } from '@/lib/we-adk-mock/sketcher';
import { loadGeneratedScreens } from '@/lib/we-adk-mock/sketches';
import {
  CURRENT_PERSON,
  formatEntryTime,
  loadTaskComments,
  logTaskEvent,
  type TaskComment,
} from '@/lib/we-adk-mock/task-comments';
import {
  findVersionScreen,
  isVersionLocked,
  loadVersionStatuses,
  versionFolderId,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';
import {
  applyTaskStatusOverrides,
  createTask,
  deleteTask,
  isUserTask,
  loadTaskStatusOverrides,
  loadTaskAssignmentOverrides,
  loadTaskVersionOverrides,
  loadTestedByOverrides,
  needsHumanTester,
  loadUserTasks,
  projectRounds,
  projectTasks,
  setTaskStatusOverride,
  setTaskAssignmentOverride,
  setTaskVersionOverride,
  setTestedByOverride,
  taskStatusChip,
  updateTask,
  TESTED_BY_OPTIONS,
  type ProjectTask,
  type TaskStatus,
  type TaskStatusOverrides,
  type TestedBy,
} from '@/lib/we-adk-mock/tasks';
import { findProject, type DesignProject } from '@/lib/we-adk-mock/projects';
import { giveScreenToMember } from '@/lib/we-adk/user-workspace';
import { designDiff, type DesignDiff } from '@/lib/we-adk/design-diff';
import { DiffSummary } from '@/components/we-adk/design-diff-view';
/**
 * One task, in full — the detail both the Business and Developer tabs show.
 *
 * Extracted from the Business task page rather than reimplemented: the two tabs
 * are looking at the same task, so a second copy of this would drift the moment
 * either side gained a field. Business owns creating and filing tasks; Developer
 * picks one up and builds it. The detail itself is identical, Claude Code pane
 * included.
 */

/* ------------------------------------------------------------------ */
/* Chat persistence                                                    */
/* ------------------------------------------------------------------ */

const TASK_CHAT_KEY = 'we-adk:task-chat';

function loadTaskTurns(projectId: string, taskId: string): ChatTurn[] {
  try {
    const raw = window.localStorage.getItem(`${TASK_CHAT_KEY}:${projectId}:${taskId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

function saveTaskTurns(projectId: string, taskId: string, turns: ChatTurn[]): void {
  try {
    window.localStorage.setItem(
      `${TASK_CHAT_KEY}:${projectId}:${taskId}`,
      JSON.stringify(turns.slice(-40)),
    );
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Task detail panel                                                   */
/* ------------------------------------------------------------------ */

/** Two letters for the byline avatar — CJK names carry in one character. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * A property control, quiet until pointed at.
 *
 * The fields are settings to nudge, not a form to fill — so the value reads
 * as text, and the border only appears when the pointer says "this one".
 */
const GHOST_TRIGGER =
  'h-7 w-fit max-w-full gap-1 border-none bg-transparent px-2 text-xs font-medium shadow-none ' +
  'hover:bg-muted/60 data-[state=open]:bg-muted/60 dark:hover:bg-muted/60';

/** One row of the properties grid: a muted label, then its control. */
function Property({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 items-start gap-2', className)}>
      <span className="text-muted-foreground w-24 shrink-0 text-xs leading-7">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Every section carries the same header, so the page reads as one rhythm. */
function SectionHeader({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof FileCode2;
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Icon className="size-4" />
      <p className="text-sm font-semibold">{title}</p>
      {count !== undefined && <span className="text-muted-foreground text-xs">{count}</span>}
      {children}
    </div>
  );
}

function taskChatContext(
  project: DesignProject,
  task: ProjectTask,
  files: MeetingFile[],
  designs: TaskDesign[],
  comments: TaskComment[],
): string {
  const parts = [
    `Project: ${project.name} — ${project.customer}.`,
    `Task: [${task.code}] ${task.title}`,
    `Status: ${task.status}`,
    `Assignee: ${task.assignee}`,
    `Priority: ${task.priority === 1 ? 'High' : task.priority === 2 ? 'Medium' : 'Low'}`,
    `Updated: ${task.updatedAt}`,
  ];
  if (task.category) parts.push(`Category: ${task.category}`);
  if (task.testedBy) parts.push(`Tested by: ${task.testedBy}`);
  if (task.tester) parts.push(`Human tester: ${task.tester}`);
  parts.push(task.version ? `Round: version ${task.version}` : 'Round: unscheduled');
  if (task.description) parts.push('', 'Description:', task.description);
  if (task.tags?.length) parts.push('', `Tags: ${task.tags.join(', ')}`);
  if (files.length > 0) {
    parts.push(
      '',
      'Attached files:',
      ...files.map((file) => `- ${file.name}${file.note ? ` — ${file.note}` : ''}`),
    );
  }
  if (designs.length > 0) {
    parts.push(
      '',
      'Screens already generated from this task:',
      ...designs.map(
        (design) =>
          `- ${design.name}${design.route ? ` (${design.route})` : ''}, version ${design.version}`,
      ),
    );
  }
  // The thread is where the reasoning lives — Claude should read it too.
  if (comments.length > 0) {
    parts.push(
      '',
      'Thread on this task (oldest first):',
      ...comments
        .slice(-25)
        .map(
          (entry) =>
            `- ${formatEntryTime(entry.at)} ${entry.author}${
              entry.kind === 'system' ? ' (system)' : ''
            }: ${entry.text}`,
        ),
    );
  }
  return parts.join('\n');
}

export function TaskDetail({
  project,
  task,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onSendToBuild,
  canGenerate = true,
  showChat = true,
}: {
  project: DesignProject;
  task: ProjectTask;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  /**
   * Open the build for this task. Absent where there is nowhere to go, so the
   * button is never offered as a dead end — and offered only when a build
   * actually exists, which is checked below rather than assumed.
   */
  onSendToBuild?: () => void;
  /**
   * Offer "Generate UI". Business raises the screens a task needs; Developer
   * builds against screens that already exist, so the button is off there.
   */
  canGenerate?: boolean;
  /** Show the Claude AI chat pane on the right. */
  showChat?: boolean;
}) {
  const { t } = useLocale();
  const [savedTurns, setSavedTurns] = useState<ChatTurn[]>([]);
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [designs, setDesigns] = useState<TaskDesign[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [iaDialogOpen, setIaDialogOpen] = useState(false);
  const currentPrd = prdForTask(task);
  /**
   * What the build did, as thread entries.
   *
   * The build's steps and the conversation about the task are the same story
   * told in two places; merging them means the thread answers "what happened
   * to this task" without a second panel to go and read.
   */
  const [buildActivity, setBuildActivity] = useState<TaskComment[]>([]);
  /**
   * Whether a build exists for this task at all.
   *
   * Read after mount — the seeds live in localStorage — and false by default, so
   * the first paint offers no control it might have to take away.
   */
  const [buildExists, setBuildExists] = useState(false);
  const [testedBy, setTestedBy] = useState<TestedBy>(task.testedBy ?? 'Not tested');
  const [assignee, setAssignee] = useState<string | undefined>(task.assignee);
  const [tester, setTester] = useState<string | undefined>(task.tester);
  const [version, setVersion] = useState<number | null>(task.version ?? null);
  /** The rounds Business has, with which of them have shipped. */
  const [rounds, setRounds] = useState<{ list: number[]; statuses: VersionStatuses }>({
    list: [],
    statuses: {},
  });
  const [moveRefresh, setMoveRefresh] = useState(0);
  /** Designs whose file was deleted with its version — links would go nowhere. */
  const [goneDesigns, setGoneDesigns] = useState<string[]>([]);
  const chip = taskStatusChip(task.status);
  const filesKey = taskFilesKey(project.id, task.id);

  // Who samples go to — chosen here, before anything moves. Defaults to the
  // person the task is assigned to.
  const {
    members,
    memberId,
    setMemberId,
    selected: moveSelected,
    version: moveVersion,
    blocker: moveBlocker,
  } = useMemberTargets(project.id, task.assignee, moveRefresh);

  // `task.updatedAt` is in the deps so an edit made in the dialog brings the
  // thread's new line back with it.
  useEffect(() => {
    setSavedTurns(loadTaskTurns(project.id, task.id));
    setFiles(loadUploadedFiles(filesKey));
    setDesigns(loadTaskDesigns(project.id, task.id));
    setComments(loadTaskComments(project.id, task));
    setBuildExists(hasBuild(task.id));
    const session = loadBuildSession(task.id);
    const today = new Date().toISOString().slice(0, 10);
    setBuildActivity(
      session.activities
        // Steps that have not run have no time and nothing to report yet.
        .filter((entry) => entry.at !== '—')
        .map((entry) => ({
          id: `build-${entry.id}`,
          kind: 'system' as const,
          author: session.builder,
          at: `${today}T${entry.at.slice(0, 5)}`,
          text: [
            `${STAGE_LABELS[entry.stage]} · ${entry.title}`,
            entry.detail ?? '',
            entry.status === 'complete' ? '' : `(${entry.status})`,
          ]
            .filter(Boolean)
            .join(' — '),
        })),
    );
    // The stored choice wins over the seeded one, and switching tasks must not
    // leave the previous task's answer on screen.
    setTestedBy(loadTestedByOverrides(project.id)[task.id] ?? task.testedBy ?? 'Not tested');
    const assignment = loadTaskAssignmentOverrides(project.id)[task.id];
    setAssignee(assignment?.assignee ?? task.assignee);
    setTester(assignment?.tester === undefined ? task.tester : assignment.tester || undefined);
    const versionOverrides = loadTaskVersionOverrides(project.id);
    setVersion(task.id in versionOverrides ? versionOverrides[task.id]! : (task.version ?? null));
    setRounds({
      list: projectRounds(project.id),
      statuses: loadVersionStatuses(project.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, task.id, filesKey, task.updatedAt]);

  // A moved design can be deleted from the other side — its round removed, the
  // file dropped. Links to it would go nowhere, so the row says so instead.
  useEffect(() => {
    setGoneDesigns(
      designs
        .filter((design) => design.version !== undefined && !findVersionScreen(design.screenId))
        .map((design) => design.screenId),
    );
  }, [designs]);

  /**
   * Hands a sample to the chosen person: a copy lands in their workspace with its
   * own canvas. It reaches Main when they merge it from the User tab, so the
   * person whose task this is sees it before the round does.
   */
  const handDesign = (design: TaskDesign) => {
    if (!moveSelected) return;
    const today = new Date().toISOString().slice(0, 10);
    const screen = loadGeneratedScreens(taskStageKey(project.id, task.id)).find(
      (entry) => entry.id === design.screenId,
    );
    if (!screen) return;
    const given = giveScreenToMember(project.id, moveSelected.id, screen);
    if (!given) return;
    setDesigns(
      markTaskDesignHandedTo(
        project.id,
        task.id,
        design.screenId,
        {
          id: moveSelected.id,
          name: moveSelected.name,
          version: given.version,
          screenId: given.screen.id,
        },
        today,
      ),
    );
    setMoveRefresh((count) => count + 1);
    setComments(
      logTaskEvent(
        project.id,
        task,
        `Handed "${design.name}" to ${moveSelected.name} — version ${given.version} workspace.`,
      ),
    );
  };

  /**
   * How far a handed-over design has moved since it was handed over: the sample
   * on the task against the copy in that person's workspace. Read after mount —
   * both canvases live in localStorage.
   */
  const [handedDiffs, setHandedDiffs] = useState<Record<string, DesignDiff>>({});
  useEffect(() => {
    const map: Record<string, DesignDiff> = {};
    for (const design of designs) {
      if (!design.handedTo) continue;
      map[design.screenId] = designDiff(
        { blocks: loadScreenBlocks(design.screenId, 'listPage'), layout: null },
        { blocks: loadScreenBlocks(design.handedTo.screenId, 'listPage'), layout: null },
      );
    }
    setHandedDiffs(map);
  }, [designs]);

  /** A generated screen as a standalone html page, drawn from its canvas. */
  const designHtml = (design: TaskDesign): string =>
    designToHtml({
      name: design.name,
      blocks: loadScreenBlocks(design.screenId, 'listPage'),
      route: design.route,
      origin: `${project.name} · task [${task.code}] ${task.title}`,
      createdAt: design.createdAt,
    });

  /** The same, for the copy sitting in someone's workspace. */
  const handedHtml = (design: TaskDesign): string =>
    designToHtml({
      name: design.name,
      blocks: loadScreenBlocks(design.handedTo!.screenId, 'listPage'),
      route: design.route,
      origin: `${project.name} · ${design.handedTo!.name}, version ${design.handedTo!.version}`,
      createdAt: design.movedAt ?? design.createdAt,
    });

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Content left, chat right */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Task column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Task header */}
          <div className="bg-background flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
            <span className="bg-primary/80 size-2.5 shrink-0 rounded-sm" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              [{task.code}] {task.title}
            </p>
          {/* A task and its build are two things. Most tasks have no build: a
              feature build is raised by completing a round, a fix build by
              reporting something broken. So this opens a build that exists
              rather than pretending to make one, and it is absent when there is
              none — sending a task "to Build" only landed the reader on a
              different build, or on the empty state. */}
          {onSendToBuild && buildExists && (
            <Button
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              onClick={onSendToBuild}
              title={`Open the build for ${task.code}`}
            >
              <Hammer className="size-3" />
              Open build
            </Button>
          )}
          {canGenerate && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              onClick={() => setGenerateOpen(true)}
              title={t('taskPage.generateDesign')}
            >
              <Sparkles className="size-3" />
              Generate UI
            </Button>
          )}
          <Button
            size="sm"
            variant={currentPrd ? 'secondary' : 'outline'}
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={() => setIaDialogOpen(true)}
          >
            <ListTree className="size-3" />
            {currentPrd ? currentPrd.id : 'Move to IA'}
          </Button>
          <button
            type="button"
            onClick={onEdit}
            title={t('taskPage.editTask')}
            aria-label={t('taskPage.editTask')}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t('taskPage.deleteTask')}
            aria-label={t('taskPage.deleteTask')}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('taskPage.closePanel')}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-4" />
          </button>

          </div>

          {/* Task content */}
          <div className="bg-background min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 pb-8">
            {/* Hero — the title leads, because it is what the page is about.
                The chips above it answer "where is this?" in one glance, and
                the byline below answers "whose, and how fresh?". */}
            <div className="pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium">
                  {task.code}
                </span>
                <StatusChip {...chip} />
                <Badge variant="outline" className="text-[10px]">
                  {task.priority === 1 ? 'High' : task.priority === 2 ? 'Medium' : 'Low'} priority
                </Badge>
                {task.category && (
                  <Badge variant="secondary" className="text-[10px]">
                    {task.category}
                  </Badge>
                )}
              </div>

              <h2 className="mt-2.5 text-xl leading-snug font-semibold tracking-tight">
                {task.title}
                {task.count != null && (
                  <span className="text-muted-foreground ml-1.5 font-normal">({task.count})</span>
                )}
              </h2>

              <div className="text-muted-foreground mt-2.5 flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                >
                  {initialsOf(assignee ?? task.assignee)}
                </span>
                <span className="text-foreground font-medium">{assignee ?? task.assignee}</span>
                <span aria-hidden>·</span>
                <span>Updated {task.updatedAt}</span>
              </div>
            </div>

            {/* The task's handles — who has it, where it goes, how it is
                verified. A quiet grid between two hairlines rather than a
                boxed form: these are settings to nudge, and a page of large
                bordered fields made the record read like data entry. */}
            <div className="border-border/70 mt-5 grid gap-x-10 gap-y-1 border-y py-3 sm:grid-cols-2">
              <Property label="Assignee">
                <MemberPicker
                  projectId={project.id}
                  value={assignee}
                  className={GHOST_TRIGGER}
                  onChange={(next) => {
                    setAssignee(next);
                    setTaskAssignmentOverride(project.id, task.id, { assignee: next ?? '' });
                  }}
                />
              </Property>

              {/* A shipped round takes no new work, so it is offered as a
                  label rather than a destination. A task with no round of its
                  own reads as the one being worked on — the same round the
                  board files it under, rather than a blank field. */}
              <Property label="Version">
                <Select
                  value={String(
                    taskRound(
                      { ...task, version: version ?? undefined },
                      rounds.list,
                      rounds.statuses,
                    ) ?? '',
                  )}
                  onValueChange={(next) => {
                    const parsed = Number(next);
                    setVersion(parsed);
                    setTaskVersionOverride(project.id, task.id, parsed);
                  }}
                >
                  <SelectTrigger size="sm" className={GHOST_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.list.map((entry) => {
                      const locked = isVersionLocked(entry, rounds.statuses);
                      return (
                        <SelectItem
                          key={entry}
                          value={String(entry)}
                          disabled={locked && entry !== version}
                        >
                          Version {entry}
                          {locked ? ' · Released' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Property>

              {/* Changeable here rather than only in the edit form: who
                  verifies the work is a decision that moves with it. */}
              <Property label="Tested by">
                <Select
                  value={testedBy}
                  onValueChange={(next) => {
                    setTestedBy(next as TestedBy);
                    setTestedByOverride(project.id, task.id, next as TestedBy);
                  }}
                >
                  <SelectTrigger size="sm" className={GHOST_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TESTED_BY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Property>

              {/* Only asked when a human is part of the verification — the
                  question is meaningless for an AI-only check. */}
              {needsHumanTester(testedBy) && (
                <Property label="Tester">
                  <MemberPicker
                    projectId={project.id}
                    value={tester}
                    showRoles
                    placeholder="Nobody yet"
                    className={GHOST_TRIGGER}
                    onChange={(next) => {
                      setTester(next);
                      setTaskAssignmentOverride(project.id, task.id, { tester: next ?? '' });
                    }}
                  />
                  {tester && tester === assignee && (
                    <p className="px-2 pb-1 text-[10px] text-amber-600 dark:text-amber-400">
                      The tester is also the assignee — human verification usually wants a second
                      pair of eyes.
                    </p>
                  )}
                </Property>
              )}

              {task.tags && task.tags.length > 0 && (
                <Property label="Tags" className="sm:col-span-2">
                  <div className="flex min-h-7 flex-wrap items-center gap-1 px-2">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Property>
              )}

              {(() => {
                const prd = prdForTask(task);
                if (!prd) return null;
                const route = screenForTask(task);
                const screen = route ? PROTOTYPE_FILES.find((p) => p.route === route) : null;
                const screenIndex = screen ? PROTOTYPE_FILES.indexOf(screen) : -1;
                const versionNum = taskRound(task, rounds.list, rounds.statuses) ?? 1;
                const screenCode = screenIndex >= 0 ? `SC-${versionNum}-${String(screenIndex + 1).padStart(3, '0')}` : null;
                return (
                  <>
                    <Property label="PRD" className="sm:col-span-2">
                      <div className="flex min-h-7 items-center gap-1.5 px-2">
                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{prd.id}</span>
                        <span className="text-xs">{prd.title}</span>
                      </div>
                    </Property>
                    {screen && (
                      <Property label="Screen" className="sm:col-span-2">
                        <div className="flex min-h-7 items-center gap-1.5 px-2">
                          {screenCode && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">{screenCode}</span>}
                          <span className="text-xs">{screen.name}</span>
                          <span className="text-muted-foreground text-[10px]">{screen.fileName}</span>
                        </div>
                      </Property>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Description */}
            {task.description && (
              <div className="pt-7">
                <SectionHeader icon={ClipboardList} title="Description" />
                <p className="mt-2 text-sm leading-relaxed">{task.description}</p>
              </div>
            )}

            {/* Files — the spec, the screenshot, the sheet the task refers to.
                They are read as part of the brief when the screens are drawn. */}
            <div className="pt-7">
              <MeetingFilePanel
                sessionId={filesKey}
                files={files}
                uploadedBy="You"
                onChange={() => setFiles(loadUploadedFiles(filesKey))}
              />
            </div>

            {/* The whiteboard the hint above asks for a photo of. Boards attach
                into that same list, so nothing downstream needs to know they
                were drawn here rather than uploaded. */}
            <div className="pt-7">
              <WhiteboardPanel sessionId={filesKey} project={project} uploadedBy="You" />
            </div>

            {/* What this task has produced so far. */}
            {designs.length > 0 && (
              <div className="pt-7">
                <SectionHeader icon={Sparkles} title="Generated designs" count={designs.length}>
                  {/* Pick the destination first; nothing moves on its own. */}
                  {designs.some(
                    (design) => design.version === undefined && design.handedTo === undefined,
                  ) && (
                    <MemberTargetSelect
                      members={members}
                      memberId={memberId}
                      onChange={setMemberId}
                      version={moveVersion}
                      blocker={moveBlocker}
                      className="ml-auto"
                    />
                  )}
                </SectionHeader>
                <div className="mt-2 flex flex-col gap-2">
                  {designs.map((design) => {
                    const gone = goneDesigns.includes(design.screenId);
                    const staged = design.version === undefined && design.handedTo === undefined;
                    return (
                      <div key={design.screenId} className="flex gap-3 rounded-lg border p-3">
                        {/* The sample itself, drawn from the blocks Claude proposed. */}
                        <DesignThumbnail
                          screenId={design.screenId}
                          width={180}
                          height={124}
                          className={gone ? 'opacity-40' : undefined}
                        />

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Code2 className="text-muted-foreground size-3.5 shrink-0" />
                            {staged || gone ? (
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {design.name}
                              </span>
                            ) : (
                              <Link
                                href={businessEditHref(
                                  project.id,
                                  design.screenId,
                                  versionFolderId(design.version!),
                                )}
                                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                              >
                                {design.name}
                              </Link>
                            )}
                            {gone ? (
                              <Badge variant="muted" className="shrink-0 text-[10px]">
                                file deleted
                              </Badge>
                            ) : staged ? (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                sample
                              </Badge>
                            ) : design.version !== undefined ? (
                              <Badge variant="success" className="shrink-0 text-[10px]">
                                v{design.version}
                              </Badge>
                            ) : null}
                            {/* Whether the person it went to has changed it
                                since — the same +/−/~ the merge dialog shows. */}
                            {handedDiffs[design.screenId] && (
                              <DiffSummary diff={handedDiffs[design.screenId]!} />
                            )}
                            {design.handedTo && (
                              <Badge
                                variant="info"
                                className="shrink-0 text-[10px]"
                                title={`In ${design.handedTo.name}'s workspace for version ${design.handedTo.version} — they merge it into Main`}
                              >
                                {design.handedTo.name}
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDesigns(removeTaskDesign(project.id, task.id, design.screenId))
                              }
                              title={t('taskPage.unlinkTask')}
                              aria-label={`Unlink ${design.name} from this task`}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>

                          <p className="text-muted-foreground truncate font-mono text-[11px]">
                            {design.route ?? designHtmlFileName(design.name)}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {gone ? (
                              <span className="text-muted-foreground text-[11px]">
                                Its version was removed — unlink it, or generate again.
                              </span>
                            ) : staged ? (
                              <Button
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => handDesign(design)}
                                disabled={!moveSelected || moveBlocker !== null}
                                title={
                                  moveBlocker !== null
                                    ? 'No open round to hand this into'
                                    : moveSelected
                                      ? `Put a copy in ${moveSelected.name}'s workspace`
                                      : 'Pick a person first'
                                }
                              >
                                <FolderInput className="size-3" />
                                Hand to {moveSelected?.name ?? '…'}
                              </Button>
                            ) : design.version !== undefined ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                asChild
                              >
                                <Link
                                  href={businessPreviewHref(
                                    project.id,
                                    design.screenId,
                                    versionFolderId(design.version),
                                  )}
                                >
                                  <Eye className="size-3" />
                                  Preview
                                </Link>
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => openDesignHtml(designHtml(design))}
                            >
                              <FileText className="size-3" />
                              Open html
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => downloadDesignHtml(design.name, designHtml(design))}
                            >
                              .html
                            </Button>
                            <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                              {design.movedAt ?? design.createdAt}
                            </span>
                          </div>

                          {/* The copy in someone's workspace, as its own entry.
                              The sample above is what was generated; this is what
                              they have made of it, and it can be read from here
                              without going to find their tab. */}
                          {design.handedTo && (
                            <div className="mt-1.5 min-w-0 rounded-md border border-dashed">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-2 py-1.5">
                                <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
                                  {design.handedTo.name}&rsquo;s copy · version{' '}
                                  {design.handedTo.version}
                                </span>
                                {handedDiffs[design.screenId] &&
                                handedDiffs[design.screenId]!.added +
                                  handedDiffs[design.screenId]!.removed +
                                  handedDiffs[design.screenId]!.changed >
                                  0 ? (
                                  <Badge variant="warning" className="shrink-0 text-[10px]">
                                    modified
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    unchanged
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 gap-1 px-2 text-[11px]"
                                  asChild
                                >
                                  <a
                                    href={previewHref(design.handedTo.screenId, project.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Eye className="size-3" />
                                    Preview
                                  </a>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 gap-1 px-2 text-[11px]"
                                  onClick={() => openDesignHtml(handedHtml(design))}
                                >
                                  <FileText className="size-3" />
                                  Open html
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 gap-1 px-2 text-[11px]"
                                  onClick={() =>
                                    downloadDesignHtml(design.name, handedHtml(design))
                                  }
                                >
                                  .html
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted-foreground mt-1.5 text-[11px]">
                  A sample stays on the task. Handing it over puts a copy in that person&rsquo;s
                  workspace in the User tab, with its own canvas — it reaches the Main tab only when
                  they merge it. Unlinking only removes the link.
                </p>
              </div>
            )}

            {/* The conversation, and the record of what the task has done. */}
            <div className="pt-7">
              <TaskCommentThread
                project={project}
                task={task}
                entries={comments}
                activity={buildActivity}
                onChange={setComments}
              />
            </div>
          </div>
        </div>
        </div>

        {showChat && (
          chatCollapsed ? (
            <button
              type="button"
              onClick={() => setChatCollapsed(false)}
              title="Open AI chat"
              aria-label="Open AI chat"
              className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 shadow-lg transition-colors hover:bg-muted"
            >
              <MessageSquare className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium">AI Chat</span>
            </button>
          ) : (
            <aside className="bg-background flex w-[26rem] shrink-0 flex-col border-l">
              <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">AI Chat</span>
                <button
                  type="button"
                  onClick={() => setChatCollapsed(true)}
                  title="Close chat"
                  aria-label="Close chat"
                  className="text-muted-foreground hover:text-foreground rounded p-0.5"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <ChatPane
                project={project}
                contextText={taskChatContext(project, task, files, designs, comments)}
                folderLabel={`task/${task.code} — ${task.title}`}
                initialTurns={savedTurns}
                onPersist={(turns) => saveTaskTurns(project.id, task.id, turns)}
              />
            </aside>
          )
        )}
      </div>

      <TaskGenerateDialog
        open={generateOpen}
        project={project}
        task={task}
        files={files}
        chatTurns={savedTurns}
        comments={comments}
        onClose={() => setGenerateOpen(false)}
        onCreated={(created) => {
          setDesigns(loadTaskDesigns(project.id, task.id));
          setComments(
            logTaskEvent(
              project.id,
              task,
              `Generated ${created.length} design sample${created.length === 1 ? '' : 's'} from this task: ${created
                .map((design) => design.name)
                .join(', ')}.`,
            ),
          );
        }}
        onMoved={(next, name, version) => {
          setDesigns(next);
          setComments(logTaskEvent(project.id, task, `Moved "${name}" into version ${version}.`));
        }}
      />
      {/* Move to IA dialog */}
      <Dialog open={iaDialogOpen} onOpenChange={setIaDialogOpen}>
        <DialogContent className="!max-w-sm p-0 gap-0 [&>button:last-child]:hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <DialogHeader className="!flex-row items-center gap-2 !space-y-0">
              <ListTree className="size-4 text-violet-500" />
              <DialogTitle className="text-sm font-medium">Link to PRD</DialogTitle>
            </DialogHeader>
            <button type="button" onClick={() => setIaDialogOpen(false)} className="text-muted-foreground hover:text-foreground rounded p-1">
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
            {Object.entries(PRD_DOCUMENTS).map(([prdId, doc]) => {
              const isLinked = currentPrd?.id === prdId;
              return (
                <button
                  key={prdId}
                  type="button"
                  onClick={() => {
                    // Remove all PRD-related tags, then add the new PRD's tag
                    const allPrdTags = new Set(Object.values(PRD_TASK_TAGS).flat());
                    const cleaned = (task.tags ?? []).filter((t) => !allPrdTags.has(t));
                    const newTag = (PRD_TASK_TAGS[prdId] ?? [])[0];
                    const newTags = newTag ? [...cleaned, newTag] : cleaned;
                    persistTask(project.id, { ...task, tags: newTags });
                    onStatusChange(task.status);
                    setIaDialogOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                    isLinked ? 'bg-primary/10' : 'hover:bg-muted/50',
                  )}
                >
                  <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{prdId}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{doc.title}</span>
                  {isLinked && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Task feed (list + detail)                                           */
/* ------------------------------------------------------------------ */
