'use client';

import {
  ClipboardList,
  Code2,
  Eye,
  FileText,
  Filter,
  FolderInput,
  Pencil,
  Pin,
  Plus,
  Sparkles,
  SquareTerminal,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { MeetingFilePanel } from '@/components/we-adk/meeting-files';
import { WhiteboardPanel } from '@/components/we-adk/whiteboard-panel';
import {
  businessCanvasHref,
  businessPreviewHref,
  previewHref,
} from '@/components/we-adk/mockup-board';
import { DesignThumbnail } from '@/components/we-adk/design-thumbnail';
import { MemberTargetSelect, useMemberTargets } from '@/components/we-adk/member-target-select';
import { StatusChip } from '@/components/we-adk/status-chip';
import { TaskCommentThread } from '@/components/we-adk/task-comments';
import { ALL_STATUSES, TaskFormDialog } from '@/components/we-adk/task-form-dialog';
import { TaskGenerateDialog } from '@/components/we-adk/task-generate-dialog';
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
import { findVersionScreen, versionFolderId } from '@/lib/we-adk-mock/versions';
import {
  applyTaskStatusOverrides,
  createTask,
  deleteTask,
  isUserTask,
  loadTaskStatusOverrides,
  loadUserTasks,
  projectTasks,
  setTaskStatusOverride,
  taskStatusChip,
  updateTask,
  type ProjectTask,
  type TaskStatus,
  type TaskStatusOverrides,
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
}: {
  project: DesignProject;
  task: ProjectTask;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const { t } = useLocale();
  const [savedTurns, setSavedTurns] = useState<ChatTurn[]>([]);
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [designs, setDesigns] = useState<TaskDesign[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
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
      {/* One row: task header left, chat header right */}
      <div className="bg-background flex shrink-0 border-b">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5">
          <span className="bg-primary/80 size-2.5 shrink-0 rounded-sm" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            [{task.code}] {task.title}
          </p>
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

        <div className="flex w-[26rem] shrink-0 items-center gap-2 border-l px-3 py-2.5">
          <SquareTerminal className="text-primary size-4 shrink-0" />
          <span className="text-sm font-semibold">Claude Code</span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            [{task.code}] {task.title}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            local CLI
          </Badge>
        </div>
      </div>

      {/* Content left, chat right */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Task content */}
        <div className="bg-background min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl pb-6">
            {/* Header */}
            <div className="flex items-start gap-3 px-4 pt-4">
              <span
                aria-hidden
                className="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400 flex size-9 shrink-0 items-center justify-center rounded-full"
              >
                <Pin className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.assignee}</p>
                <p className="text-muted-foreground text-[11px]">Updated {task.updatedAt}</p>
              </div>
              <StatusChip {...chip} />
            </div>

            {/* Title */}
            <div className="flex items-start justify-between gap-2 px-4 pt-4">
              <h2 className="text-lg font-semibold">
                [{task.code}] {task.title}
                {task.count != null && (
                  <span className="text-muted-foreground ml-1 font-normal">({task.count})</span>
                )}
              </h2>
              <Badge variant="outline" className="mt-1 shrink-0 font-mono text-[10px]">
                P{task.priority}
              </Badge>
            </div>

            {/* Meta fields */}
            <dl className="flex flex-col gap-2.5 px-4 pt-4 text-sm">
              <div className="flex items-center gap-4">
                <dt className="text-muted-foreground w-20 shrink-0 text-xs">Status</dt>
                <dd>
                  <Select
                    value={task.status}
                    onValueChange={(v) => {
                      const next = v as TaskStatus;
                      if (next === task.status) return;
                      // The thread is the record of what happened to the task.
                      setComments(
                        logTaskEvent(
                          project.id,
                          task,
                          `'${task.status}' → '${next}' Status has been updated.`,
                        ),
                      );
                      onStatusChange(next);
                    }}
                  >
                    <SelectTrigger size="sm" className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </dd>
              </div>
              <div className="flex items-center gap-4">
                <dt className="text-muted-foreground w-20 shrink-0 text-xs">Priority</dt>
                <dd className="text-xs">
                  {task.priority === 1 ? 'High' : task.priority === 2 ? 'Medium' : 'Low'}
                </dd>
              </div>
              <div className="flex items-center gap-4">
                <dt className="text-muted-foreground w-20 shrink-0 text-xs">Assignee</dt>
                <dd className="text-xs">{task.assignee}</dd>
              </div>
              {task.category && (
                <div className="flex items-center gap-4">
                  <dt className="text-muted-foreground w-20 shrink-0 text-xs">Category</dt>
                  <dd>
                    <Badge variant="outline" className="text-[10px]">
                      {task.category}
                    </Badge>
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-4">
                <dt className="text-muted-foreground w-20 shrink-0 text-xs">Updated</dt>
                <dd className="text-xs">{task.updatedAt}</dd>
              </div>
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-start gap-4">
                  <dt className="text-muted-foreground w-20 shrink-0 text-xs">Tags</dt>
                  <dd className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {/* Description */}
            {task.description && (
              <div className="px-4 pt-4">
                <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                  <ClipboardList className="size-3" />
                  Description
                </p>
                <p className="text-sm leading-relaxed">{task.description}</p>
              </div>
            )}

            {/* Files — the spec, the screenshot, the sheet the task refers to.
                They are read as part of the brief when the screens are drawn. */}
            <div className="px-4 pt-5">
              <MeetingFilePanel
                sessionId={filesKey}
                files={files}
                uploadedBy="You"
                onChange={() => setFiles(loadUploadedFiles(filesKey))}
              />
            </div>

            {/* The whiteboard the hint above asks for a photo of. Boards attach
                into that same list, so nothing downstream needs to know they
                were drawn here rather than uploaded.

                The two are one block, so the divider is inset to the text rather
                than run edge to edge, and sits with equal air above and below —
                a full-bleed rule under an indented paragraph reads as a seam. */}
            <div className="px-4 pt-4">
              <div className="border-border/60 flex flex-col gap-3 border-t pt-4">
                {/* The board and the cards it produces travel together. */}
                <WhiteboardPanel sessionId={filesKey} project={project} uploadedBy="You" />
              </div>
            </div>

            {/* What this task has produced so far. */}
            {designs.length > 0 && (
              <div className="px-4 pt-5">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
                    <Sparkles className="size-3" />
                    Generated designs
                  </p>
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
                </div>
                <div className="flex flex-col gap-2">
                  {designs.map((design) => {
                    const gone = goneDesigns.includes(design.screenId);
                    const staged = design.version === undefined && design.handedTo === undefined;
                    return (
                      <div key={design.screenId} className="flex gap-3 rounded-md border p-3">
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
                                href={businessCanvasHref(
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
            <div className="px-4 pt-5">
              <TaskCommentThread
                project={project}
                task={task}
                entries={comments}
                onChange={setComments}
              />
            </div>
          </div>
        </div>

        {/* Chat on the right */}
        <aside className="bg-background flex w-[26rem] shrink-0 flex-col border-l">
          <ChatPane
            project={project}
            contextText={taskChatContext(project, task, files, designs, comments)}
            folderLabel={`task/${task.code} — ${task.title}`}
            initialTurns={savedTurns}
            onPersist={(turns) => saveTaskTurns(project.id, task.id, turns)}
          />
        </aside>
      </div>

      <TaskGenerateDialog
        open={generateOpen}
        project={project}
        task={task}
        files={files}
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
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Task feed (list + detail)                                           */
/* ------------------------------------------------------------------ */
