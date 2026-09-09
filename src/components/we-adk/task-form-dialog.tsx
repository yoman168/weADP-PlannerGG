'use client';

/**
 * The create/edit form for a task.
 *
 * It lives here rather than in the Task tab because a task does not only start
 * there: a screen in the preview can raise one about itself, and both doors
 * should open the same form and write the same fields.
 */
import { Check, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { MemberPicker } from '@/components/we-adk/member-picker';
import {
  isVersionLocked,
  loadVersionStatuses,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';
import {
  needsHumanTester,
  projectRounds,
  TASK_CATEGORIES,
  TESTED_BY_OPTIONS,
  type ProjectTask,
  type TaskCategory,
  type TaskStatus,
  type TestedBy,
} from '@/lib/we-adk-mock/tasks';

export const ALL_STATUSES: TaskStatus[] = ['Request', 'Progress', 'Feedback', 'Complete'];

const PRIORITIES: Array<{ value: '1' | '2' | '3'; label: string }> = [
  { value: '1', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Low' },
];

/** What the form hands back — the shape `createTask` takes. */
export interface TaskFormFields {
  title: string;
  status: TaskStatus;
  assignee: string;
  priority: 1 | 2 | 3;
  description?: string;
  tags?: string[];
  category?: TaskCategory;
  testedBy?: TestedBy;
  /** Who does the human testing, when a human is involved. */
  tester?: string;
  /** Which round it lands in. Absent means "use the one that is open". */
  version?: number;
}

export function TaskFormDialog({
  open,
  projectId,
  initial,
  defaults,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Which project's rounds the version list offers. */
  projectId?: string;
  /** When set, we're editing an existing task. */
  initial?: ProjectTask;
  /**
   * What a new task starts filled in with — how a screen raises a task about
   * itself without the person retyping where it came from. Ignored when
   * editing, which starts from the task itself.
   */
  defaults?: Partial<TaskFormFields>;
  onClose: () => void;
  onSave: (fields: TaskFormFields) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Request');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<'1' | '2' | '3'>('2');
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [testedBy, setTestedBy] = useState<TestedBy>('Not tested');
  const [tester, setTester] = useState<string | undefined>(undefined);
  /** Always a round — a task out of the rounds is not something this offers. */
  const [version, setVersion] = useState<string>('');
  const [rounds, setRounds] = useState<{ list: number[]; statuses: VersionStatuses }>({
    list: [],
    statuses: {},
  });
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');

  // Filled in as the dialog opens: the task being edited, or what the caller
  // wants a new one to start from. `defaults` is deliberately not a dependency
  // — it only matters at the moment of opening, and a caller that rebuilds the
  // object each render would otherwise wipe what is being typed.
  useEffect(() => {
    if (!open) return;
    const source = initial ?? defaults;
    setTitle(source?.title ?? '');
    setStatus(source?.status ?? 'Request');
    setAssignee(source?.assignee ?? '');
    setPriority(String(source?.priority ?? 2) as '1' | '2' | '3');
    setCategory(source?.category ?? '');
    setTestedBy(source?.testedBy ?? 'Not tested');
    setTester(source?.tester);
    if (projectId) {
      const list = projectRounds(projectId);
      const statuses = loadVersionStatuses(projectId);
      setRounds({ list, statuses });
      // A new task defaults to the round being worked on; an edited one keeps
      // whichever round it is already in. A task naming no round, or one this
      // project does not have, falls to the open round the same way the board
      // shows it — there is nowhere else for it to be.
      const existing = source && 'version' in source ? (source.version ?? null) : null;
      const openRound = list.find((entry) => !isVersionLocked(entry, statuses)) ?? list[0];
      setVersion(
        existing !== null && list.includes(existing)
          ? String(existing)
          : openRound === undefined
            ? ''
            : String(openRound),
      );
    }
    setDescription(source?.description ?? '');
    setTagsText(source?.tags?.join(', ') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, projectId]);

  const submit = () => {
    if (!title.trim()) return;
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      title: title.trim(),
      status,
      assignee: assignee.trim() || 'Unassigned',
      priority: Number(priority) as 1 | 2 | 3,
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      category: category || undefined,
      testedBy,
      // A tester picked and then switched to AI-only would otherwise be saved
      // against a task nobody is testing by hand.
      tester: needsHumanTester(testedBy) ? tester : undefined,
      version: version === '' ? undefined : Number(version),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">{initial ? t('task.editTask') : t('task.newTask')}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title" className="text-[13px] font-medium">{t('task.title')}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('task.titlePlaceholder')}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Divider */}
          <div className="bg-border -mx-5 h-px" />

          {/* Priority / Category (+ Status when editing) */}
          <div className={initial ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
            {initial && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-status" className="text-[11px] font-medium text-muted-foreground">{t('task.status')}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger id="task-status" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority" className="text-[11px] font-medium text-muted-foreground">{t('task.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as '1' | '2' | '3')}>
                <SelectTrigger id="task-priority" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-category" className="text-[11px] font-medium text-muted-foreground">{t('task.category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                <SelectTrigger id="task-category" className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Version / Tested by / Assignee */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-version" className="text-[11px] font-medium text-muted-foreground">Version</Label>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger id="task-version" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rounds.list.map((entry) => {
                    const locked = isVersionLocked(entry, rounds.statuses);
                    return (
                      <SelectItem
                        key={entry}
                        value={String(entry)}
                        disabled={locked && String(entry) !== version}
                      >
                        V{entry}{locked ? ' · Released' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-tested-by" className="text-[11px] font-medium text-muted-foreground">Tested by</Label>
              <Select value={testedBy} onValueChange={(v) => setTestedBy(v as TestedBy)}>
                <SelectTrigger id="task-tested-by" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TESTED_BY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee" className="text-[11px] font-medium text-muted-foreground">{t('task.assignee')}</Label>
              {projectId ? (
                <MemberPicker
                  id="task-assignee"
                  projectId={projectId}
                  value={assignee}
                  onChange={(next) => setAssignee(next ?? '')}
                  className="h-8 w-full text-xs"
                />
              ) : (
                <Input
                  id="task-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder={t('task.assigneePlaceholder')}
                  className="h-8 text-xs"
                />
              )}
            </div>
          </div>

          {needsHumanTester(testedBy) && projectId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-tester" className="text-[11px] font-medium text-muted-foreground">Human tester</Label>
              <MemberPicker
                id="task-tester"
                projectId={projectId}
                value={tester}
                showRoles
                placeholder="Nobody yet"
                onChange={setTester}
                className="h-8 w-full text-xs"
              />
            </div>
          )}

          {/* Divider */}
          <div className="bg-border -mx-5 h-px" />

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description" className="text-[13px] font-medium">{t('task.description')}</Label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('task.descriptionPlaceholder')}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-tags" className="text-[13px] font-medium">{t('task.tags')}</Label>
            <Input
              id="task-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder={t('task.tagsPlaceholder')}
              className="h-9"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!title.trim()}>
            {initial ? (
              <><Check className="size-3.5" /> {t('task.saveChanges')}</>
            ) : (
              <><Plus className="size-3.5" /> {t('task.create')}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
