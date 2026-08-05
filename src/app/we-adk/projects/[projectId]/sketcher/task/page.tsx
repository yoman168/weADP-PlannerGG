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
import { TaskDetail } from '@/components/we-adk/task-detail';

function TaskFeed() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const project = findProject(params.projectId);

  const { t } = useLocale();
  const selectedId = searchParams.get('task');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [userTasks, setUserTasks] = useState<ProjectTask[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  // Statuses moved on seeded tasks. Loaded after mount like everything else
  // that comes out of storage, so the server and the client agree.
  const [statusMoves, setStatusMoves] = useState<TaskStatusOverrides>({});

  useEffect(() => {
    if (!project) return;
    setUserTasks(loadUserTasks(project.id));
    setStatusMoves(loadTaskStatusOverrides(project.id));
  }, [project]);

  if (!project) {
    return (
      <p className="text-muted-foreground px-6 py-16 text-center text-sm">
        That project does not exist.
      </p>
    );
  }

  const allTasks = applyTaskStatusOverrides(
    [...userTasks, ...projectTasks(project.id)],
    statusMoves,
  );
  const tasks = statusFilter ? allTasks.filter((t) => t.status === statusFilter) : allTasks;
  const selected = allTasks.find((t) => t.id === selectedId) ?? null;
  const base = `/we-adk/projects/${project.id}/sketcher/task`;

  const select = (taskId: string | null) => {
    router.replace(taskId ? `${base}?task=${taskId}` : base, { scroll: false });
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = (fields: Parameters<typeof createTask>[1]) => {
    const task = createTask(project.id, fields);
    setUserTasks((prev) => [task, ...prev]);
    setFormOpen(false);
    select(task.id);
    flash(`Task [${task.code}] created.`);
  };

  const handleEdit = (fields: Parameters<typeof createTask>[1]) => {
    if (!editingTask) return;
    const updated: ProjectTask = {
      ...editingTask,
      ...fields,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    updateTask(project.id, updated);
    setUserTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    // The detail pane reloads its thread when updatedAt changes, so this line
    // shows up there without any wiring between the two.
    logTaskEvent(project.id, updated, `${CURRENT_PERSON} edited the task details.`);
    setEditingTask(undefined);
    setFormOpen(false);
    flash(`Task [${updated.code}] updated.`);
  };

  const handleDelete = (taskId: string) => {
    deleteTask(project.id, taskId);
    setUserTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedId === taskId) select(null);
    flash('Task deleted.');
  };

  const handleStatusChange = (task: ProjectTask, status: TaskStatus) => {
    if (isUserTask(task.id)) {
      const updated = { ...task, status, updatedAt: new Date().toISOString().slice(0, 10) };
      updateTask(project.id, updated);
      setUserTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      return;
    }
    // A seeded task is module data, so the move is kept next to it — otherwise
    // the control springs back and the line the thread just wrote is a lie.
    setStatusMoves(setTaskStatusOverride(project.id, task.id, status));
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left list */}
      <div
        className={cn(
          'bg-background flex min-h-0 flex-col border-r lg:w-[22rem] lg:shrink-0',
          selected ? 'hidden lg:flex' : 'w-full',
        )}
      >
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setStatusFilter(null);
              setShowFilter(false);
            }}
            className={cn(
              'text-sm font-semibold',
              !statusFilter ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setShowFilter((v) => !v)}
            className={cn(
              'flex items-center gap-1 text-sm',
              showFilter || statusFilter
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Filter className="size-3.5" />
            Filter
          </button>

          <span className="flex-1" />

          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              setEditingTask(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-3" />
            New task
          </Button>
        </div>

        {/* Filter row */}
        {showFilter && (
          <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
            {ALL_STATUSES.map((s) => {
              const chip = taskStatusChip(s);
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border',
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Task rows */}
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {tasks.map((task) => {
            const isSelected = task.id === selectedId;
            const chip = taskStatusChip(task.status);
            const isComplete = task.status === 'Complete';
            return (
              <div
                key={task.id}
                className={cn(
                  'group/task flex w-full items-center transition-colors',
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => select(isSelected ? null : task.id)}
                  aria-pressed={isSelected}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
                >
                  <Pin
                    className="text-violet-500 dark:text-violet-400 size-4 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm',
                        isComplete ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      [{task.code}] {task.title}
                      {task.count != null && (
                        <span className="text-muted-foreground ml-1 font-normal">
                          ({task.count})
                        </span>
                      )}
                    </span>
                  </span>
                  <StatusChip {...chip} className="ml-auto shrink-0" />
                </button>
                <div className="flex shrink-0 items-center gap-1 pr-3 opacity-0 transition-opacity group-hover/task:opacity-100 focus-visible:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(task);
                      setFormOpen(true);
                    }}
                    title={t('taskPage.edit')}
                    aria-label={`Edit [${task.code}] ${task.title}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(task.id)}
                    title={t('taskPage.delete')}
                    aria-label={`Delete [${task.code}] ${task.title}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              {statusFilter ? `No ${statusFilter.toLowerCase()} tasks.` : 'No tasks yet.'}
            </p>
          )}
        </div>
      </div>

      {/* Right detail */}
      {selected ? (
        <TaskDetail
          key={selected.id}
          project={project}
          task={selected}
          onClose={() => select(null)}
          onEdit={() => {
            setEditingTask(selected);
            setFormOpen(true);
          }}
          onDelete={() => handleDelete(selected.id)}
          onStatusChange={(status) => handleStatusChange(selected, status)}
        />
      ) : (
        <div className="text-muted-foreground hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center lg:flex">
          <ClipboardList className="size-5" />
          <p className="text-foreground text-sm font-medium">Pick a task on the left.</p>
          <p className="max-w-sm text-xs">
            Task details, description, and discussion will open here.
          </p>
        </div>
      )}

      {/* Create / Edit dialog */}
      <TaskFormDialog
        open={formOpen}
        initial={editingTask}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(undefined);
        }}
        onSave={editingTask ? handleEdit : handleCreate}
      />

      {toast && (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-xs shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function BusinessTaskPage() {
  return (
    <Suspense
      fallback={
        <p className="text-muted-foreground px-6 py-16 text-center text-sm">Loading tasks…</p>
      }
    >
      <TaskFeed />
    </Suspense>
  );
}
