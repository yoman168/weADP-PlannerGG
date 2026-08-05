'use client';

/**
 * Developer tool.
 *
 * A task, and Claude Code to build it with. That is the whole tab.
 *
 * The task says what to do and the round's DESIGN.md says what it must look like,
 * so both go into the conversation as context — a developer should not have to
 * paste either one. Moving the task through its statuses happens here too,
 * because the person doing the work is the one who knows where it stands.
 */

import { ClipboardList, Code2, Filter, Pin, Plus, SquareTerminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Button, cn } from '@/components/ui';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { LiveWorkspace } from '@/components/we-adk/live-workspace';
import { StatusChip } from '@/components/we-adk/status-chip';
import { ALL_STATUSES, TaskFormDialog } from '@/components/we-adk/task-form-dialog';
import { TaskDetail } from '@/components/we-adk/task-detail';
import { loadBoardChat, saveBoardChat } from '@/lib/we-adk/board-chat';
import { designSystemToMarkdown } from '@/lib/we-adk/design-systems';
import { loadDesignLink, type DesignLink } from '@/lib/we-adk/developer-design-link';
import { useLocale } from '@/lib/locale';
import { findProject } from '@/lib/we-adk-mock/projects';
import {
  applyTaskStatusOverrides,
  createTask,
  loadTaskStatusOverrides,
  loadUserTasks,
  projectTasks,
  setTaskStatusOverride,
  taskStatusChip,
  type ProjectTask,
  type TaskStatus,
} from '@/lib/we-adk-mock/tasks';

const SUB_TABS = [
  { id: 'task' as const, label: 'Task', icon: ClipboardList },
  { id: 'development' as const, label: 'Development', icon: Code2 },
];

/* ------------------------------------------------------------------ */
/* Pane 1 — the tasks                                                  */
/* ------------------------------------------------------------------ */

/**
 * The task list, in the Business tab's figure.
 *
 * Same row as the Business list — pin, `[CODE] Title (count)`, strikethrough when
 * complete, status chip on the right — because it is the same list of the same
 * tasks, written to the same storage. A task created here shows up in Business
 * and vice versa.
 *
 * Still without per-row edit and delete: a task can be destroyed from Business,
 * and two places that can do it is one more than the number of places anyone
 * looks when a task goes missing.
 */
function TaskList({
  tasks,
  selectedId,
  onSelect,
  onCreate,
}: {
  tasks: ProjectTask[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const shown = statusFilter ? tasks.filter((task) => task.status === statusFilter) : tasks;

  return (
    <section className="bg-background flex min-h-0 shrink-0 flex-col border-r xl:w-[22rem]">
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
          onClick={() => setShowFilter((open) => !open)}
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
        <span className="text-muted-foreground font-mono text-xs">{shown.length}</span>

        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onCreate}>
          <Plus className="size-3" />
          New task
        </Button>
      </div>

      {showFilter && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-4 py-2">
          {ALL_STATUSES.map((status) => {
            const active = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(active ? null : status)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  // Only the active pill draws a border; the rest are plain text
                  // that grows one on hover. Bordering all four turns a filter row
                  // into four things competing to be pressed.
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent',
                )}
              >
                {taskStatusChip(status).label}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 divide-y overflow-y-auto max-xl:max-h-96">
        {shown.map((task) => {
          const isSelected = task.id === selectedId;
          const isComplete = task.status === 'Complete';
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelect(task.id)}
              aria-pressed={isSelected}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                isSelected ? 'bg-primary/5' : 'hover:bg-muted/40',
              )}
            >
              <Pin className="size-4 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-sm',
                    isComplete ? 'text-muted-foreground line-through' : 'text-foreground',
                  )}
                >
                  [{task.code}] {task.title}
                  {task.count != null && (
                    <span className="text-muted-foreground ml-1 font-normal">({task.count})</span>
                  )}
                </span>
              </span>
              <StatusChip {...taskStatusChip(task.status)} className="ml-auto shrink-0" />
            </button>
          );
        })}

        {shown.length === 0 && (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            {statusFilter ? `No ${statusFilter.toLowerCase()} tasks.` : 'No tasks yet.'}
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pane 2 — the task                                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* What Claude can see                                                 */
/* ------------------------------------------------------------------ */

/**
 * The task and the design system, in one context.
 *
 * The DESIGN.md is passed whole rather than summarised — it is already the
 * canonical description, and paraphrasing it into a prompt is how the answer ends
 * up describing a system that does not exist.
 */
function taskChatContext(
  task: ProjectTask,
  designMarkdown: string,
  link: DesignLink | null,
): string {
  return [
    'You are helping a developer implement one task in this project.',
    '',
    '## Task',
    '',
    `${task.code} — ${task.title}`,
    task.description ? `\n${task.description}` : '',
    '',
    `Status: ${task.status}. Assignee: ${task.assignee}. Priority ${task.priority} of 3.`,
    task.tags && task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
    '',
    link && link.version !== null
      ? [
          '## Design system — binding',
          '',
          `Round ${link.version}. Build the UI to this specification; do not introduce raw colour or radius values that it does not define. Where it is silent, ask rather than invent.`,
          '',
          designMarkdown,
        ].join('\n')
      : '## Design system\n\nNo design round is open, so no design system governs this work yet. Say so rather than inventing tokens.',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DeveloperPage() {
  const params = useParams<{ projectId: string }>();
  const project = findProject(params.projectId);
  const { t } = useLocale();

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  /**
   * Which half of the job is on screen.
   *
   * Task is for reading and moving one; Development is for building it. They are
   * tabs rather than one crowded pane because they want opposite proportions —
   * the detail wants width for prose, the conversation wants width for code.
   */
  const [view, setView] = useState<'task' | 'development'>('task');
  const [formOpen, setFormOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [link, setLink] = useState<DesignLink | null>(null);

  /**
   * Tasks come from three places and have to be merged before filtering: the
   * seeded set, the ones a user added, and the status moves stored separately.
   * Reading only the seeded set is how a task someone just moved snaps back.
   */
  const reloadTasks = useMemo(
    () => () => {
      const merged = [...projectTasks(params.projectId), ...loadUserTasks(params.projectId)];
      const withStatus = applyTaskStatusOverrides(
        merged,
        loadTaskStatusOverrides(params.projectId),
      );
      // Not filtered to `category === 'Development'`: the field is optional and
      // no seeded task sets it, so filtering on it shows an empty tab. The whole
      // board is what a developer picks from until categories are actually
      // populated upstream.
      setTasks(withStatus);
    },
    [params.projectId],
  );

  // User tasks, status moves and the design round all live in localStorage, so
  // none of them can be read until the client is up.
  useEffect(() => {
    reloadTasks();
    setLink(loadDesignLink(params.projectId));
  }, [params.projectId, reloadTasks]);

  const task = tasks.find((entry) => entry.id === taskId) ?? tasks[0] ?? null;

  // Chat history is per task: a conversation about one task is misleading context
  // for another.
  useEffect(() => {
    if (!task) return;
    setTurns(loadBoardChat(params.projectId, `developer:${task.id}`));
  }, [params.projectId, task?.id, task]);

  const designMarkdown = useMemo(() => (link ? designSystemToMarkdown(link.system) : ''), [link]);

  /**
   * A task created here lands in the same store Business reads, so it appears on
   * both boards. Defaults to Development so the category the Business board
   * filters on is set from the start — a task raised while building is a
   * development task, and asking the person to pick that every time is friction
   * with one sensible answer.
   */
  const handleCreate = (fields: Parameters<typeof createTask>[1]) => {
    const created = createTask(params.projectId, { category: 'Development', ...fields });
    setFormOpen(false);
    reloadTasks();
    setTaskId(created.id);
  };

  const moveStatus = (status: TaskStatus) => {
    if (!task) return;
    setTaskStatusOverride(params.projectId, task.id, status);
    reloadTasks();
  };

  return (
    // The same frame the Business tab uses: cancel the layout's side and bottom
    // padding but keep its `pt-12`, which is the clearance for the fixed project
    // bar, then take the rest of the viewport. Re-applying the padding — which is
    // what this did before — inset the tab bar and left a band of dead space
    // above the content that Business does not have.
    <div className="bg-background -mx-6 -mb-6 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden">
      {/* Same figure as the Business sub-tabs: icon, label, and a 2px underline
            on the active one. Borrowed rather than restyled — two tab bars in one
            app that look different for no reason is worse than either. */}
      <nav
        aria-label="Developer sections"
        className="bg-background flex shrink-0 items-center gap-1 border-b px-3"
      >
        {SUB_TABS.map((tab) => {
          const active = view === tab.id;
          const blocked = tab.id === 'development' && task === null;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              disabled={blocked}
              aria-current={active ? 'page' : undefined}
              title={blocked ? 'Pick a task first' : undefined}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
                blocked && 'opacity-40',
              )}
            >
              <tab.icon className="size-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        {view === 'task' && (
          <TaskList
            tasks={tasks}
            selectedId={task?.id ?? null}
            onSelect={setTaskId}
            onCreate={() => setFormOpen(true)}
          />
        )}

        {view === 'task' ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {task === null || !project ? (
              <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-12 text-center text-xs">
                Nothing to build yet. Tasks created on the Business tab land here.
              </p>
            ) : (
              // The same detail the Business tab shows — reference files,
              // whiteboards, comments and its own Claude Code pane. Developer
              // reads and moves a task here; it does not create or delete one,
              // so those callbacks are no-ops rather than duplicated controls.
              <TaskDetail
                project={project}
                task={task}
                onClose={() => setTaskId(null)}
                onEdit={() => setView('development')}
                onDelete={() => undefined}
                onStatusChange={moveStatus}
              />
            )}
          </section>
        ) : (
          project &&
          task && (
            // The workspace takes the whole row here — the task list belongs to
            // the Task view only. Each file runs as the real screen, not as
            // exported HTML in a mock editor.
            <LiveWorkspace
              files={link?.files ?? []}
              projectId={params.projectId}
              emptyHint={
                link && link.version === null
                  ? 'No round open in Design — there are no design files to run.'
                  : 'Pick a file from the list to run it.'
              }
            >
              <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
                <SquareTerminal className="text-primary size-4 shrink-0" />
                <span className="text-sm font-semibold">{t('chat.claudeCode')}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {task.code}
                </span>
                <div className="flex-1" />
                {link && link.version !== null && (
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {link.system.name}
                  </span>
                )}
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {t('badge.localCli')}
                </Badge>
              </header>

              {/* `flex flex-col` is load-bearing: ChatPane sizes itself with
                  `flex-1`, which only resolves inside a flex parent. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ChatPane
                  // Remounting per task drops the previous task's draft and
                  // streaming state, which belong to that task, not this one.
                  key={task.id}
                  project={project}
                  contextText={taskChatContext(task, designMarkdown, link)}
                  folderLabel={task.code}
                  greeting={`Build ${task.code}`}
                  greetingHint="The task, the round's DESIGN.md and the design files on the left are in context."
                  initialTurns={turns}
                  onPersist={(next) => {
                    setTurns(next);
                    saveBoardChat(params.projectId, next, `developer:${task.id}`);
                  }}
                />
              </div>
            </LiveWorkspace>
          )
        )}
      </div>

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSave={handleCreate} />
    </div>
  );
}
