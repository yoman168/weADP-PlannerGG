'use client';

import { ArrowUp, Paperclip, Pin, Smile, X } from 'lucide-react';
import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/components/ui';
import { formatFileSize } from '@/lib/we-adk-mock/meeting-files';
import { type DesignProject } from '@/lib/we-adk-mock/projects';
import {
  CURRENT_PERSON,
  addTaskComment,
  commentCount,
  formatEntryTime,
  logTaskEvent,
  removeTaskComment,
  toggleTaskCommentLike,
  toggleTaskCommentPin,
  type TaskComment,
} from '@/lib/we-adk-mock/task-comments';
import { useLocale } from '@/lib/locale';
import { type ProjectTask } from '@/lib/we-adk-mock/tasks';

/** Up to four files per comment, the same ceiling the chat composer sets. */
const MAX_ATTACHMENTS = 4;

type Tab = 'all' | 'comment';

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

/** The same name always gets the same circle, so a thread reads at a glance. */
const AVATAR_TONES = [
  'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400',
];

function toneFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]!;
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        toneFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* One entry                                                           */
/* ------------------------------------------------------------------ */

function Entry({
  entry,
  onLike,
  onPin,
  onDelete,
}: {
  entry: TaskComment;
  onLike: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const likes = entry.likes ?? [];
  const liked = likes.includes(CURRENT_PERSON);
  const mine = entry.author === CURRENT_PERSON;

  return (
    <div className="group/entry flex items-start gap-3 py-4">
      <Avatar name={entry.author} />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold">{entry.author}</span>
          <span className="text-muted-foreground text-xs">{formatEntryTime(entry.at)}</span>
          {entry.pinned && (
            <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <Pin className="size-2.5" />
              Pinned
            </span>
          )}
        </p>

        <p
          className={cn(
            'mt-1 text-sm leading-relaxed whitespace-pre-wrap',
            // An app-written line is a note about the task, not someone talking.
            entry.kind === 'system' && 'text-muted-foreground',
          )}
        >
          {entry.text}
        </p>

        {entry.attachments && entry.attachments.length > 0 && (
          <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {entry.attachments.map((file) => (
              <span key={file.name} className="flex items-center gap-1">
                <Paperclip className="size-3" />
                <span className="max-w-[16rem] truncate font-mono">{file.name}</span>
              </span>
            ))}
          </p>
        )}

        <button
          type="button"
          onClick={onLike}
          aria-pressed={liked}
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs',
            liked ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Smile className="size-4" />
          {t('comments.like')}
          {likes.length > 0 && <span className="tabular-nums">{likes.length}</span>}
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {mine && entry.kind === 'comment' && (
          <button
            type="button"
            onClick={onDelete}
            title={t('comments.deleteComment')}
            aria-label={`Delete the comment from ${entry.author}`}
            className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover/entry:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onPin}
          aria-pressed={entry.pinned === true}
          title={entry.pinned ? t('comments.unpin') : t('comments.pin')}
          aria-label={entry.pinned ? 'Unpin this entry' : 'Pin this entry'}
          className={cn(
            entry.pinned
              ? 'text-foreground'
              : 'text-muted-foreground/60 hover:text-foreground opacity-0 transition-opacity group-hover/entry:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Pin className={cn('size-4', entry.pinned && 'fill-current')} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                              */
/* ------------------------------------------------------------------ */

/**
 * The conversation under a task — comments people write, and the lines the app
 * writes when something happens to the task. The parent owns the list so a
 * status change or a generation elsewhere in the pane can append to it.
 */
export function TaskCommentThread({
  project,
  task,
  entries,
  onChange,
}: {
  project: DesignProject;
  task: ProjectTask;
  entries: TaskComment[];
  onChange: (entries: TaskComment[]) => void;
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('all');
  const [draft, setDraft] = useState('');
  const [staged, setStaged] = useState<{ name: string; sizeKb: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const comments = commentCount(entries);
  const shown = tab === 'comment' ? entries.filter((entry) => entry.kind === 'comment') : entries;
  // Pinned entries stay on top; everything else keeps thread order.
  const ordered = [...shown].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true));

  const post = () => {
    const text = draft.trim();
    if (!text && staged.length === 0) return;
    onChange(
      addTaskComment(project.id, task, {
        author: CURRENT_PERSON,
        text: text || '(see attachments)',
        attachments: staged.map((file) => ({ name: file.name })),
      }),
    );
    setDraft('');
    setStaged([]);
  };

  const attach = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    setStaged((current) =>
      [
        ...current,
        ...picked.map((file) => ({ name: file.name, sizeKb: Math.round(file.size / 1024) })),
      ].slice(0, MAX_ATTACHMENTS),
    );
  };

  const pin = useCallback(
    (entry: TaskComment) => {
      const { entries: next, pinned } = toggleTaskCommentPin(project.id, task, entry.id);
      if (pinned) {
        onChange(logTaskEvent(project.id, task, `${CURRENT_PERSON} pinned`));
      } else {
        onChange(next);
      }
    },
    [project.id, task, onChange],
  );

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: t('comments.all'), count: entries.length },
    { id: 'comment', label: t('comments.comment'), count: comments },
  ];

  return (
    <div className="flex flex-col">
      {/* Tabs are a filter over one list — every entry, or only what people wrote. */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-pressed={tab === entry.id}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              tab === entry.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground border',
            )}
          >
            {entry.label} {entry.count}
          </button>
        ))}
      </div>

      <div className="mt-2 divide-y border-t">
        {ordered.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {tab === 'comment'
              ? t('comments.noComments')
              : t('comments.noActivity')}
          </p>
        ) : (
          ordered.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              onLike={() => onChange(toggleTaskCommentLike(project.id, task, entry.id))}
              onPin={() => pin(entry)}
              onDelete={() => onChange(removeTaskComment(project.id, task, entry.id))}
            />
          ))
        )}
      </div>

      {/* Composer — the same card the chat pins under its messages. */}
      <div className="flex items-start gap-3 border-t pt-4">
        <Avatar name={CURRENT_PERSON} />
        <div className="bg-background min-w-0 flex-1 rounded-2xl border p-3 shadow-sm">
          {staged.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {staged.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="bg-muted/60 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                >
                  <Paperclip className="size-3 shrink-0" />
                  <span className="max-w-[12rem] truncate font-mono">{file.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(file.sizeKb)}</span>
                  <button
                    type="button"
                    onClick={() => setStaged((current) => current.filter((_, at) => at !== index))}
                    aria-label={`Remove ${file.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <label className="sr-only" htmlFor="task-comment">
            Write a comment on this task
          </label>
          <textarea
            id="task-comment"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                post();
              }
            }}
            rows={Math.min(6, Math.max(1, draft.split('\n').length))}
            placeholder={t('comments.placeholder')}
            className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-1 pt-0.5 text-sm outline-none"
          />

          <div className="mt-1.5 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={attach}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={staged.length >= MAX_ATTACHMENTS}
              title={
                staged.length >= MAX_ATTACHMENTS
                  ? `Up to ${MAX_ATTACHMENTS} files per comment`
                  : t('comments.attachHint')
              }
              aria-label={t('chat.attachFiles')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 disabled:opacity-40"
            >
              <Paperclip className="size-4" />
            </button>

            <button
              type="button"
              onClick={post}
              disabled={!draft.trim() && staged.length === 0}
              aria-label={t('comments.post')}
              className="bg-foreground text-background ml-auto rounded-md p-1 disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
