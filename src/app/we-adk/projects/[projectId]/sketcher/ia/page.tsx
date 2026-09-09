'use client';

/**
 * The IA tab — the round's screens as one sitemap sheet.
 *
 * Main already holds the tree; this reads it flat, one row per screen with
 * its folder spread into depth columns, the shape a real IA document uses.
 * It seeds itself from the round's files so it never opens empty, and any
 * edit here freezes to its own overlay — the same seed + overlay split every
 * sheet in this app uses — so a rename in this sheet cannot fight the file it
 * was drawn from. Released rounds are read-only, same as everywhere else.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  ExternalLink,
  ListTree,
  X,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Plus,
} from 'lucide-react';
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
  cn,
} from '@/components/ui';
import { PROTOTYPE_FILES, findPrototypeByRoute } from '@/lib/we-adk/prototype';
import { useLocale } from '@/lib/locale';
import { LiveScreenPreview, canPreviewLive } from '@/components/we-adk/live-screen-preview';
import { loadRoundFolders } from '@/lib/we-adk/round-screens';
import { findProject, type DesignFile, type DesignFolder } from '@/lib/we-adk-mock/projects';
import { type SketchScreen } from '@/lib/we-adk-mock/sketches';
import { BASELINE_VERSION, loadSubfolders, loadVersionCount } from '@/lib/we-adk-mock/versions';
import {
  IA_DEPTH_FIELDS,
  IA_PLATFORMS,
  IA_SCREEN_TYPES,
  IA_STATUSES,
  loadIdSuffixFormat,
  loadDepthConfigs,
  loadRandomDigits,
  validateScreenId,
  addIARow,
  deleteIARow,
  duplicateIARow,
  loadIARows,
  resetIARows,
  restoreIARows,
  updateIARow,
  type IARow,
  type IAPlatform,
  type IAScreenType,
  type IAStatus,
} from '@/lib/we-adk-mock/ia';
import {
  loadPrd,
  addPrdItem,
  updatePrdItem,
  deletePrdItem,
  updatePrdDoc,
  loadFrd,
  addFrdItem,
  updateFrdItem,
  deleteFrdItem,
  PRD_DOCUMENTS,
  PRD_TASK_TAGS,
  resolvePrdSeed,
  screensForPrd,
  type PrdDoc,
  type PrdItem,
  type FrdDoc,
} from '@/lib/we-adk-mock/ia';
import {
  projectTasks,
  loadUserTasks,
  saveUserTasks,
  updateTask,
  type ProjectTask,
  type TaskStatus,
} from '@/lib/we-adk-mock/tasks';
import { TaskDetail } from '@/components/we-adk/task-detail';
import { loadUploadedFiles, sessionFiles, type MeetingFile } from '@/lib/we-adk-mock/meeting-files';
import { taskFilesKey } from '@/lib/we-adk/task-design';
import { claudeHeaders } from '@/lib/we-adk/claude-account';

/** Every round in the project, exactly as Main and Design build it. */

/** The newest round still open, or the newest round outright once all shipped. */
function pickDefaultVersion(folders: DesignFolder[]): number | null {
  const numbers = folders
    .map((folder) => folder.versionNumber)
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => b - a);
  return (
    numbers.find(
      (version) =>
        folders.find((folder) => folder.versionNumber === version)?.versionStatus !== 'Released',
    ) ??
    numbers[0] ??
    null
  );
}

const GHOST_TRIGGER =
  'h-6 w-fit max-w-full gap-1 border-none bg-transparent px-1 text-xs shadow-none ' +
  'hover:bg-muted/60 data-[state=open]:bg-muted/60 dark:hover:bg-muted/60';

/** The separator between depth levels, in the sheet and in the CSV alike. */
const PATH_SEPARATOR = ' > ';

/** The filled depth levels of a row, in order. */
function pathOf(row: IARow): string[] {
  return depthsOf(row).filter(Boolean);
}

/**
 * The depth columns read back as one path — `Finance > Expense Management >
 * Corporate Card > Card Registration > Card Detail`.
 *
 * A literal `>` rather than a chevron glyph, because this column is a written
 * path: it is the thing people copy out of the sheet and paste into a doc, and
 * an icon does not survive that. The levels a row does not use are dropped, so
 * a shallow screen reads as its own name rather than trailing separators.
 */
function PathText({ segments }: { segments: string[] }) {
  if (segments.length === 0) return <span className="text-muted-foreground/60">—</span>;
  return (
    // `block` + `truncate` rather than `inline-flex`: an inline-flex box
    // shrinks to fit its content instead of the cell, so a long path spilled
    // past the column edge and over the next one instead of eliding.
    <span className="block truncate" title={segments.join(PATH_SEPARATOR)}>
      {segments.map((segment, index) => (
        <span key={index}>
          {index > 0 && (
            <span aria-hidden className="text-muted-foreground/40 mx-1">
              {'>'}
            </span>
          )}
          {segment}
        </span>
      ))}
    </span>
  );
}

const PRD_STATUS_STYLE: Record<string, string> = {
  Done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'In progress': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'To do': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const PRD_STATUSES: PrdItem['status'][] = ['To do', 'In progress', 'Done'];

const TASK_STATUS_STYLE: Record<string, string> = {
  Request: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  Progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Feedback: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};

/** Get tasks from the Task tab that match a PRD by tags, scoped to a version. */
function tasksForPrd(projectId: string, prdId: string, version: number | null): ProjectTask[] {
  const tags = PRD_TASK_TAGS[prdId];
  if (!tags) return [];
  const all = [...projectTasks(projectId), ...loadUserTasks(projectId)];
  const seen = new Set<string>();
  return all.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    if (version !== null && t.version !== version) return false;
    return t.tags?.some((tag) => tags.includes(tag));
  });
}

/** PRD cell — click to show requirements list popup with CRUD. */
function PrdCell({
  value,
  route,
  onSave,
  locked,
  projectId,
  version,
}: {
  value: string;
  route?: string;
  onSave: (next: string) => void;
  locked: boolean;
  projectId: string;
  version: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [doc, setDoc] = useState<PrdDoc | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskRevision, setTaskRevision] = useState(0);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [frd, setFrd] = useState<FrdDoc>({ items: [] });
  const [frdAddOpen, setFrdAddOpen] = useState(false);
  const [frdTitle, setFrdTitle] = useState('');
  const [editingFrdId, setEditingFrdId] = useState<string | null>(null);
  const [frdEditDraft, setFrdEditDraft] = useState('');
  const [generating, setGenerating] = useState(false);

  const openPopup = () => {
    setDoc(value ? loadPrd(value, route) : null);
    if (value) setFrd(loadFrd(value));
    setOpen(true);
  };

  /** Try AI first, fall back to local derivation. */
  const generateFrd = async () => {
    if (!value) return;
    const prdDoc = resolvePrdSeed(value, route);
    if (!prdDoc) return;
    const screens = screensForPrd(value);

    setGenerating(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/sketcher/frd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        body: JSON.stringify({
          prdId: value,
          prdTitle: prdDoc.title,
          prdDescription: prdDoc.description,
          requirements: prdDoc.items.map((item) => item.title),
          screens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          const existing = new Set(loadFrd(value).items.map((i) => i.title));
          let current = loadFrd(value);
          for (const item of data.items) {
            const title = typeof item === 'string' ? item : item?.title;
            if (title && !existing.has(title)) {
              current = addFrdItem(value, title);
              existing.add(title);
            }
          }
          setFrd(current);
          setGenerating(false);
          return;
        }
      }
    } catch {
      /* fall through to local */
    }

    // Fallback: derive locally from PRD items
    const existing = new Set(loadFrd(value).items.map((i) => i.title));
    let current = loadFrd(value);
    for (const item of prdDoc.items) {
      if (!existing.has(item.title)) {
        current = addFrdItem(value, item.title);
        existing.add(item.title);
      }
    }
    if (screens.length > 0) {
      const errTitle = `Error handling when API request fails on ${screens[0]}`;
      if (!existing.has(errTitle)) current = addFrdItem(value, errTitle);
    }
    const confirmTitle = 'Confirm dialog before destructive actions';
    if (!existing.has(confirmTitle)) current = addFrdItem(value, confirmTitle);
    setFrd(current);
    setGenerating(false);
  };

  const refresh = (next: PrdDoc | null) => {
    if (next) setDoc(next);
  };

  if (editing && !locked) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() !== value) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="-mx-1 h-6 w-full rounded-sm px-1 py-0.5 text-xs shadow-none"
      />
    );
  }

  return (
    <>
      <div className="group/prd flex items-center">
        {value ? (
          <button
            type="button"
            onClick={openPopup}
            title={value}
            className="min-w-0 flex-1 truncate text-left text-xs font-medium text-blue-700 underline underline-offset-2 hover:opacity-80 dark:text-blue-300"
          >
            {value}
          </button>
        ) : (
          <span className="text-muted-foreground/50 text-xs italic">—</span>
        )}
        {!locked && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="text-muted-foreground/60 hover:text-foreground shrink-0 rounded p-0.5 opacity-0 group-hover/prd:opacity-100"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!max-w-2xl p-0 gap-0 [&>button:last-child]:hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <DialogHeader className="!flex-row items-center gap-2 !space-y-0">
              <span className="text-muted-foreground text-sm">●</span>
              <DialogTitle className="text-sm font-medium">
                [{value}] {doc?.title ?? value}
              </DialogTitle>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded p-1"
            >
              <X className="size-4" />
            </button>
          </div>

          {doc ? (
            <div className="max-h-[70vh] overflow-y-auto">
              {/* Badges + title */}
              <div className="flex flex-col gap-4 px-6 py-5">
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      if (titleDraft.trim() && titleDraft !== doc.title)
                        refresh(updatePrdDoc(value, { title: titleDraft.trim() }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    className="text-xl font-bold"
                  />
                ) : (
                  <h2 className="group/title flex items-center gap-2 text-xl font-bold">
                    {doc.title}
                    <button
                      type="button"
                      onClick={() => {
                        setTitleDraft(doc.title);
                        setEditingTitle(true);
                      }}
                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover/title:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </h2>
                )}
              </div>

              {/* Description */}
              <div className="border-t px-6 py-5">
                <div className="flex items-center gap-2">
                  <Copy className="text-muted-foreground size-4" />
                  <h3 className="text-sm font-semibold">Description</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setDescDraft(doc.description);
                      setEditingDesc(true);
                    }}
                    className="text-muted-foreground hover:text-foreground ml-auto rounded p-0.5"
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
                {editingDesc ? (
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={() => {
                      setEditingDesc(false);
                      if (descDraft.trim() !== doc.description)
                        refresh(updatePrdDoc(value, { description: descDraft.trim() }));
                    }}
                    rows={3}
                    className="border-input mt-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {doc.description}
                  </p>
                )}
              </div>

              {/* Reference files — collected from all linked tasks */}
              {(() => {
                const tasks = tasksForPrd(projectId, value, version);
                const allFiles: { file: MeetingFile; taskCode: string }[] = [];
                for (const task of tasks) {
                  const key = taskFilesKey(projectId, task.id);
                  const uploaded = loadUploadedFiles(key);
                  const files = sessionFiles(key, uploaded);
                  for (const f of files) allFiles.push({ file: f, taskCode: task.code });
                }
                // Also include static PRD files
                for (const f of doc.files) {
                  allFiles.push({
                    file: { id: f.name, name: f.name, kind: 'doc', uploadedBy: '', uploadedAt: '' },
                    taskCode: '',
                  });
                }
                return (
                  <div className="border-t px-6 py-5">
                    <div className="flex items-center gap-2">
                      <Download className="text-muted-foreground size-4" />
                      <h3 className="text-sm font-semibold">Reference files</h3>
                      <span className="text-muted-foreground text-xs">{allFiles.length}</span>
                    </div>
                    {allFiles.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-1">
                        {allFiles.map((entry) => (
                          <div
                            key={entry.file.id}
                            className="hover:bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2"
                          >
                            <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {entry.file.name}
                            </span>
                            {entry.taskCode && (
                              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                                {entry.taskCode}
                              </span>
                            )}
                            {entry.file.sizeKb ? (
                              <span className="text-muted-foreground shrink-0 text-xs">
                                {entry.file.sizeKb >= 1024
                                  ? `${(entry.file.sizeKb / 1024).toFixed(1)} MB`
                                  : `${entry.file.sizeKb} KB`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground shrink-0 text-xs">
                                {doc.files.find((f) => f.name === entry.file.name)?.size ?? ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-xs">Nothing attached yet.</p>
                    )}
                  </div>
                );
              })()}

              {/* Requirements — real tasks from the Task tab */}
              {(() => {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                void taskRevision; // re-read tasks when a new one is added
                const tasks = tasksForPrd(projectId, value, version);
                const prdTags = PRD_TASK_TAGS[value] ?? [];
                return (
                  <div className="border-t px-6 py-5">
                    <div className="flex items-center gap-2">
                      <ListTree className="text-muted-foreground size-4" />
                      <h3 className="text-sm font-semibold">Requirements</h3>
                      <span className="text-muted-foreground text-xs">{tasks.length}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7 gap-1 text-xs"
                        onClick={() => setShowAddTask(true)}
                      >
                        <Plus className="size-3" />
                        Add task
                      </Button>
                    </div>
                    {tasks.length > 0 && (
                      <div className="mt-3 flex flex-col rounded-lg border">
                        {tasks.map((task, i) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => setSelectedTask(task)}
                            className={cn(
                              'hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                              i > 0 && 'border-t',
                            )}
                          >
                            <span className="w-14 shrink-0 text-muted-foreground font-mono text-[10px]">
                              {task.code}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{task.title}</p>
                            </div>
                            <span
                              className={cn(
                                'w-16 shrink-0 text-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                TASK_STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600',
                              )}
                            >
                              {task.status}
                            </span>
                            <span className="w-24 shrink-0 truncate text-right text-muted-foreground text-xs">
                              {task.assignee}
                            </span>
                            <span
                              className={cn(
                                'w-10 shrink-0 text-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                                task.priority === 1
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                  : 'text-transparent',
                              )}
                            >
                              {task.priority === 1 ? 'High' : '—'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {tasks.length === 0 && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        No tasks linked to this PRD yet.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* FRD — Functional Requirements */}
              <div className="border-t px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <ListTree className="text-muted-foreground size-4" />
                  <h3 className="text-sm font-semibold">FRD</h3>
                  <span className="text-muted-foreground text-xs">{frd.items.length}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 gap-1 text-xs"
                    disabled={generating}
                    onClick={generateFrd}
                  >
                    <Sparkles className={cn('size-3', generating && 'animate-spin')} />
                    {generating ? 'Generating…' : 'Generate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => {
                      setFrdTitle('');
                      setFrdAddOpen(true);
                    }}
                  >
                    <Plus className="size-3" />
                    Add
                  </Button>
                </div>
                {frd.items.length > 0 ? (
                  <div className="flex flex-col rounded-lg border">
                    {frd.items.map((item, i) => (
                      <div
                        key={item.id}
                        className={cn(
                          'group/frd flex items-start gap-2 px-4 py-3',
                          i > 0 && 'border-t',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          {editingFrdId === item.id ? (
                            <Input
                              autoFocus
                              value={frdEditDraft}
                              onChange={(e) => setFrdEditDraft(e.target.value)}
                              onBlur={() => {
                                setEditingFrdId(null);
                                if (frdEditDraft.trim() && frdEditDraft !== item.title)
                                  setFrd(updateFrdItem(value, item.id, frdEditDraft.trim()));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingFrdId(null);
                              }}
                              className="h-6 text-xs"
                            />
                          ) : (
                            <span
                              className="cursor-pointer text-sm"
                              onClick={() => {
                                setFrdEditDraft(item.title);
                                setEditingFrdId(item.id);
                              }}
                            >
                              {item.title}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setFrd(deleteFrdItem(value, item.id))}
                          className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 opacity-0 group-hover/frd:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">No functional requirements yet.</p>
                )}
                {frdAddOpen && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      autoFocus
                      value={frdTitle}
                      onChange={(e) => setFrdTitle(e.target.value)}
                      placeholder="Functional requirement..."
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && frdTitle.trim()) {
                          setFrd(addFrdItem(value, frdTitle.trim()));
                          setFrdTitle('');
                          setFrdAddOpen(false);
                        }
                        if (e.key === 'Escape') setFrdAddOpen(false);
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!frdTitle.trim()}
                      onClick={() => {
                        if (frdTitle.trim()) {
                          setFrd(addFrdItem(value, frdTitle.trim()));
                          setFrdTitle('');
                          setFrdAddOpen(false);
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setFrdAddOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              <p className="text-muted-foreground px-6 py-5 text-sm">
                No PRD document found for {value}.
              </p>

              {/* FRD — Functional Requirements (shown even without PRD doc) */}
              <div className="border-t px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <ListTree className="text-muted-foreground size-4" />
                  <h3 className="text-sm font-semibold">FRD</h3>
                  <span className="text-muted-foreground text-xs">{frd.items.length}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 gap-1 text-xs"
                    onClick={() => {
                      setFrdTitle('');
                      setFrdAddOpen(true);
                    }}
                  >
                    <Plus className="size-3" />
                    Add
                  </Button>
                </div>
                {frd.items.length > 0 ? (
                  <div className="flex flex-col rounded-lg border">
                    {frd.items.map((item, i) => (
                      <div
                        key={item.id}
                        className={cn(
                          'group/frd flex items-start gap-2 px-4 py-3',
                          i > 0 && 'border-t',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          {editingFrdId === item.id ? (
                            <Input
                              autoFocus
                              value={frdEditDraft}
                              onChange={(e) => setFrdEditDraft(e.target.value)}
                              onBlur={() => {
                                setEditingFrdId(null);
                                if (frdEditDraft.trim() && frdEditDraft !== item.title)
                                  setFrd(updateFrdItem(value, item.id, frdEditDraft.trim()));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingFrdId(null);
                              }}
                              className="h-6 text-xs"
                            />
                          ) : (
                            <span
                              className="cursor-pointer text-sm"
                              onClick={() => {
                                setFrdEditDraft(item.title);
                                setEditingFrdId(item.id);
                              }}
                            >
                              {item.title}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setFrd(deleteFrdItem(value, item.id))}
                          className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 opacity-0 group-hover/frd:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">No functional requirements yet.</p>
                )}
                {frdAddOpen && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      autoFocus
                      value={frdTitle}
                      onChange={(e) => setFrdTitle(e.target.value)}
                      placeholder="Functional requirement..."
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && frdTitle.trim()) {
                          setFrd(addFrdItem(value, frdTitle.trim()));
                          setFrdTitle('');
                          setFrdAddOpen(false);
                        }
                        if (e.key === 'Escape') setFrdAddOpen(false);
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!frdTitle.trim()}
                      onClick={() => {
                        if (frdTitle.trim()) {
                          setFrd(addFrdItem(value, frdTitle.trim()));
                          setFrdTitle('');
                          setFrdAddOpen(false);
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setFrdAddOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Task detail popup */}
      <Dialog open={selectedTask !== null} onOpenChange={(next) => !next && setSelectedTask(null)}>
        <DialogContent className="h-[85vh] !max-w-2xl overflow-auto p-0 gap-0 [&>button:last-child]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskDetail
              project={findProject(projectId)!}
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onEdit={() => {}}
              onDelete={() => setSelectedTask(null)}
              onStatusChange={(status: TaskStatus) => {
                const updated = { ...selectedTask, status };
                updateTask(projectId, updated);
                setSelectedTask(updated);
              }}
              canGenerate={false}
              showChat={false}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Select task popup */}
      <Dialog
        open={showAddTask}
        onOpenChange={(next) => {
          if (!next) {
            setShowAddTask(false);
            setTaskSearch('');
          }
        }}
      >
        <DialogContent className="!max-w-lg p-0 gap-0 [&>button:last-child]:hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <DialogHeader className="!flex-row flex-1 items-center gap-2 !space-y-0">
              <DialogTitle className="text-sm font-medium">Select task</DialogTitle>
            </DialogHeader>
            <button
              type="button"
              onClick={() => {
                setShowAddTask(false);
                setTaskSearch('');
              }}
              className="text-muted-foreground hover:text-foreground rounded p-1"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="border-b px-4 py-2">
            <div className="relative">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              />
              <Input
                autoFocus
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search by title or code..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-4 py-2">
            {(() => {
              const prdTags = PRD_TASK_TAGS[value] ?? [];
              const allTasks = [...projectTasks(projectId), ...loadUserTasks(projectId)];
              const seen = new Set<string>();
              const unique = allTasks.filter((t) => {
                if (seen.has(t.id)) return false;
                seen.add(t.id);
                return true;
              });
              const linkedTasks = tasksForPrd(projectId, value, version);
              const linkedIds = new Set(linkedTasks.map((t) => t.id));
              const needle = taskSearch.toLowerCase();
              const available = unique
                .filter((t) => !linkedIds.has(t.id))
                .filter(
                  (t) =>
                    !needle ||
                    t.title.toLowerCase().includes(needle) ||
                    t.code.toLowerCase().includes(needle),
                );
              return available.length > 0 ? (
                <div className="flex flex-col rounded-lg border">
                  {available.map((task, i) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        // Add PRD tags to the task so it appears in requirements
                        const newTags = [
                          ...(task.tags ?? []),
                          ...prdTags.filter((t) => !(task.tags ?? []).includes(t)),
                        ];
                        const updated = { ...task, tags: newTags };
                        // Save: seeded tasks need to be copied into user tasks
                        const userTasks = loadUserTasks(projectId);
                        const exists = userTasks.some((t) => t.id === task.id);
                        if (exists) {
                          updateTask(projectId, updated);
                        } else {
                          saveUserTasks(projectId, [updated, ...userTasks]);
                        }
                        setTaskRevision((r) => r + 1);
                        setShowAddTask(false);
                        setTaskSearch('');
                      }}
                      className={cn(
                        'hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                        i > 0 && 'border-t',
                      )}
                    >
                      <span className="w-14 shrink-0 text-muted-foreground font-mono text-[10px]">
                        {task.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{task.title}</p>
                      </div>
                      <span
                        className={cn(
                          'w-16 shrink-0 text-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                          TASK_STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {task.status}
                      </span>
                      <span className="w-24 shrink-0 truncate text-right text-muted-foreground text-xs">
                        {task.assignee}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-6 text-center text-xs">
                  No tasks available to add.
                </p>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A cell that edits where it sits — a button until clicked, then an input. */
/**
 * A text cell of the sheet: read, and expand when it is too long to read.
 *
 * These columns are not typed any more. Depth, screen id and screen key are
 * derived — from the design files in the round, and from the IA a request
 * arrived with — so a hand edit here was a second answer to a question that
 * already had one, and the two drifted apart the moment either side changed.
 * Everything the sheet still lets you set (type, status, platform, work item)
 * has no other source and stays editable.
 *
 * Expanding is kept: a truncated screen key is unreadable, and clicking to see
 * the whole of it changes nothing.
 */
function ValueCell({
  value,
  placeholder,
  mono,
  error,
}: {
  value: string;
  placeholder: string;
  mono?: boolean;
  error?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={!value}
        onClick={() => setExpanded((prev) => !prev)}
        title={value || undefined}
        className={cn(
          '-mx-1 block w-full rounded px-1 py-0.5 text-left',
          !expanded && 'truncate',
          expanded && 'break-words whitespace-pre-wrap',
          !value && 'text-muted-foreground/50 italic',
          mono && 'font-mono',
          error && 'text-red-600 dark:text-red-400',
        )}
      >
        {value || placeholder}
      </button>
      {error && <span className="mt-0.5 text-[9px] text-red-500">{error}</span>}
    </div>
  );
}

/**
 * What a row actually stands for: the design file behind it, if there is one.
 *
 * `bound` is the row claiming a file; `file` is that file if it is still in
 * the round. The two differ when a screen the sheet references has since been
 * deleted in Main, and that is worth saying out loud rather than papering over.
 */
interface WorkItemObject {
  bound: boolean;
  file: DesignFile | undefined;
}

/**
 * The Work item column — the design object itself, not a label for it.
 *
 * For a row drawn from the round, the name is read from the design file every
 * render rather than from the copy the sheet saved: a screen renamed in Main
 * is the same object under a new name, and a sheet that kept showing the old
 * one would be quietly wrong. That is also why there is no pencil on those
 * rows — the object's name belongs to the object, and Main is where it lives.
 *
 * Editing is left where there is no object to contradict: a row typed in by
 * hand stands for something that does not exist yet, and a row whose file has
 * been deleted has nothing left to follow.
 */
const NONE = '(none)';

function WorkItemCell({
  object,
  label,
  screenId,
  locked,
  onSave,
  openLabel,
  editLabel,
  missingLabel,
  placeholder,
  screenOptions,
}: {
  object: WorkItemObject;
  label: string;
  /** Canvas id for the screen preview popup. */
  screenId?: string;
  locked: boolean;
  onSave: (next: string) => void;
  openLabel: string;
  editLabel: string;
  missingLabel: string;
  placeholder: string;
  /** Screen names for the picker — scoped to the current project. */
  screenOptions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  /** The screen currently shown in the preview dialog — starts as the row's screen. */
  const [previewScreenId, setPreviewScreenId] = useState(screenId ?? '');
  const [fromScreen, setFromScreen] = useState('');
  const [toScreen, setToScreen] = useState('');
  const canPreview = screenId ? canPreviewLive(screenId) : false;

  const editable = !locked;
  const missing = object.bound && !object.file;

  const openPicker = () => {
    // Parse current label to pre-fill selects
    if (label.includes(' → ')) {
      const parts = label.split(' → ');
      setFromScreen((parts[0] ?? '').trim());
      setToScreen((parts[1] ?? '').trim());
    } else {
      setFromScreen(label);
      setToScreen('');
    }
    setOpen(true);
  };

  const save = () => {
    const value = toScreen && toScreen !== NONE ? `${fromScreen} → ${toScreen}` : fromScreen;
    if (value !== label) onSave(value);
    setOpen(false);
  };

  /** Renders the label with underlined screen names and unstyled arrow. */
  const renderLabel = (text: string) => {
    if (text.includes(' → ')) {
      return text.split(' → ').map((part, i, arr) => (
        <span key={i}>
          <span className="underline underline-offset-2">{part}</span>
          {i < arr.length - 1 && <span className="text-muted-foreground no-underline"> → </span>}
        </span>
      ));
    }
    return <span className="underline underline-offset-2">{text}</span>;
  };

  return (
    <>
      <div className="group/work flex min-w-0 items-center">
        {canPreview ? (
          <button
            type="button"
            onClick={() => {
              if (screenId) setPreviewScreenId(screenId);
              setPreviewing(true);
            }}
            title={`${label} — ${openLabel}`}
            className="min-w-0 truncate text-left text-xs font-medium text-blue-700 hover:opacity-80 dark:text-blue-300"
          >
            {renderLabel(label)}
          </button>
        ) : (
          <span
            title={missing ? missingLabel : undefined}
            className={cn(
              'min-w-0 truncate text-xs font-medium',
              !label && 'text-muted-foreground/50 italic',
              missing && 'text-muted-foreground line-through decoration-1',
              label && !missing && 'text-blue-700 dark:text-blue-300',
            )}
          >
            {label ? renderLabel(label) : placeholder}
          </span>
        )}
        {editable && (
          <button
            type="button"
            onClick={openPicker}
            title={editLabel}
            aria-label={editLabel}
            className="text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring shrink-0 rounded p-0.5 opacity-0 group-hover/work:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>

      {/* Screen preview popup — full screen like Main tab */}
      <Dialog
        open={previewing}
        onOpenChange={(next) => {
          setPreviewing(next);
          if (!next && screenId) setPreviewScreenId(screenId);
        }}
      >
        <DialogContent className="flex h-[90vh] w-[95vw] !max-w-[95vw] flex-col overflow-hidden p-0 gap-0 [&>button:last-child]:hidden">
          <DialogHeader className="!flex-row shrink-0 items-center justify-between border-b px-4 py-2">
            <DialogTitle className="flex items-center gap-2 text-sm font-medium">
              {label}
              {screenId && (
                <>
                  <span className="bg-border mx-2 h-4 w-px" />
                  <span className="text-muted-foreground font-mono text-xs font-normal">
                    {PROTOTYPE_FILES.find((p) => p.id === screenId)?.fileName ?? screenId}
                  </span>
                </>
              )}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setPreviewing(false)}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogHeader>
          {previewing && previewScreenId && (
            <LiveScreenPreview
              key={previewScreenId}
              screenId={previewScreenId}
              chrome
              showEditToggle={false}
              hrefForRoute={(route) => route}
              onNavigate={(route) => {
                const proto = findPrototypeByRoute(route);
                if (proto) setPreviewScreenId(proto.id);
              }}
              className="min-h-0 flex-1"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Screen picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Work Item</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">From screen</Label>
              <Select
                value={fromScreen}
                onValueChange={(v) => {
                  setFromScreen(v);
                  if (toScreen === v) setToScreen('');
                }}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select screen" />
                </SelectTrigger>
                <SelectContent>
                  {screenOptions.map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">To screen (optional)</Label>
              <Select
                value={toScreen || NONE}
                onValueChange={(v) => setToScreen(v === NONE ? '' : v)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-xs text-muted-foreground">
                    None
                  </SelectItem>
                  {screenOptions
                    .filter((name) => name !== fromScreen)
                    .map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">
                        {name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted rounded-md px-3 py-2 text-xs">
              Preview:{' '}
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {toScreen && toScreen !== NONE ? `${fromScreen} → ${toScreen}` : fromScreen || '—'}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={!fromScreen}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The depth cells of one row, in order — what Path is built from too. */
function depthsOf(row: IARow): string[] {
  return IA_DEPTH_FIELDS.map((field) => row[field]);
}

function downloadCSV(rows: IARow[], label: (row: IARow) => string) {
  const header = [
    'No',
    'Project',
    ...IA_DEPTH_FIELDS.map((_, index) => `Depth ${index + 1}`),
    'Path',
    'Screen ID',
    'Screen Key',
    'Screen type',
    'Status',
    'Platform',
    'Work item',
    'PRD',
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    header,
    ...rows.map((row, index) => [
      String(index + 1),
      row.projectName,
      ...depthsOf(row),
      pathOf(row).join(PATH_SEPARATOR),
      row.screenId,
      row.screenKey,
      row.screenType,
      row.status,
      row.platform,
      label(row),
      row.prd,
    ]),
  ].map((line) => line.map(escape).join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ia.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function IAPageInner() {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [folders, setFolders] = useState<DesignFolder[]>([]);
  const [rows, setRows] = useState<IARow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [idSuffixFmt, setIdSuffixFmt] =
    useState<import('@/lib/we-adk-mock/ia').IdSuffixFormat>('mixed');

  const folderParam = searchParams.get('folder');
  const fromFolder = folderParam?.startsWith('version-')
    ? Number.parseInt(folderParam.slice('version-'.length), 10)
    : Number.NaN;

  // Read after mount — everything here lives in localStorage — and again on
  // every navigation into the tab, so a file added on Main shows up here too.
  useEffect(() => {
    const project = findProject(params.projectId);
    if (!project) return;
    const nextFolders = loadRoundFolders(project.id);
    setFolders(nextFolders);

    const activeVersion = nextFolders.some((folder) => folder.versionNumber === fromFolder)
      ? fromFolder
      : pickDefaultVersion(nextFolders);
    const activeFolder = nextFolders.find((folder) => folder.versionNumber === activeVersion);
    const fmt = loadIdSuffixFormat(project.id);
    const rDigits = loadRandomDigits(project.id);
    const dCfgs = loadDepthConfigs(project.id);
    setIdSuffixFmt(fmt);
    setRows(
      activeVersion === null
        ? []
        : loadIARows(project.id, activeVersion, activeFolder, project.name, fmt, rDigits, dCfgs),
    );
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, pathname, searchParams]);

  const activeVersion = folders.some((folder) => folder.versionNumber === fromFolder)
    ? fromFolder
    : pickDefaultVersion(folders);
  const activeFolder = folders.find((folder) => folder.versionNumber === activeVersion);
  const locked = activeFolder?.versionStatus === 'Released' || activeFolder === undefined;

  /**
   * The design files this round holds, by id — what the Work item column
   * resolves against. Built from the same folder the rows were seeded from, so
   * a screen renamed or removed in Main is reflected on the next read rather
   * than leaving the sheet quoting a name that no longer exists.
   */
  const filesById = useMemo(() => {
    const map = new Map<string, DesignFile>();
    for (const child of activeFolder?.children ?? []) {
      for (const file of child.files) map.set(file.id, file);
    }
    for (const file of activeFolder?.files ?? []) map.set(file.id, file);
    return map;
  }, [activeFolder]);

  /** The object a row stands for, and the name to show for it. */
  const objectOf = useCallback(
    (row: IARow): WorkItemObject => ({
      bound: Boolean(row.fileId),
      file: row.fileId ? filesById.get(row.fileId) : undefined,
    }),
    [filesById],
  );
  const labelOf = useCallback(
    (row: IARow) => row.workItem || objectOf(row).file?.name || '',
    [objectOf],
  );

  /** Screen names for the picker — all screens across every round of this project. */
  const screenOptions = useMemo(() => {
    const names = new Set<string>();
    for (const folder of folders) {
      for (const file of folder.files) names.add(file.name);
      for (const child of folder.children ?? []) {
        for (const file of child.files) names.add(file.name);
      }
    }
    // Also include names from manually-entered rows so existing work items stay selectable
    for (const row of rows) {
      const name = row.workItem || '';
      if (name && !name.includes(' → ')) names.add(name);
      if (name.includes(' → ')) {
        for (const part of name.split(' → ')) {
          const trimmed = part.trim();
          if (trimmed) names.add(trimmed);
        }
      }
    }
    return [...names].sort();
  }, [folders, rows]);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | IAScreenType>('All');
  const [platformFilter, setPlatformFilter] = useState<'All' | IAPlatform>('All');

  const PAGE_SIZES = [20, 50, 100] as const;
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(0);

  /** Whether anything is narrowing the rows — drives the count and Clear. */
  const filtering = query.trim() !== '' || typeFilter !== 'All' || platformFilter !== 'All';

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== 'All' && row.screenType !== typeFilter) return false;
      if (platformFilter !== 'All' && row.platform !== platformFilter) return false;
      if (!needle) return true;
      return [...depthsOf(row), row.screenId, labelOf(row), row.link, row.menuGroup]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, query, typeFilter, platformFilter, labelOf]);

  // Reset to first page when filters or page size change.
  useEffect(() => setPage(0), [query, typeFilter, platformFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const paged = shown.slice(page * pageSize, (page + 1) * pageSize);

  /** The row just removed, so a slip of the trash icon has a way back. */
  const [pendingDelete, setPendingDelete] = useState<{ rows: IARow[]; label: string } | null>(null);
  const undoTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    };
  }, []);

  if (!loaded) return null;

  const project = findProject(params.projectId);
  if (!project || activeVersion === null || !activeFolder) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-muted-foreground text-sm">{t('explorer.noVersions')}</p>
      </div>
    );
  }

  const projectShort = (project.name.split(/\s+/)[0] ?? '').replace(/\s+/g, '');

  const patch = (rowId: string, fields: Partial<IARow>) => {
    setRows(updateIARow(project.id, activeVersion, rows, rowId, fields));
  };

  const removeRow = (row: IARow) => {
    const previous = rows;
    setRows(deleteIARow(project.id, activeVersion, rows, row.id));
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setPendingDelete({
      rows: previous,
      label: labelOf(row) || pathOf(row).pop() || row.screenId,
    });
    undoTimer.current = window.setTimeout(() => setPendingDelete(null), 6000);
  };

  const undoRemove = () => {
    if (!pendingDelete) return;
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setRows(restoreIARows(project.id, activeVersion, pendingDelete.rows));
    setPendingDelete(null);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/*
        One bar, three zones: what this is, which reading of it you want, and
        the controls that act on the rows. It was two rows, but the second held
        four controls in a full-width strip and read as empty space.
      */}
      <header className="bg-background flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-2.5">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <ListTree className="size-4 shrink-0 text-violet-500" />
            <h1 className="text-[15px] font-bold tracking-tight">{t('ia.title')}</h1>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
              {t('ia.count', { count: filtering ? `${shown.length}/${rows.length}` : rows.length })}
            </span>
          </div>
        </div>

        <span className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('ia.search')}
              aria-label={t('ia.search')}
              className="h-7 w-44 pl-7 text-xs xl:w-56"
            />
          </div>

          {/* The two filters used to read "All" and "All" — the same word twice,
              naming neither of the things it filtered. */}
          <Select
            value={typeFilter}
            onValueChange={(next) => setTypeFilter(next as typeof typeFilter)}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-[7.5rem] text-xs"
              aria-label={t('ia.filterType')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{t('ia.allTypes')}</SelectItem>
              {IA_SCREEN_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={platformFilter}
            onValueChange={(next) => setPlatformFilter(next as typeof platformFilter)}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-[8.5rem] text-xs"
              aria-label={t('ia.filterPlatform')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{t('ia.allPlatforms')}</SelectItem>
              {IA_PLATFORMS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Only offered when there is something to clear, so the bar does not
              carry a permanently dead control. */}
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setTypeFilter('All');
                setPlatformFilter('All');
              }}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md px-1.5 py-1 text-xs underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {t('ia.clearFilters')}
            </button>
          )}

          <span aria-hidden className="bg-border mx-0.5 h-5 w-px" />

          <button
            type="button"
            onClick={() => downloadCSV(shown, labelOf)}
            disabled={shown.length === 0}
            title={filtering ? t('ia.downloadFiltered', { count: shown.length }) : undefined}
            className="text-muted-foreground hover:text-foreground hover:border-border focus-visible:ring-ring flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
          >
            <Download className="size-3.5" />
            {t('ia.download')}
          </button>

          {!locked && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('ia.resetConfirm'))) {
                    setRows(
                      resetIARows(
                        project.id,
                        activeVersion,
                        activeFolder,
                        project.name,
                        loadIdSuffixFormat(project.id),
                        loadRandomDigits(project.id),
                        loadDepthConfigs(project.id),
                      ),
                    );
                  }
                }}
                title={t('ia.reset')}
                aria-label={t('ia.reset')}
                className="text-muted-foreground hover:text-foreground hover:border-border focus-visible:ring-ring rounded-lg border p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRows(addIARow(project.id, activeVersion, rows))}
                className="focus-visible:ring-ring flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 focus-visible:ring-2 focus-visible:outline-none"
              >
                <Plus className="size-3.5" />
                {t('ia.addRow')}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="bg-background w-full min-w-[160rem] table-fixed border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="text-muted-foreground border-border text-left text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase">
              <th className="bg-background w-10 border-b px-3 py-2 text-right">{t('ia.colNo')}</th>
              {IA_DEPTH_FIELDS.map((field, index) => (
                <th
                  key={field}
                  className="bg-background w-28 border-b px-3 py-2"
                  title={t('ia.depthHint')}
                >
                  {t(`ia.colDepth${index + 1}`)}
                </th>
              ))}
              {/* An explicit width, like every other column. Left width-less it
                  was the only column table-fixed could shrink, so once the
                  fixed columns added up to more than the table's min-width it
                  collapsed to nothing and spilled its header over Screen ID.
                  The min-width below is the sum of these, so there is always
                  room for all of them. */}
              <th className="bg-background w-96 border-b px-3 py-2">{t('ia.colPath')}</th>
              <th className="bg-background w-64 border-b px-3 py-2">{t('ia.colScreenId')}</th>
              <th className="bg-background w-80 border-b px-3 py-2">Screen Key</th>
              <th className="bg-background w-28 border-b px-3 py-2">{t('ia.colScreenType')}</th>
              <th className="bg-background w-32 border-b px-3 py-2 whitespace-nowrap">Status</th>
              <th className="bg-background w-24 border-b px-3 py-2">{t('ia.colPlatform')}</th>
              <th className="bg-background w-64 border-b px-3 py-2">{t('ia.colWorkItem')}</th>
              <th className="bg-background w-96 border-b px-3 py-2">{t('ia.colPrd')}</th>
              <th className="bg-background sticky right-0 w-20 border-b px-2 py-2 text-center shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row, index) => (
              <tr
                key={row.id}
                className="group border-border/60 hover:bg-muted/30 border-b align-middle transition-colors last:border-b-0"
              >
                <td className="text-muted-foreground px-3 py-2.5 text-right font-mono text-[11px] tabular-nums">
                  {page * pageSize + index + 1}
                </td>
                {IA_DEPTH_FIELDS.map((field) => (
                  <td key={field} className="px-3 py-2.5">
                    <ValueCell value={row[field]} placeholder={t('ia.placeholderDepth')} />
                  </td>
                ))}
                <td className="text-muted-foreground overflow-hidden px-3 py-2.5">
                  <PathText segments={pathOf(row)} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <ValueCell value={row.screenId} placeholder={t('ia.placeholderText')} mono />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <ValueCell value={row.screenKey} placeholder="screen_key" mono />
                </td>
                <td className="px-3 py-2.5">
                  {locked ? (
                    <span>{row.screenType}</span>
                  ) : (
                    <Select
                      value={row.screenType}
                      onValueChange={(next) => patch(row.id, { screenType: next as IAScreenType })}
                    >
                      <SelectTrigger
                        size="sm"
                        className={GHOST_TRIGGER}
                        aria-label={t('ia.colScreenType')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IA_SCREEN_TYPES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {locked ? (
                    <span
                      className={cn(
                        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium',
                        row.status === 'Done' &&
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                        row.status === 'In progress' &&
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                        row.status === 'Review' &&
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                        row.status === 'To do' &&
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                      )}
                    >
                      {row.status}
                    </span>
                  ) : (
                    <Select
                      value={row.status}
                      onValueChange={(next) => patch(row.id, { status: next as IAStatus })}
                    >
                      <SelectTrigger size="sm" className={GHOST_TRIGGER} aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IA_STATUSES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {locked ? (
                    <span>{row.platform}</span>
                  ) : (
                    <Select
                      value={row.platform}
                      onValueChange={(next) => patch(row.id, { platform: next as IAPlatform })}
                    >
                      <SelectTrigger
                        size="sm"
                        className={GHOST_TRIGGER}
                        aria-label={t('ia.colPlatform')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IA_PLATFORMS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="overflow-hidden px-3 py-2.5">
                  <WorkItemCell
                    object={objectOf(row)}
                    label={labelOf(row)}
                    screenId={row.fileId}
                    locked={locked}
                    openLabel={t('ia.openScreen')}
                    editLabel={t('ia.renameWorkItem')}
                    missingLabel={t('ia.workItemMissing')}
                    placeholder={t('ia.placeholderText')}
                    screenOptions={screenOptions}
                    onSave={(next) => patch(row.id, { workItem: next })}
                  />
                </td>
                <td className="overflow-hidden px-3 py-2.5">
                  <PrdCell
                    value={row.prd}
                    route={row.link}
                    locked={locked}
                    projectId={project.id}
                    version={activeVersion}
                    onSave={(next) => patch(row.id, { prd: next })}
                  />
                </td>
                <td className="bg-background sticky right-0 px-2 py-2.5 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setRows(
                          duplicateIARow(
                            project.id,
                            activeVersion,
                            rows,
                            row.id,
                            loadIdSuffixFormat(project.id),
                            loadRandomDigits(project.id),
                            loadDepthConfigs(project.id),
                          ),
                        )
                      }
                      title={t('ia.duplicateRow')}
                      aria-label={t('ia.duplicateRow')}
                      className="text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row)}
                      title={t('ia.deleteRow')}
                      aria-label={t('ia.deleteRow')}
                      className="text-muted-foreground/60 hover:text-destructive focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={17} className="text-muted-foreground px-3 py-10 text-center text-xs">
                  {rows.length === 0 ? t('ia.empty') : t('ia.noMatch')}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={17} className="border-t px-3 py-3">
                <div className="flex items-center">
                  <span className="text-muted-foreground text-xs">Total {shown.length} items</span>
                  <div className="flex flex-1 items-center justify-center gap-0.5">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 rounded p-1"
                      title="First page"
                    >
                      <ChevronsLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 rounded p-1"
                      title="Previous page"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => {
                      const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                      const end = Math.min(totalPages, start + 5);
                      if (i < start || i >= end) return null;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPage(i)}
                          className={cn(
                            'size-7 rounded text-xs font-medium',
                            i === page
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 rounded p-1"
                      title="Next page"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(totalPages - 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 rounded p-1"
                      title="Last page"
                    >
                      <ChevronsRight className="size-3.5" />
                    </button>
                  </div>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-background text-foreground rounded-md border px-2 py-1 text-xs"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} / page
                      </option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {pendingDelete && (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-xs shadow-lg">
          {t('ia.rowRemoved', { name: pendingDelete.label })}
          <button
            type="button"
            onClick={undoRemove}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {t('ia.undo')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function IAPage() {
  return (
    <Suspense>
      <IAPageInner />
    </Suspense>
  );
}
