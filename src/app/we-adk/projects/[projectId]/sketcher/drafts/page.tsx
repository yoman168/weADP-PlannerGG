'use client';

/**
 * The Request tab — screens that are not in a round yet.
 *
 * Generating from a task stages the result on that task, and a screen moved
 * over from a Customer project lands on the project itself. Either way it is
 * the right place to review one and the wrong place to see them all: a project
 * can carry a dozen unplaced screens spread across as many sources, and nobody
 * could tell how many were waiting or which were forgotten. This is the pile,
 * in one place.
 *
 * It is Main, for screens that have no round. Same explorer on the left, same
 * toolbar, the same Preview and Page readings of a screen, the same chat beside
 * it, the same two floating actions — because a draft is the same kind of thing
 * as a filed screen and deserves the same reading of it. What differs is the
 * tree: Main nests by the folder a file sits in, and this nests by the
 * information architecture the draft arrived with, which is the only thing a
 * draft knows about where it belongs.
 *
 * What it does not have is Main's writing. There is no round to save into, so
 * no Save, no A/M markers and no reordering; and no Flow view, which is drawn
 * from a round's IA sheet — a draft is precisely a screen that is not in one
 * yet. Putting a draft into a round stays Main's job, which is what the open
 * button hands over to.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  Folder,
  FolderOpen,
  Layers,
  MessageSquare,
  MonitorPlay,
  Check,
  MousePointerClick,
  MousePointer2,
  PackageOpen,
  PenLine,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Input, cn } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useLocale } from '@/lib/locale';
import { ChatPane } from '@/components/we-adk/claude-chat';
import { DesignHtmlButton } from '@/components/we-adk/design-html-button';
import { ScreenLinkPicker } from '@/components/we-adk/screen-link-picker';
import { PageEditor } from '@/components/we-adk/page-editor';
import { businessEditHref, businessPreviewHref, previewHref } from '@/components/we-adk/mockup-board';
import {
  DeviceSwitcher,
  ScreenPreviewSurface,
  type PreviewMode,
} from '@/components/we-adk/screen-preview';
import { findProject } from '@/lib/we-adk-mock/projects';
import { projectTasks } from '@/lib/we-adk-mock/tasks';
import { saveHtmlAndBlocks } from '@/lib/we-adk/html-to-blocks';
import { describeCanvas } from '@/lib/we-adk/sketcher-operations';
import {
  loadProjectDrafts,
  markStandaloneDraftFiled,
  markTaskDesignFiled,
  type ProjectDraft,
} from '@/lib/we-adk/task-design';
import { loadGeneratedScreens, saveGeneratedScreens } from '@/lib/we-adk-mock/sketches';
import { loadRoundFolders } from '@/lib/we-adk/round-screens';
import {
  addSubfolder,
  ensureInProgressVersion,
  loadSubfolders,
  loadVersionNames,
  subfolderStorageKey,
  versionDisplayName,
  versionFolderId,
  versionFolderKey,
} from '@/lib/we-adk-mock/versions';
import { loadScreenBlocks, type DevicePresetId } from '@/lib/we-adk-mock/sketcher';
import { workspaceStore } from '@/lib/api/workspace-store';
import { loadDesignHtml } from '@/lib/we-adk/design-html';
import { openFlowDocument } from '@/lib/we-adk/mockup-pages';

/** A draft's key — a screen id is unique, but the task it came from names it. */
const draftKey = (draft: ProjectDraft) => `${draft.taskId ?? 'project'}:${draft.screenId}`;

/**
 * The explorer's row, borrowed rather than reinvented.
 *
 * A tree that is nearly the same as Main's reads as a different tree, and the
 * whole point of this tab looking like Main is that a draft is the same kind of
 * thing as a filed screen. Same rail, same spacing, same hover.
 */
function rowClass(active: boolean): string {
  return cn(
    'group/folder flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-xs',
    active
      ? 'border-primary bg-muted text-foreground'
      : 'border-transparent text-muted-foreground hover:bg-muted/50',
  );
}

/** What a draft is called as a file: its route, or its name, made filename-ish. */
function fileNameOf(draft: ProjectDraft): string {
  const base = (draft.route ?? draft.name)
    .trim()
    .replace(/^\//, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'untitled'}.html`;
}

/* ------------------------------------------------------------------ */
/* The tree                                                            */
/* ------------------------------------------------------------------ */

/**
 * A node of the drafts tree: a source, or one level of a draft's IA path.
 *
 * The depth comes from the placement agreed when the screen was sent over —
 * `['Accountant', 'Approval Queue']` becomes two folders, and the draft sits
 * inside the second. A draft with no placement sits directly under its source,
 * which is exactly as much as is known about where it goes.
 */
interface TreeNode {
  name: string;
  /** Its full path, which is also what remembers whether it is folded. */
  path: string;
  folders: TreeNode[];
  drafts: ProjectDraft[];
}

function emptyNode(name: string, path: string): TreeNode {
  return { name, path, folders: [], drafts: [] };
}

/** How many drafts sit at or under a node. */
function countOf(node: TreeNode): number {
  return node.drafts.length + node.folders.reduce((sum, child) => sum + countOf(child), 0);
}

function buildTree(drafts: ProjectDraft[]): TreeNode[] {
  const roots: TreeNode[] = [];
  for (const draft of drafts) {
    const root =
      roots.find((entry) => entry.name === draft.fromLabel) ??
      emptyNode(draft.fromLabel, draft.fromLabel);
    if (!roots.includes(root)) roots.push(root);

    let node: TreeNode = root;
    for (const segment of draft.placement?.parentPath ?? []) {
      if (!segment.trim()) continue;
      const child: TreeNode =
        node.folders.find((entry) => entry.name === segment) ??
        emptyNode(segment, `${node.path}/${segment}`);
      if (!node.folders.includes(child)) node.folders.push(child);
      node = child;
    }
    node.drafts.push(draft);
  }
  return roots;
}

export default function DraftsPage() {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const project = findProject(params.projectId);
  const [drafts, setDrafts] = useState<ProjectDraft[]>([]);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  /** Folders start open — a pile you have to unfold is a pile you don't clear. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [device, setDevice] = useState<DevicePresetId>('full');
  const [mode] = useState<PreviewMode>('wireframe');
  /** Preview is the screen; Page is the document it is, edited in place. */
  const [tab, setTab] = useState<'preview' | 'page'>('preview');
  /** Wiring: the mode, and the control waiting to be told what it opens. */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  /** The page behind the open draft, re-read whenever one is saved. */
  const [pageHtml, setPageHtml] = useState<string | null>(null);
  /**
   * The round a request would go into: the newest one still open, or nothing.
   *
   * Read from the same rounds Main lists rather than counted from the version
   * number — a project can have rounds removed, or none at all, and counting
   * gets both of those wrong. Nothing open is not a refusal: a project created
   * to receive these screens has no round yet, and telling someone to go to
   * Main and make one before they can move anything is a dead end. The move
   * opens one, which is what `ensureInProgressVersion` is for; this only
   * decides whether the button says which round, or says it will open one.
   */
  const [target, setTarget] = useState<{ version: number; name: string } | null>(null);

  // Requests live in browser storage, so they arrive after mount rather than
  // with the server render. Filed ones are kept: a row that vanishes on the
  // click that moved it leaves you unsure whether it worked.
  const refresh = () => {
    if (!project) return;
    const tasks = projectTasks(project.id).map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
    }));
    setDrafts(loadProjectDrafts(project.id, tasks, { includeFiled: true }));
  };

  useEffect(refresh, [project]);

  /**
   * Which round is open, now and whenever you come back.
   *
   * Rounds are opened in Main, so the answer changes while this tab is sitting
   * there — without the second read, starting a round and switching back left
   * the button still saying there was nowhere to go.
   */
  useEffect(() => {
    if (!project) return;
    const read = () => {
      const open = loadRoundFolders(project.id)
        .filter((folder) => folder.versionStatus !== 'Released')
        .reduce<{ version: number; name: string } | null>(
          (newest, folder) =>
            folder.versionNumber !== undefined &&
            (newest === null || folder.versionNumber > newest.version)
              ? { version: folder.versionNumber, name: folder.name }
              : newest,
          null,
        );
      setTarget(open);
    };
    read();
    window.addEventListener('focus', read);
    return () => window.removeEventListener('focus', read);
  }, [project]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return drafts;
    return drafts.filter((draft) =>
      [draft.name, draft.route, draft.fromLabel, ...(draft.placement?.parentPath ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [drafts, query]);

  const tree = useMemo(() => buildTree(shown), [shown]);
  /** A request that has gone into a round is done here. */
  const isFiled = (draft: ProjectDraft) => draft.version !== undefined;
  const waiting = drafts.filter((draft) => !isFiled(draft));

  // The one on show: what was picked, while it is still in the list.
  const open = shown.find((draft) => draftKey(draft) === openId) ?? shown[0];
  const openScreenId = open?.screenId;

  /**
   * The request in its own tab — and the rest of them with it, wired.
   *
   * A generated page draws its navigation and writes `data-screen` rather than
   * an href, which this tab turns into navigation when it shows the page. Alone
   * in a browser that sidebar is drawn and dead, so the whole set goes over as
   * one document and the tab opens on the request being looked at.
   *
   * Falls back to the route this button has always opened, for a request with
   * no generated page: there is nothing to put in a standalone document, and a
   * flow that does not contain the screen someone was on is worse than a link
   * that does not walk.
   */
  const openInBrowser = (draft: ProjectDraft) => {
    if (loadDesignHtml(draft.screenId)) {
      const set = drafts.map((entry) => ({
        id: entry.screenId,
        name: entry.name,
        html: loadDesignHtml(entry.screenId) ?? undefined,
      }));
      if (openFlowDocument(set, t('tab.drafts'), draft.screenId)) return;
    }
    // Declared above the guard that proves the project exists, so optional here.
    window.open(previewHref(draft.screenId, project?.id), '_blank', 'noopener');
  };

  // The page follows the screen, and any save of it from the editor or chat.
  useEffect(() => {
    if (!openScreenId) {
      setPageHtml(null);
      return;
    }
    const read = () => setPageHtml(loadDesignHtml(openScreenId));
    read();
    window.addEventListener('we-adk:html-updated', read);
    return () => window.removeEventListener('we-adk:html-updated', read);
  }, [openScreenId]);

  /**
   * Files a request into the round.
   *
   * It keeps its own screen id, so the page, the canvas and every link to it
   * carry over untouched — the move is a change of where the screen is filed,
   * not a new copy of it. The row stays here carrying the version, which is
   * what turns its move button off and says where it went.
   */
  const fileOne = (draft: ProjectDraft, version: number): void => {
    if (!project) return;

    /*
     * The folder it sits in travels with it.
     *
     * A request arrives under the IA path it was agreed at, and moving only the
     * file would drop that on the floor — the round would gain a flat pile of
     * screens whose relationships were decided and then thrown away. A round
     * holds one level of folder, so a deeper path is carried in the folder's
     * name rather than being cut down to its last segment: "Login / Daily Sales
     * Report" still says where the screen sits, where "Daily Sales Report"
     * alone would not.
     *
     * A screen that other screens open from goes *inside* the folder named
     * after it, not beside it. Login is both a screen and the section holding
     * what it opens, and filing the screen at the root while its children sat
     * in a folder called Login split one thing into two rows that looked
     * unrelated.
     */
    const sections = new Set(
      drafts.flatMap((entry) =>
        (entry.placement?.parentPath ?? []).map((part) => part.trim()).filter(Boolean),
      ),
    );
    const own = (draft.placement?.parentPath ?? []).map((part) => part.trim()).filter(Boolean);
    const path = sections.has(draft.name.trim()) ? [...own, draft.name.trim()] : own;
    let key = versionFolderKey(project.id, version);
    if (path.length > 0) {
      /*
       * Joined with › rather than /.
       *
       * "Product Catalog / Checkout" is a screen name with a slash in it, so a
       * slash-joined path could not be taken apart again: the tree read it as
       * three levels, two of which were halves of one name. › is a separator
       * because nothing calls a screen that.
       */
      const name = path.join(' › ');
      const folder =
        loadSubfolders(project.id, version).find((entry) => entry.name === name) ??
        addSubfolder(project.id, version, name, new Date().toISOString().slice(0, 10));
      key = subfolderStorageKey(project.id, version, folder.id);
    }

    const already = loadGeneratedScreens(key).some((screen) => screen.id === draft.screenId);
    if (!already) {
      saveGeneratedScreens(key, [
        ...loadGeneratedScreens(key),
        {
          id: draft.screenId,
          name: draft.name,
          route: draft.route,
          seedPattern: 'listPage' as const,
          status: { label: 'From Request', tone: 'violet' as const },
          updatedAt: new Date().toISOString().slice(0, 10),
          generated: true,
          origin: 'copied' as const,
        },
      ]);
    }

    const movedAt = new Date().toISOString();
    if (draft.taskId) markTaskDesignFiled(project.id, draft.taskId, draft.screenId, version, movedAt);
    else markStandaloneDraftFiled(project.id, draft.screenId, version, movedAt);
  };

  /**
   * The round to file into, opening one if the project has none.
   *
   * A round opened this way opens empty, the same as one opened from the
   * picker in Main.
   */
  const openRound = (): { version: number; name: string } | null => {
    if (!project) return null;
    if (target) return target;
    const version = ensureInProgressVersion(project.id);
    const next = { version, name: versionDisplayName(version, loadVersionNames(project.id)) };
    setTarget(next);
    return next;
  };

  const moveToMain = () => {
    if (!open || isFiled(open)) return;
    const round = openRound();
    if (!round) return;
    fileOne(open, round.version);
    refresh();
    showToast(`${open.name} → ${round.name}`);
  };

  /** Every request still waiting, in one go. */
  const moveAll = () => {
    if (waiting.length === 0) return;
    const round = openRound();
    if (!round) return;
    for (const draft of waiting) fileOne(draft, round.version);
    refresh();
    showToast(`${waiting.length} screen${waiting.length === 1 ? '' : 's'} → ${round.name}`);
  };

  const toggleFolder = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (!project) return null;

  /** Where the open draft sits, spelled out — its IA path, then itself. */
  const wherePath = open ? [...(open.placement?.parentPath ?? []), open.name].join(' › ') : '';

  /**
   * What the chat beside the screen can see. The sections have to be in here:
   * with only a name to go on, the model has nothing to answer from.
   */
  const screenContext = open
    ? [
        `Screen: ${open.name}${open.route ? ` (route ${open.route})` : ''}`,
        `A draft in ${project.name}, not in a round yet. ${open.fromLabel}.`,
        open.placement
          ? `Agreed placement: opens from ${open.placement.parentName} · ${open.placement.screenType} · ${open.placement.platform}.`
          : '',
        '',
        'Its sections, top to bottom:',
        describeCanvas(loadScreenBlocks(open.screenId, 'listPage')),
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 14_000)
    : '';

  const improvePrompt = open
    ? [
        `Improve ${open.name}${open.route ? ` (${open.route})` : ''}, a draft waiting to go into a`,
        'round, working from the sections listed in the context above. Suggest concrete changes to',
        'its layout, information hierarchy, wording and empty or error states. Answer as a short',
        'prioritised list — for each, name the section it applies to and what it buys the person',
        'using it. Do not redesign the screen from scratch.',
      ].join(' ')
    : '';

  /** One node of the tree, and everything under it. */
  const renderNode = (node: TreeNode) => {
    const isOpen = !collapsed.has(node.path);
    return (
      <div key={node.path}>
        <div className={rowClass(false)}>
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
            aria-expanded={isOpen}
            className="hover:text-foreground shrink-0"
          >
            {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            title={node.path}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            {isOpen ? (
              <FolderOpen className="size-3.5 shrink-0" />
            ) : (
              <Folder className="size-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <span className="shrink-0 font-mono text-[10px]">{countOf(node)}</span>
          </button>
        </div>

        {isOpen && (
          <div className="ml-5 border-l">
            {node.folders.map((child) => renderNode(child))}
            {node.drafts.map((draft) => {
              const key = draftKey(draft);
              const active = !!open && draftKey(open) === key;
              return (
                <div key={key} className={rowClass(active)}>
                  <button
                    type="button"
                    onClick={() => setOpenId(key)}
                    title={`${draft.name}${draft.route ? ` · ${draft.route}` : ''}`}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 text-xs',
                      active ? 'font-medium' : 'hover:text-foreground',
                    )}
                  >
                    <Code2 className="size-3.5 shrink-0" />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-left font-mono',
                        isFiled(draft) && 'opacity-50',
                      )}
                    >
                      {fileNameOf(draft)}
                    </span>
                    {/* Already in a round — the row stays, and says so. */}
                    {isFiled(draft) && (
                      <Check
                        className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-label="In a round"
                      />
                    )}
                    {/* The same letter-slot marker Main uses for a popup. */}
                    {draft.placement && draft.placement.screenType !== 'Screen' && (
                      <span
                        title={`${draft.placement.screenType} · ${draft.placement.platform}`}
                        className="w-3 shrink-0 text-center font-mono text-[10px] font-semibold text-violet-600 dark:text-violet-400"
                      >
                        {draft.placement.screenType.slice(0, 1)}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {/* Left: the pile, nested the way it was agreed to sit. */}
      <div className="bg-background flex w-64 shrink-0 flex-col border-r max-lg:hidden">
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          <Layers className="size-3.5 shrink-0 text-violet-500" />
          <span className="truncate font-mono text-xs font-medium">{t('tab.drafts')}</span>
          <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
            {query.trim() ? `${shown.length}/${drafts.length}` : drafts.length}
          </Badge>
        </div>

        {drafts.length > 0 && (
          <div className="relative shrink-0 px-3 pb-2">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('drafts.search')}
              aria-label={t('drafts.search')}
              className="h-7 pl-7 text-xs"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {drafts.length === 0 ? (
            <p className="text-muted-foreground px-2 py-10 text-center text-xs leading-relaxed">
              {t('drafts.empty')}
            </p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground px-2 py-10 text-center text-xs">
              {t('drafts.noMatch')}
            </p>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </div>

        {/* Under the tree, where you end up after reading it: the whole pile,
            in one move. Clearing a request one screen at a time is the right
            pace when you are judging them and the wrong one when they were all
            agreed in the same meeting. */}
        {drafts.length > 0 && (
          <div className="shrink-0 border-t p-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full gap-1.5 text-xs"
              onClick={moveAll}
              disabled={waiting.length === 0}
              title={
                waiting.length === 0
                  ? t('drafts.allMoved')
                  : target
                    ? `${t('drafts.moveAll')} — ${target.name}`
                    : t('drafts.willOpenRound')
              }
            >
              {waiting.length === 0 ? (
                <>
                  <Check className="size-3" />
                  {t('drafts.allMoved')}
                </>
              ) : (
                <>
                  <PackageOpen className="size-3" />
                  {t('drafts.moveAll')}
                  <span className="font-mono text-[10px]">{waiting.length}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Right: the draft itself, under Main's toolbar. */}
      {open ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="bg-background flex shrink-0 border-b">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-4 py-2">
              <Code2 className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate font-mono text-xs font-medium">{fileNameOf(open)}</span>
              <span className="text-muted-foreground truncate text-xs">{open.name}</span>
              <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                {t('drafts.notInRound')}
              </span>

              <div className="ml-auto flex items-center gap-2">
                {/* Preview is the screen; Page is the document it is. Local
                    tabs rather than routes: a draft has no round in the URL for
                    a navigation to carry across. */}
                <div className="flex overflow-hidden rounded-md border">
                  <button
                    type="button"
                    onClick={() => setTab('preview')}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors',
                      tab === 'preview'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <MonitorPlay className="size-3" />
                    {t('view.preview')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('page')}
                    disabled={!pageHtml}
                    title={pageHtml ? undefined : t('drafts.noPage')}
                    className={cn(
                      'flex items-center gap-1.5 border-l px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                      tab === 'page'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <MousePointerClick className="size-3" />
                    {t('view.page')}
                  </button>
                </div>
                {/* The same wiring gesture the meeting has. A request often
                    arrives with a link the model missed, and the meeting it
                    came from is finished by then. */}
                <button
                  type="button"
                  onClick={() => {
                    setPicking((current) => !current);
                    setPicked(null);
                  }}
                  aria-pressed={picking}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors',
                    picking
                      ? 'bg-indigo-500 text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                  title="Click a control on the screen to say what it opens"
                >
                  <MousePointer2 className="size-3.5" />
                  {picking ? 'Picking…' : 'Link'}
                </button>
                <DeviceSwitcher device={device} onChange={setDevice} />
                <DesignHtmlButton
                  screenId={open.screenId}
                  name={open.name}
                  route={open.route}
                  origin="Request"
                  className="h-7 gap-1 px-2 text-xs"
                />
                {/* Main is where a draft becomes work: the canvas edits it, and
                    the round it joins is decided there. */}
                {/* Into the open round: this is how a draft stops being one. */}
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={moveToMain}
                  disabled={isFiled(open)}
                  title={
                    isFiled(open)
                      ? t('drafts.alreadyInMain')
                      : target
                        ? `${t('drafts.moveToMain')} — ${target.name}`
                        : t('drafts.willOpenRound')
                  }
                >
                  {isFiled(open) ? <Check className="size-3" /> : <PackageOpen className="size-3" />}
                  {isFiled(open) ? t('drafts.alreadyInMain') : t('drafts.moveToMain')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                  <Link href={businessEditHref(project.id, open.screenId, null)}>
                    <PenLine className="size-3" />
                    {t('drafts.open')}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => openInBrowser(open)}
                >
                  <ExternalLink className="size-3" />
                  {t('view.openBrowser')}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                {tab === 'page' && pageHtml ? (
                  <PageEditor
                    key={open.screenId}
                    html={pageHtml}
                    screenTitle={open.name}
                    onSave={(updatedHtml) => {
                      /*
                       * The page only. `saveHtmlAndBlocks` would also write the
                       * html parse over the canvas, replacing the blocks that
                       * travelled with the draft with the single header that
                       * parse recovers.
                       */
                      try {
                        workspaceStore.setItem(
                          `we-adk:design-html:${open.screenId}`,
                          updatedHtml,
                        );
                      } catch {
                        /* storage full */
                      }
                      window.dispatchEvent(new Event('we-adk:html-updated'));
                    }}
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[#f4f5f7] p-5 dark:bg-[#191024]">
                    <ScreenPreviewSurface
                      key={open.screenId}
                      screenId={open.screenId}
                      seedPattern="listPage"
                      route={open.route}
                      device={device}
                      mode={mode}
                      // Read here, worked on in Main — a draft's sections are
                      // edited where the round is decided.
                      editable={false}
                      hrefForRoute={() => null}
                      /*
                       * The rest of the pile, so a screen's own navigation
                       * still works after it has been moved. The wiring lives
                       * in the page as screen names, so it survives the copy —
                       * what it needs is something to resolve those names
                       * against, which is the list on the left.
                       */
                      links={drafts.map((entry) => ({
                        id: entry.screenId,
                        name: entry.name,
                      }))}
                      onOpenScreen={(id) => {
                        const target = drafts.find((entry) => entry.screenId === id);
                        if (target) setOpenId(draftKey(target));
                      }}
                      pick={picking}
                      onPickControl={setPicked}
                    />
                  </div>
                )}

                {/* The same action Main floats over a screen. The strip
                    lets clicks through; only the pill catches them. */}
                {tab === 'preview' && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
                    <div className="bg-background pointer-events-auto flex items-center gap-2 rounded-full border px-2 py-1.5 shadow-lg">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-full"
                        onClick={() => {
                          setChatCollapsed(false);
                          setAiPrompt(improvePrompt);
                        }}
                        title={`Ask Claude how to improve ${open.name}`}
                      >
                        <Sparkles className="size-3.5" />
                        {t('action.improveAi')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Where it came from and where it was agreed to sit — a draft on
                  its own says nothing about why it exists or where it belongs. */}
              <p className="text-muted-foreground bg-background flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2 text-[10px]">
                <span className="truncate">{open.fromLabel}</span>
                {open.placement && (
                  <span className="truncate">
                    ↳ {wherePath} · {open.placement.screenType} · {open.placement.platform}
                  </span>
                )}
                {/* Why the move button is off, where it can actually be read —
                    a disabled button with the reason hidden in a tooltip is a
                    dead end. */}
                {isFiled(open) ? (
                  <span className="ml-auto flex items-center gap-1.5 truncate text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3 shrink-0" />
                    {t('drafts.alreadyInMain')}
                    <Link
                      href={businessPreviewHref(
                        project.id,
                        open.screenId,
                        open.version === undefined ? null : versionFolderId(open.version),
                      )}
                      className="underline underline-offset-2"
                    >
                      {t('tab.main')}
                    </Link>
                  </span>
                ) : target ? (
                  <span className="ml-auto truncate">→ {target.name}</span>
                ) : (
                  <span className="ml-auto truncate">{t('drafts.willOpenRound')}</span>
                )}
              </p>
            </div>

            {/* AI Chat — collapsible, the same pattern the preview uses. */}
            {chatCollapsed ? (
              <button
                type="button"
                onClick={() => setChatCollapsed(false)}
                title="Open AI chat"
                aria-label="Open AI chat"
                className="bg-background hover:bg-muted fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full border px-3.5 py-2 shadow-lg transition-colors"
              >
                <MessageSquare className="text-muted-foreground size-4" />
                <span className="text-xs font-medium">AI Chat</span>
              </button>
            ) : (
              <aside className="bg-background flex w-[26rem] shrink-0 flex-col border-l">
                <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
                  <span className="text-muted-foreground text-xs font-medium">AI Chat</span>
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
                  key={open.screenId}
                  project={project}
                  contextText={screenContext}
                  folderLabel={`drafts/${fileNameOf(open)}`}
                  greeting={t('chat.askAbout', { name: open.name })}
                  greetingHint="Ask to improve this draft — Claude can rewrite the page before it goes into a round."
                  initialTurns={[]}
                  pendingPrompt={aiPrompt}
                  onPromptHandled={() => setAiPrompt(null)}
                  onPersist={() => {}}
                  onResponse={(responseText) => {
                    const match = responseText.match(/```html\s*\n([\s\S]*?)```/);
                    if (match?.[1]) saveHtmlAndBlocks(open.screenId, match[1].trim());
                  }}
                />
              </aside>
            )}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Sparkles className="size-6 opacity-40" />
          <p className="max-w-sm text-xs leading-relaxed">
            {drafts.length === 0 ? t('drafts.empty') : t('drafts.noMatch')}
          </p>
        </div>
      )}

      {/* The control just clicked, and what it should open. */}
      {open && picked !== null && (
        <ScreenLinkPicker
          screenId={open.screenId}
          index={picked}
          targets={drafts
            .filter((entry) => entry.screenId !== open.screenId)
            .map((entry) => ({
              id: entry.screenId,
              name: entry.name,
              kind: entry.placement?.screenType,
            }))}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
