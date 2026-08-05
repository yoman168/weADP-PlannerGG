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
import {
  TASK_CATEGORIES,
  type ProjectTask,
  type TaskCategory,
  type TaskStatus,
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
}

export function TaskFormDialog({
  open,
  initial,
  defaults,
  onClose,
  onSave,
}: {
  open: boolean;
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
    setDescription(source?.description ?? '');
    setTagsText(source?.tags?.join(', ') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

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
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t('task.editTask') : t('task.newTask')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">{t('task.title')}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('task.titlePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-status">{t('task.status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="task-status">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-priority">{t('task.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as '1' | '2' | '3')}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-category">{t('task.category')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
              <SelectTrigger id="task-category">
                <SelectValue placeholder={t('task.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {TASK_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-assignee">{t('task.assignee')}</Label>
            <Input
              id="task-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder={t('task.assigneePlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">{t('task.description')}</Label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('task.descriptionPlaceholder')}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-tags">{t('task.tags')}</Label>
            <Input
              id="task-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder={t('task.tagsPlaceholder')}
            />
          </div>

          <Button onClick={submit} disabled={!title.trim()}>
            {initial ? (
              <>
                <Check /> {t('task.saveChanges')}
              </>
            ) : (
              <>
                <Plus /> {t('task.create')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
