'use client';

import {
  ArrowLeft,
  CalendarDays,
  CircleStop,
  Clock,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  FileCode2,
  Folder,
  FolderOpen,
  Layers,
  Loader2,
  MessageSquare,
  MousePointerClick,
  PackageOpen,
  Pencil,
  Plus,
  Link2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@/components/ui';
import { useApiSession } from '@/lib/api/session';
import { claudeHeaders } from '@/lib/we-adk/claude-account';
import { ChatPane, readChatEvent, type ChatTurn } from '@/components/we-adk/claude-chat';
import { findProject } from '@/lib/we-adk-mock/projects';
import { saveHtmlAndBlocks } from '@/lib/we-adk/html-to-blocks';
import { generateScreenBlocks } from '@/lib/we-adk/generate-blocks';
import { PageEditor } from '@/components/we-adk/page-editor';
import { loadScreenBlocks, screenStorageKey as canvasKey } from '@/lib/we-adk-mock/sketcher';
import { MoveToProductDialog, type MovingScreen } from '@/components/we-adk/move-to-product-dialog';

import { WhiteboardPanel } from '@/components/we-adk/whiteboard-panel';
import { loadArtifacts } from '@/lib/we-adk/board-artifacts';

import {
  SOURCE_STYLE,
  TASK_SOURCES,
  taskSource,
  loadMockups,
  meetingAuthor,
  screenChange,
  meetingIA,
  meetingScreens,
  saveMockups,
  screenIdFor,
  withScreens,
  type MeetingIA,
  type MeetingKind,
  type MockupMeeting,
  type MockupScreen,
  type TaskSource,
} from '@/lib/we-adk-mock/mockup-tasks';
import {
  inertPreviewHtml,
  listPageControls,
  parseGeneratedPages,
  readPreviewNav,
  readPreviewPick,
  setPageControlTargets,
  type PreviewLink,
} from '@/lib/we-adk/mockup-pages';
import {
  buildFlow,
  GenerateModeDialog,
  ProductBuildDialog,
  placementFor,
  productScreens,
  type BuildStep,
  type FlowNode,
  type GenerateMode,
} from '@/components/we-adk/product-mockup';
import { addStandaloneDraft } from '@/lib/we-adk/task-design';
import { workspaceStore } from '@/lib/api/workspace-store';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function chatKey(projectId: string, meetingId: string) {
  return `we-adk:mini-mockup-chat:${projectId}:${meetingId}`;
}

function loadChatTurns(projectId: string, meetingId: string): ChatTurn[] {
  try {
    const raw = workspaceStore.getItem(chatKey(projectId, meetingId));
    return raw ? (JSON.parse(raw) as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

function saveChatTurns(projectId: string, meetingId: string, turns: ChatTurn[]): void {
  try {
    workspaceStore.setItem(chatKey(projectId, meetingId), JSON.stringify(turns.slice(-40)));
  } catch {}
}

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/*                                                                     */
/* The screen is the generated page, and the page is what gets edited. */
/* Blocks are still generated alongside it — they are what makes the   */
/* copy editable on the Product side, where the canvas lives — but     */
/* nothing here reads them, so there is one surface and nothing to     */
/* keep in step.                                                       */
/* ------------------------------------------------------------------ */

/**
 * The screen, as the page it is.
 *
 * There is nothing to choose between here any more: a generated screen has one
 * representation and this draws it. What is left is the empty case, which is
 * worth being explicit about — a task with notes and no screen yet is the most
 * common thing to be looking at.
 */
function MeetingScreenPreview({
  html,
  links,
  currentId,
  pick = false,
}: {
  html?: string;
  links: PreviewLink[];
  /** Which of `links` is on screen, so its nav item reads as the current one. */
  currentId?: string;
  /** Outline the controls and report the one clicked, instead of following it. */
  pick?: boolean;
}) {
  /*
   * Rewritten once per page rather than on every render — parsing a few
   * hundred lines of html is not free, and the page only changes when it is
   * saved. `links` is keyed by its contents for the same reason: the array is
   * rebuilt every render, its contents almost never change.
   */
  const key = links.map((link) => `${link.id}:${link.name}`).join('|');
  const safe = useMemo(
    () => (html ? inertPreviewHtml(html, links, currentId, pick) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [html, key, currentId, pick],
  );

  if (!html) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20">
          <Sparkles className="size-6 text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-medium">No screen yet</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Write your notes, then click <strong>Generate</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 p-3">
      <iframe
        srcDoc={safe}
        title="Source preview"
        className="h-full w-full rounded-lg border bg-white shadow-sm"
        sandbox="allow-scripts"
      />
    </div>
  );
}

export function MiniMockupView({ projectId }: { projectId: string; projectName: string }) {
  const [meetings, setMeetings] = useState<MockupMeeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  /**
   * The prompt an Improve click hands to the chat.
   *
   * Deliberately routed through the chat rather than sent as its own one-shot call. The
   * notes are what every screen in this meeting is generated from, so silently rewriting
   * them is the last thing this button should do — the chat's meeting skill answers with a
   * ```notes block, which renders an "Apply to Notes" button, and applying it stays a
   * decision. It also costs no new endpoint: `onApplyNotes` below is already wired.
   */
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);

  /**
   * Hidden until asked for, like every other chat in the workspace.
   *
   * Open by default it took a quarter of the width from the two things being compared —
   * the notes and the screen — before anyone had asked it anything. The preview page, the
   * task tab and Main all start theirs closed; this one was the exception and the
   * inconsistency was the bug, not the width.
   */
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAttendees, setNewAttendees] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newKind, setNewKind] = useState<MeetingKind>('meeting-note');
  /** Where the meeting came from. Separate from `kind`, which is about output. */
  const [newSource, setNewSource] = useState<TaskSource>('meeting');
  /** Who a meeting created here is posted by — no longer a question anyone answers. */
  const { user } = useApiSession();
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesText, setEditNotesText] = useState('');
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [previewMode, setPreviewMode] = useState<'preview' | 'page'>('preview');
  /** Which of the selected meeting's pages is on screen. */
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const [previewWidth, setPreviewWidth] = useState(0);
  const previewDrag = useRef<{ x: number; w: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadMockups(projectId);
    setMeetings(loaded);
    if (loaded.length > 0 && !selectedId) setSelectedId(loaded[0]!.id);
  }, [projectId]);

  // Load chat history when meeting changes
  useEffect(() => {
    if (selectedId) setChatTurns(loadChatTurns(projectId, selectedId));
    else setChatTurns([]);
    setActivePageId(null);
    setExternalId(null);
  }, [projectId, selectedId]);

  /*
   * A click inside a previewed screen, asking for another one.
   *
   * The preview is sandboxed and cannot reach in here, so it posts the screen
   * it wants and this decides — which is the only arrangement where a
   * generated page can be clickable without also being trusted.
   */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const chosen = readPreviewPick(event.data);
      if (chosen !== null) return setPicked(chosen);
      const to = readPreviewNav(event.data);
      if (!to) return;
      // Either half of the tree: this meeting's screens, or the product's.
      if (ownIdsRef.current.has(to)) {
        setActivePageId(to);
        setExternalId(null);
      } else if (externalIdsRef.current.has(to)) {
        setExternalId(to);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Default preview width = half the space after the sidebar
  useEffect(() => {
    if (containerRef.current) {
      const total = containerRef.current.offsetWidth;
      setPreviewWidth(Math.round(total / 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = meetings.find((m) => m.id === selectedId) ?? null;

  const openCreateDialog = () => {
    setNewTitle('');
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewAttendees('');
    setNewNotes('');
    setNewKind('meeting-note');
    setNewSource('meeting');
    setCreateOpen(true);
  };

  /** "Untitled source", then "Untitled source 2", and so on. */
  const nextUntitledName = (): string => {
    const base = 'Untitled source';
    const taken = new Set(meetings.map((meeting) => meeting.title));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base} ${n}`)) n += 1;
    return `${base} ${n}`;
  };

  const confirmCreate = () => {
    const id = `mockup-${Date.now().toString(36)}`;
    const meeting: MockupMeeting = {
      id,
      title: newTitle.trim() || nextUntitledName(),
      date: newDate,
      attendees: newAttendees,
      notes: newNotes,
      kind: newKind,
      source: newSource,
      /*
       * Whoever is signed in, not a name anyone picks.
       *
       * Asking was busywork with a wrong answer available: the list is the
       * project's roster, so on a project whose team is still empty the only
       * option was "Nobody yet". Signed out — the workspace runs perfectly
       * well that way — this stays unset and `meetingAuthor` falls back to
       * the first attendee, as it does for every meeting written before the
       * field existed.
       */
      postedBy: user?.name ?? user?.email,
    };
    const updated = [meeting, ...meetings];
    setMeetings(updated);
    saveMockups(projectId, updated);
    setSelectedId(id);
    setCreateOpen(false);
  };

  /**
   * Patched against the list as it is now, not as it was when the caller was made.
   *
   * A generation saves its screens a minute or more after it was started, from a
   * closure created before it began — and in that minute the product it is being
   * built into was written to the same meeting. Mapping over the captured array
   * would put that back the way it was and lose the product. The ref is what the
   * last write left, so two patches in one tick compose instead of racing.
   */
  const meetingsRef = useRef<MockupMeeting[]>([]);
  meetingsRef.current = meetings;

  const updateMeeting = (id: string, patch: Partial<MockupMeeting>) => {
    const updated = meetingsRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m));
    meetingsRef.current = updated;
    setMeetings(updated);
    saveMockups(projectId, updated);
  };

  /** The meeting awaiting delete confirmation, if any. */
  const [pendingDelete, setPendingDelete] = useState<MockupMeeting | null>(null);
  /**
   * What the Move-to-Product picker is open on: every meeting in the project,
   * one meeting, or nothing.
   *
   * Both are worth having. A whole Customer project describes one product and
   * usually moves as one, but the meeting you are looking at is a decision of
   * its own — its screens were just agreed, and they shouldn't have to wait
   * for every other conversation in the project to be ready.
   */
  const [moveScope, setMoveScope] = useState<'all' | string | null>(null);
  /**
   * Pointing at a control instead of finding it in a list.
   *
   * `picking` puts the preview in pick mode; `picked` is the control that was
   * clicked, waiting to be told what it opens.
   */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  /** The meeting waiting to have its screens thrown away, if any. */
  const [resetOpen, setResetOpen] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  /**
   * Every generated page in the project, as the move dialog sees it.
   *
   * A page is the unit, not a meeting: one meeting can produce a login, a
   * catalog and two popups, and each of those has its own place in the IA and
   * its own row in Drafts. A meeting with nothing generated still appears, so
   * the dialog can say why it cannot move.
   */
  const movingScreens = useMemo(
    (): MovingScreen[] =>
      meetings.flatMap((meeting): MovingScreen[] => {
        const pages = meetingScreens(meeting);
        if (pages.length === 0) {
          return [{ id: meeting.id, name: meeting.title, html: undefined, ia: meetingIA(meeting) }];
        }
        return pages.map((page) => ({
          id: page.id,
          name: page.name,
          html: page.html,
          ia: page.ia,
          group: meeting.title,
        }));
      }),
    [meetings],
  );
  /**
   * What the open dialog is about: the whole project, or just the meeting it
   * was opened from — all of that meeting's screens, not only the one on
   * screen at the time.
   */
  const dialogScreens = useMemo((): MovingScreen[] => {
    if (moveScope === null || moveScope === 'all') return movingScreens;
    const meeting = meetings.find((entry) => entry.id === moveScope);
    if (!meeting) return movingScreens;
    return meetingScreens(meeting).map((page) => ({
      id: page.id,
      name: page.name,
      html: page.html,
      ia: page.ia,
      group: meeting.title,
    }));
  }, [movingScreens, meetings, moveScope]);
  /** The selected meeting's pages, and the one being shown. */
  const pages = selected ? meetingScreens(selected) : [];
  /**
   * The product's own screens, if this meeting is building into one.
   *
   * Shown around this meeting's screens rather than instead of them: a cash
   * popup means something under the till it opens from, and a tree of four new
   * screens with nothing around them says less than the same four in place.
   */
  const ownIds = useMemo(() => new Set(pages.map((page) => page.id)), [pages]);
  /** A product screen being read — this meeting's are `activePage`. */
  const [externalId, setExternalId] = useState<string | null>(null);
  /** Screens folded shut in the tree; everything starts open. */
  const [collapsedScreens, setCollapsedScreens] = useState<Set<string>>(new Set());
  const toggleScreen = (id: string) =>
    setCollapsedScreens((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  /** What the previewed screen's own navigation can reach. */
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  /**
   * Keeps what the move dialog was told about the IA.
   *
   * The placements are answered during the move, but a set is rarely moved
   * once — a second Product project, or the same one after another round of
   * meetings, would otherwise mean typing the whole tree again. Storing the
   * answers means the next move opens on them.
   */
  /**
   * Records that this meeting's screens have been sent as they now stand.
   *
   * Stamped on every page, not only the ones that moved: the move takes the
   * whole set, so afterwards the product holds this version of all of them and
   * nothing is outstanding until something changes again.
   */
  const stampMoved = (meeting: MockupMeeting) => {
    const stamp = new Date().toISOString();
    const patched = withScreens(
      meeting,
      meetingScreens(meeting).map((page) => ({ ...page, movedAt: stamp })),
    );
    updateMeeting(meeting.id, { screens: patched.screens, htmlPreview: patched.htmlPreview });
  };

  const rememberIA = (byScreenId: Record<string, MeetingIA>) => {
    const updated = meetings.map((meeting) => {
      const current = meetingScreens(meeting);
      if (!current.some((page) => byScreenId[page.id])) return meeting;
      return withScreens(
        meeting,
        current.map((page) => (byScreenId[page.id] ? { ...page, ia: byScreenId[page.id]! } : page)),
      );
    });
    setMeetings(updated);
    saveMockups(projectId, updated);
  };

  /**
   * Saves a wired page, and lets the IA follow the link where it can.
   *
   * Links and IA are not the same shape. What a control opens is a graph — a
   * sidebar reaches every screen from every screen — while the IA is a tree,
   * one parent each, which is what makes it something you can file, place in a
   * round, and read as a path. Deriving the tree from the graph would flatten
   * a product into "everything opens from everything".
   *
   * What is safe is the case the graph and the tree agree on: a screen sitting
   * at top level because nothing claimed it, which something now opens. That
   * screen has just been told where it belongs, so it takes the parent — and
   * only then, so a placement someone decided is never overwritten by a link.
   */
  const wireLink = (
    meeting: MockupMeeting,
    pageId: string,
    updatedHtml: string,
    openedNames: string[],
  ) => {
    const current = meetingScreens(meeting);
    const key = (value: string) => value.replace(/\s+/g, '').toLowerCase();
    const parentOf = new Map(current.map((page) => [page.id, page.ia.parentId]));
    /** Following the tree up from `id` — a parent must not be its own child. */
    const ancestorOf = (id: string, maybe: string): boolean => {
      const seen = new Set<string>();
      let at: string | null | undefined = parentOf.get(id);
      while (at && !seen.has(at)) {
        if (at === maybe) return true;
        seen.add(at);
        at = parentOf.get(at);
      }
      return false;
    };

    const adopt = new Set(
      current
        .filter(
          (page) =>
            page.id !== pageId &&
            page.ia.parentId === null &&
            openedNames.some((name) => key(name) === key(page.name)) &&
            !ancestorOf(pageId, page.id),
        )
        .map((page) => page.id),
    );

    const stamp = new Date().toISOString();
    const next = current.map((page) => {
      const wrote = page.id === pageId;
      const ia = adopt.has(page.id) ? { ...page.ia, parentId: pageId } : page.ia;
      return {
        ...page,
        html: wrote ? updatedHtml : page.html,
        updatedAt: wrote ? stamp : page.updatedAt,
        ia,
      };
    });
    const patched = withScreens(meeting, next);
    updateMeeting(meeting.id, { screens: patched.screens, htmlPreview: patched.htmlPreview });

    // The preview reads the stored page, not the meeting record.
    try {
      workspaceStore.setItem(`we-adk:design-html:${pageId}`, updatedHtml);
    } catch {
      /* storage full */
    }
    window.dispatchEvent(new Event('we-adk:html-updated'));
    return adopt.size;
  };

  /** Replaces one page's html — what the page editor and the chat write. */
  const updatePageHtml = (meeting: MockupMeeting, pageId: string, html: string) => {
    const current = meetingScreens(meeting);
    const stamp = new Date().toISOString();
    const next: MockupScreen[] =
      current.length === 0
        ? [{ id: meeting.id, name: meeting.title, html, ia: meetingIA(meeting), updatedAt: stamp }]
        : current.map((page) => (page.id === pageId ? { ...page, html, updatedAt: stamp } : page));
    const patched = withScreens(meeting, next);
    updateMeeting(meeting.id, { screens: patched.screens, htmlPreview: patched.htmlPreview });
  };

  const deleteMeeting = (id: string) => {
    setPendingDelete(meetings.find((m) => m.id === id) ?? null);
  };

  const confirmDelete = () => {
    const target = pendingDelete;
    if (!target) return;
    const updated = meetings.filter((m) => m.id !== target.id);
    setMeetings(updated);
    saveMockups(projectId, updated);
    if (selectedId === target.id) setSelectedId(updated[0]?.id ?? null);
    setPendingDelete(null);
  };

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  /** Which of the two Generate answers is being asked for. */
  const [modeFor, setModeFor] = useState<MockupMeeting | null>(null);
  /**
   * A product build, as one thing.
   *
   * The dialog stays open from the product picker through to the hand-off, so
   * the meeting and the product it is being built into are held here rather
   * than being re-derived at each step. `null` when no build is running.
   */
  const [build, setBuild] = useState<{
    step: BuildStep;
    meetingId: string;
    product: { id: string; name: string } | null;
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const product = build?.product ?? selected?.product ?? null;
  const productIA = useMemo(
    () => (product ? productScreens(product.id) : []),
    // Read when the product is chosen; the walk, the IA step and the tree
    // beside the preview all use it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product?.id],
  );
  /** The product and this meeting's additions, as one tree. */
  const treeScreens = useMemo(
    () =>
      // Only once these screens are actually in that product. Before the move
      // they are a proposal, and a proposal drawn inside someone else's tree
      // reads as a fact.
      selected?.movedTo?.id && selected.movedTo.id === product?.id
        ? [
            /*
             * The product's screens, minus the ones this meeting rebuilt.
             *
             * Matched on name, because the copies have different ids: a screen
             * moved into the product and then regenerated here is one screen
             * with two records, and showing both puts the same name twice in a
             * tree whose whole job is telling screens apart. This meeting's is
             * the current one.
             */
            ...productIA.filter(
              (screen) =>
                !ownIds.has(screen.id) &&
                !pages.some(
                  (page) =>
                    page.name.replace(/\s+/g, '').toLowerCase() ===
                    screen.name.replace(/\s+/g, '').toLowerCase(),
                ),
            ),
            ...pages,
          ]
        : pages,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productIA, pages, selected?.movedTo?.id, product?.id],
  );
  const external = productIA.find((screen) => screen.id === externalId);
  /*
   * Read by the message listener, which is mounted once and must not be torn
   * down and rebuilt every time either set changes.
   */
  const ownIdsRef = useRef<Set<string>>(new Set());
  ownIdsRef.current = ownIds;
  const externalIdsRef = useRef<Set<string>>(new Set());
  externalIdsRef.current = new Set(productIA.map((screen) => screen.id));

  /**
   * What a control on the previewed screen can reach.
   *
   * Both sets, once a product is chosen: a new screen usually opens from one
   * the product already has, and a link that resolves to half the product is a
   * link that dies at the boundary between this meeting and everything it is
   * being added to.
   */
  const pageLinks: PreviewLink[] = treeScreens.map((screen) => ({
    id: screen.id,
    name: screen.name,
  }));
  const generateAbort = useRef<AbortController | null>(null);

  const stopGenerating = () => {
    generateAbort.current?.abort();
    generateAbort.current = null;
    setGeneratingId(null);
  };

  const generatePreview = async (meeting: MockupMeeting, mode: GenerateMode = 'mockup') => {
    if (generatingId) return;
    const controller = new AbortController();
    generateAbort.current = controller;
    setGeneratingId(meeting.id);
    try {
      // Drawings decide: a meeting with sketches is asking for a layout that
      // follows them, whatever type it was created as.
      const boardCards = loadArtifacts(meeting.id).filter((a) => a.dataUrl);
      const hasDrawings = boardCards.length > 0;
      const isWireframe = hasDrawings || meeting.kind === 'wireframe';

      const productContext =
        product && productIA.length > 0
          ? `\n\nThis is part of the product "${product.name}", which already has these screens:\n${productIA
              .map((screen) => `- ${screen.name}`)
              .join(
                '\n',
              )}\nBuild what the notes add to it. Do not rebuild a screen it already has, and where a new screen opens from one of them, name that screen in the "from:" field.`
          : '';
      const context = isWireframe
        ? `Wireframe: ${meeting.title}\nDate: ${meeting.date}\n\nDescription:\n${meeting.notes}${hasDrawings ? `\n\n[${boardCards.length} whiteboard drawing(s) attached as images — use them as the layout reference]` : ''}`
        : `Meeting: ${meeting.title}\nDate: ${meeting.date}\nAttendees: ${meeting.attendees}\n\nNotes:\n${meeting.notes}`;
      /*
       * The screens this meeting already has, so a second run is a revision.
       *
       * Without this the model rebuilds the set from the notes every time, and
       * a screen that nobody asked to change comes back rewritten — new
       * copy, new layout, and the review starts over. Named with their place
       * in the tree so it can also tell what is missing.
       */
      const existing = meetingScreens(meeting);
      const existingContext =
        existing.length === 0
          ? ''
          : `\n\nThis meeting has already generated these screens:\n${existing
              .map((screen) => {
                const parent = existing.find((entry) => entry.id === screen.ia.parentId);
                return `- ${screen.name} · ${screen.ia.screenType} · ${screen.ia.platform}${
                  parent ? ` · from: ${parent.name}` : ''
                }`;
              })
              .join(
                '\n',
              )}\nThis is a revision, not a fresh start. Return ONLY the screens that should change and any that are missing, each as a full PAGE block. Do not resend a screen that does not need to change — one left out is kept exactly as it is. Reuse these names exactly for the screens you do return.`;
      const fullContext = `${context}${productContext}${existingContext}`;

      /*
       * One page per screen the notes ask for, not one page for the meeting.
       * "POS System Kickoff" lists a login, a catalog, a cart and two reports
       * — five things with five places in the IA — and a single file holding
       * all of them cannot be placed, linked or handed over as five.
       */
      const multi = [
        'The notes may describe SEVERAL screens. Produce ONE page per screen, up to 8.',
        'Before each code block, write a line exactly like:',
        'PAGE: <screen name> · <Screen|Popup|Drawer> · <PC|Mobile> · from: <parent screen name, or Top>',
        'Then the ```html code block for that screen. Repeat for every screen.',
        '',
        'The "from:" field is the information architecture, and it matters as much as the pixels:',
        '- Say which screen a screen opens FROM. A login opens from nothing, so: from: Top.',
        '- A list opened by a sidebar item opens from the screen that sidebar belongs to.',
        '- A popup or drawer opens from the screen that raises it — never from Top.',
        '- Name the parent exactly as you named it in its own PAGE line, and emit parents first.',
        'Example:',
        'PAGE: Sales / Checkout · Screen · PC · from: Top',
        'PAGE: Cash Payment · Popup · PC · from: Sales / Checkout',
        'Each block must be a full standalone HTML page with all CSS inline in a <style> tag (no external CDN).',
        '',
        'CRITICAL — one screen per block:',
        '- A block renders exactly ONE screen. Never put several screens in one file.',
        '- A block contains the markup of that one screen only. No hidden containers holding the',
        '  other screens, no display:none panels waiting to be shown, no <template> copies.',
        '- No JavaScript that switches views, tabs or pages. No show/hide of screen containers.',
        '- Navigation (sidebar, tabs, menu) may be drawn for context, but it must be inert:',
        '  no click handlers, no href="#..." that reveals another screen. Mark the item for THIS',
        '  screen active — not the one that was active in the screen you copied the shell from.',
        '- Every destination in that navigation is its own PAGE block. A sidebar with 6 items',
        '  and a notes list of 6 screens means 6 blocks, not one file with 6 views inside.',
        '- Popups and drawers are their own blocks too, shown open over their parent screen.',
        '- On any control that opens another screen you are producing — a sidebar item, a card,',
        '  a row, a button — add data-screen="<that screen\'s exact PAGE name>". The navigation',
        '  stays inert; the attribute is how the screens are linked back together afterwards.',
        '',
        'The controls have to work, within the screen:',
        '- Tabs, filter chips, search, column sort, row selection, steppers, keypads and toggles',
        '  change what this screen shows. A control that does nothing reads as broken, not unfinished.',
        '- Put actions on <button>, never on <a>: the preview cancels anchor clicks, so an action',
        '  written as a link is dead on arrival. Anchors are only for opening another screen.',
        '- One small inline <script> at the end of <body>. No alert/confirm/prompt, no navigation,',
        '  no network, no form submits, no timers that never stop. Guard every lookup.',
        '- Include 10-20 rows of realistic data, so filtering and sorting visibly do something.',
        '',
        'Write nothing else — no prose before, between or after the blocks.',
      ].join('\n');
      const message = isWireframe
        ? hasDrawings
          ? `Build professional web pages that match the attached whiteboard drawing(s). The drawings show the exact layout structure, component placement, and hierarchy — follow them precisely. Use modern, polished design with proper colors, typography, and spacing while keeping the same layout structure as the drawings. Fill in realistic content based on the description.\n\n${multi}`
          : `Build precise wireframe UIs based on the description. Use a clean wireframe style: light grey backgrounds, thin borders, placeholder boxes, and clear section labels. Focus on layout structure, component placement, and information hierarchy rather than visual polish. Show realistic placeholder content based on the description.\n\n${multi}`
        : `Build complete, professional web UI mockups based on the meeting notes. Make them look like a real production app with proper layout, sidebar or top navigation, tables, forms, cards, and realistic sample data from the notes. Use modern design with clean typography and spacing.\n\n${multi}`;
      // Attach whiteboard images so Claude can see the drawings
      const attachments = boardCards.slice(0, 4).map((card, i) => ({
        name: `whiteboard-${i + 1}.png`,
        kind: 'image' as const,
        mediaType: 'image/png',
        dataBase64: card.dataUrl!.replace(/^data:image\/png;base64,/, ''),
      }));

      const response = await fetch('/api/sketcher/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        body: JSON.stringify({
          message,
          history: [],
          context: fullContext,
          folderLabel: `mockup/${meeting.title}`,
          projectName: product?.name ?? meeting.title,
          model: 'sonnet',
          ...(attachments.length > 0 ? { attachments } : {}),
        }),
      });
      if (!response.ok || !response.body) throw new Error('Generation failed');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = readChatEvent(line);
          if (evt.kind === 'delta') fullText += evt.text;
          else if (evt.kind === 'full') fullText = evt.text;
        }
      }
      const parsed = parseGeneratedPages(fullText, meeting.title);
      if (parsed.length > 0) {
        const before = meetingScreens(meeting);
        /*
         * A screen is matched by name, and what matched is revised.
         *
         * Regenerating a meeting that already has screens is a second draft,
         * not a fresh start: the placements were agreed, the links were wired,
         * and half the set may not have changed at all. So a returned screen
         * takes over the record of the screen it shares a name with — same id,
         * so its stored page, its canvas and every link pointing at it survive
         * — and a screen the reply did not mention is left exactly as it was.
         *
         * Names are matched loosely, because a reply that writes
         * "Sales / Checkout" in one line and "Sales/Checkout" in the next
         * means the same screen.
         */
        const key = (name: string) => name.replace(/\s+/g, '').toLowerCase();
        const byName = new Map(before.map((page) => [key(page.name), page]));

        // A new screen needs an id no existing one is using.
        const used = new Set(before.map((page) => page.id));
        let slot = before.length;
        const idFor = (name: string): string => {
          const kept = byName.get(key(name));
          if (kept) return kept.id;
          let id = screenIdFor(meeting.id, slot);
          while (used.has(id)) id = screenIdFor(meeting.id, (slot += 1));
          slot += 1;
          used.add(id);
          return id;
        };

        const idByName = new Map(parsed.map((page) => [key(page.name), idFor(page.name)]));
        const stamp = new Date().toISOString();
        const built = new Map<string, MockupScreen>();
        for (const page of parsed) {
          const id = idByName.get(key(page.name))!;
          const kept = byName.get(key(page.name));
          const parentId = page.parentName ? (idByName.get(key(page.parentName)) ?? null) : null;
          built.set(id, {
            id,
            name: page.name,
            html: page.html,
            updatedAt: stamp,
            movedAt: kept?.movedAt,
            // A placement already agreed is not the reply's to change.
            ia: kept?.ia ?? {
              // A screen cannot open from itself, whatever the reply said.
              parentId: parentId === id ? null : parentId,
              screenType: page.screenType,
              platform: page.platform,
            },
          });
        }

        // The order the meeting already had, then whatever is new.
        const pages: MockupScreen[] = [
          ...before.map((page) => built.get(page.id) ?? page),
          ...Array.from(built.values()).filter(
            (page) => !used.has(page.id) || !byName.has(key(page.name)),
          ),
        ].filter((page, index, all) => all.findIndex((entry) => entry.id === page.id) === index);

        const patched = withScreens(meeting, pages);
        updateMeeting(meeting.id, {
          screens: patched.screens,
          htmlPreview: patched.htmlPreview,
          // How this was built, kept with what it built: Generate stops asking.
          generateMode: mode,
        });
        setActivePageId(pages[0]!.id);
        // A product build carries on into the IA step; a mockup stops here.
        // The dialog is still open on "Build"; move it along to the IA.
        if (mode === 'product') {
          setBuild((current) =>
            current && current.meetingId === meeting.id ? { ...current, step: 'ia' } : current,
          );
        }
        // Each page is its own screen from here on: its own stored html, its
        // own canvas, its own link.
        for (const page of pages) saveHtmlAndBlocks(page.id, page.html);
        /*
         * The canvas is what the screen actually is, so it is asked for rather
         * than recovered. `saveHtmlAndBlocks` above did parse the page into
         * blocks, but that parse is a handful of DOM heuristics and most of a
         * generated page falls through it — a whole screen arrives as one
         * header. Anything this returns is therefore better than what it
         * overwrites; only an empty answer leaves the parse in place.
         *
         * Asked for the first page only: it is one model call per page, and
         * the rest keep the parse until someone opens them.
         */
        try {
          const blocks = await generateScreenBlocks(
            { title: pages[0]!.name, notes: meeting.notes },
            controller.signal,
          );
          if (blocks.length > 0) {
            workspaceStore.setItem(canvasKey(pages[0]!.id), JSON.stringify(blocks));
            window.dispatchEvent(new Event('we-adk:canvas-saved'));
          }
        } catch {
          // Canvas keeps whatever the html parse produced.
        }
      }
    } catch {
      /* generation failed silently */
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden bg-background">
      {/* Left: the source list — meetings, feedback and suggestions alike */}
      <div className="flex w-60 shrink-0 flex-col border-r bg-[#fafafa] dark:bg-[#0d1017]">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Sources
          </span>
          <button
            type="button"
            onClick={openCreateDialog}
            className="text-muted-foreground hover:text-foreground hover:bg-background rounded p-1 transition-colors"
            title="New source"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {meetings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-3 py-16 text-center">
              <MessageSquare className="text-muted-foreground/30 size-10" />
              <div>
                <p className="text-sm font-medium">No sources</p>
                <p className="text-muted-foreground mt-1 text-xs">Create one to get started</p>
              </div>
              <Button size="sm" className="mt-1 gap-1.5 text-xs" onClick={openCreateDialog}>
                <Plus className="size-3" /> New Source
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {meetings.map((meeting) => {
                const active = selectedId === meeting.id;
                return (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={() => setSelectedId(meeting.id)}
                    className={cn(
                      'group flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'bg-background shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
                        : 'hover:bg-background/60',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13px]',
                          active ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {meeting.title}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMeeting(meeting.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            deleteMeeting(meeting.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                        title="Delete source"
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                    </span>
                    <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
                      <CalendarDays className="size-3" />
                      {formatDate(meeting.date)}
                      {/* Entries saved before this existed read as meetings,
                          which is what every one of them was. */}
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          SOURCE_STYLE[taskSource(meeting.source)],
                        )}
                      >
                        {TASK_SOURCES.find((s) => s.id === taskSource(meeting.source))?.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Center: Meeting detail */}
      {selected ? (
        <>
          <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
            {/* Content */}
            <div className="bg-background min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl px-6 pb-40">
                {/* Hero */}
                <div className="pt-6 flex items-start justify-between gap-4">
                  <div>
                    {/* The name and what kind of thing it is, on one line —
                        the chip classifies the title, so it belongs beside it
                        rather than in a row of its own.

                        Everything else is one quiet line underneath. Four
                        icon-and-label pairs read as four controls; separated
                        by middots they read as what they are, a caption. */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="text-xl font-bold tracking-tight">{selected.title}</h2>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          SOURCE_STYLE[taskSource(selected.source)],
                        )}
                      >
                        {
                          TASK_SOURCES.find((entry) => entry.id === taskSource(selected.source))
                            ?.label
                        }
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
                      {meetingAuthor(selected) && (
                        <>
                          <span className="truncate" title={`Posted by ${meetingAuthor(selected)}`}>
                            {meetingAuthor(selected)}
                          </span>
                          <span aria-hidden className="opacity-40">
                            ·
                          </span>
                        </>
                      )}
                      <span>{formatDate(selected.date)}</span>
                      {pages.length > 0 && (
                        <>
                          <span aria-hidden className="opacity-40">
                            ·
                          </span>
                          <span>
                            {pages.length} screen{pages.length === 1 ? '' : 's'}
                          </span>
                        </>
                      )}
                      {/* Which product these screens are for. Chosen during a
                          build and easy to lose track of afterwards — and it
                          is the frame for everything else on this page. */}
                      {product && (
                        <>
                          <span aria-hidden className="opacity-40">
                            ·
                          </span>
                          <span
                            className="flex min-w-0 items-center gap-1"
                            title={
                              selected.movedTo?.id === product.id
                                ? `Sent to ${product.name}`
                                : `Building into ${product.name}`
                            }
                          >
                            <PackageOpen className="size-3 shrink-0" />
                            <span className="truncate">{product.name}</span>
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2 text-xs"
                      disabled={generatingId === selected.id}
                      onClick={() => {
                        /*
                         * Asked once per source.
                         *
                         * The first Generate asks "mockup or product?". The
                         * answer is written on the meeting with the screens it
                         * produced, and from then on Generate just runs — a
                         * revision of those screens, into the same product if
                         * one was chosen. Asking again would be a click with
                         * only one outcome. Reset clears the answer along with
                         * the screens, and the question comes back.
                         */
                        const remembered =
                          selected.generateMode ??
                          // Screens from before the answer was recorded: a
                          // product on the meeting means it was a product build.
                          (pages.length > 0 ? (product ? 'product' : 'mockup') : undefined);
                        if (remembered === 'product' && product) {
                          setBuild({
                            step: 'generating',
                            meetingId: selected.id,
                            product,
                          });
                          void generatePreview(selected, 'product');
                          return;
                        }
                        if (remembered === 'mockup') {
                          void generatePreview(selected, 'mockup');
                          return;
                        }
                        setModeFor(selected);
                      }}
                    >
                      {generatingId === selected.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Sparkles className="size-3" />
                      )}
                      {generatingId === selected.id ? 'Generating...' : 'Generate'}
                    </Button>
                    {/* Only once there is something to throw away, and never
                        mid-run: stopping is what the button beside it is for. */}
                    {pages.length > 0 && generatingId !== selected.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => setResetOpen(true)}
                        title="Throw away the screens generated from these notes"
                      >
                        <RotateCcw className="size-3" />
                        Reset
                      </Button>
                    )}
                    {/* Generate is disabled while it runs, so without this a
                        long build could only be escaped by leaving the page. */}
                    {generatingId === selected.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 border-red-200 p-0 text-red-600 hover:bg-red-50"
                        onClick={stopGenerating}
                        title="Stop generating"
                        aria-label="Stop generating"
                      >
                        <CircleStop className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Source notes */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Pencil className="size-4" />
                      Notes
                    </h3>
                    {editingNotes ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingNotes(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            updateMeeting(selected.id, { notes: editNotesText });
                            setEditingNotes(false);
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {/*
                          Improve, next to Edit, because they are the two ways to change the
                          same text — one by hand and one by asking. Disabled on empty notes:
                          there is nothing to improve, and asking anyway spends a call to be
                          told so.
                        */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
                          disabled={!selected.notes.trim()}
                          title={
                            selected.notes.trim()
                              ? 'Ask Claude to tidy and fill gaps in these notes'
                              : 'Write some notes first'
                          }
                          onClick={() => {
                            setChatCollapsed(false);
                            setAiPrompt(
                              [
                                'Improve these meeting notes.',
                                '',
                                'Keep every decision and detail that is already there — this is the',
                                'record of what the customer said, so nothing may be invented or',
                                'dropped. Tidy the structure, make the wording consistent, and group',
                                'what belongs together. Where something is clearly missing or',
                                'ambiguous, say so as an open question rather than answering it',
                                'yourself.',
                                '',
                                'Explain what you changed, then give the full updated notes in a',
                                'notes block so I can apply them.',
                              ].join('\n'),
                            );
                          }}
                        >
                          <Sparkles className="size-3.5" />
                          Improve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
                          onClick={() => {
                            setEditNotesText(selected.notes);
                            setEditingNotes(true);
                          }}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingNotes ? (
                    <textarea
                      value={editNotesText}
                      onChange={(e) => setEditNotesText(e.target.value)}
                      className="bg-background mt-3 w-full rounded-md border px-3 py-2 text-sm leading-[1.8] outline-none focus:ring-2 focus:ring-primary/30"
                      rows={Math.max(8, editNotesText.split('\n').length + 2)}
                    />
                  ) : (
                    <div className="mt-3 text-sm leading-[1.8] whitespace-pre-wrap">
                      {selected.notes || (
                        <span className="text-muted-foreground italic">No notes captured.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Whiteboard */}
                {
                  <WhiteboardPanel
                    sessionId={selected.id}
                    project={findProject(projectId)!}
                    uploadedBy="User"
                    whiteboardOnly
                    className="mt-6"
                  />
                }
              </div>
            </div>
          </div>

          {/* Right: HTML preview */}
          <div
            className="relative flex shrink-0 flex-col overflow-hidden border-l bg-[#fafafa] dark:bg-[#0d1017]"
            style={{ width: previewWidth || '50%' }}
          >
            {/* Drag handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize preview panel"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                const el = e.currentTarget.parentElement;
                previewDrag.current = { x: e.clientX, w: el ? el.offsetWidth : previewWidth };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!previewDrag.current) return;
                const total = containerRef.current ? containerRef.current.offsetWidth : 1200;
                const next = Math.min(
                  total * 0.8,
                  Math.max(200, previewDrag.current.w - (e.clientX - previewDrag.current.x)),
                );
                setPreviewWidth(next);
              }}
              onPointerUp={(e) => {
                previewDrag.current = null;
                e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              className="hover:bg-primary/30 absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize transition-colors"
            />
            <div className="flex items-center gap-2 border-b px-4 py-2">
              {/* Segment toggle */}
              <div className="flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setPreviewMode('preview')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    previewMode === 'preview'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <FileCode2 className="size-3" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('page')}
                  disabled={!activePage}
                  title={
                    activePage ? 'Edit the generated page directly' : 'Generate the screens first'
                  }
                  className={cn(
                    'flex items-center gap-1.5 border-l px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                    previewMode === 'page'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <MousePointerClick className="size-3" />
                  Page
                </button>
              </div>
              {previewMode === 'preview' && activePage && (
                /*
                 * Three actions, in the order they are reached for: look at
                 * the screen, wire it, hand it over. They had three different
                 * weights — a bare blue icon, a grey outline, another outline
                 * — for three things of the same rank, so they now share one
                 * shape, with a rule before the only one that leaves here.
                 */
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const tab = window.open('', '_blank');
                      if (tab) {
                        tab.document.write(activePage.html);
                        tab.document.close();
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-7 items-center justify-center rounded-md transition-colors"
                    title="Open in browser"
                    aria-label="Open in browser"
                  >
                    <ExternalLink className="size-3.5" />
                  </button>

                  {/* What this screen's controls open. Only worth offering
                      when there is something else to open. */}
                  {pages.length > 1 && (
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
                      <MousePointerClick className="size-3.5" />
                      {picking ? 'Picking…' : 'Link'}
                    </button>
                  )}

                  <span aria-hidden className="bg-border mx-1 h-4 w-px" />

                  <button
                    type="button"
                    onClick={() => setMoveScope(selected.id)}
                    className="hover:bg-muted flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors"
                    title={`Move copies of this meeting's ${pages.length} screen${pages.length === 1 ? '' : 's'} into a Product project`}
                  >
                    <PackageOpen className="size-3.5" />
                    Move to Product
                  </button>
                </div>
              )}
            </div>

            {/* The screens this meeting produced, as the tree they are.

                They were a strip of numbered tabs, which says how many there
                are and nothing about how they relate — and by the fourth
                screen the names are elided anyway. Nested by what opens what,
                the same shape the Request tab uses, the strip becomes the
                thing it was always describing: the product's structure. */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {treeScreens.length > 1 && (
                <div className="bg-background flex w-52 shrink-0 flex-col overflow-hidden border-r">
                  {/* Whose structure this is, by name: the product once these
                      screens have joined it, the meeting until then. Named
                      rather than described — "This meeting" said nothing you
                      could not already see, and hid which product was coming. */}
                  <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 px-3 py-2 text-[11px] font-medium">
                    <Layers className="size-3.5 shrink-0 text-violet-500" />
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={
                        !product
                          ? selected.title
                          : selected.movedTo?.id === product.id
                            ? `${product.name} — with this meeting's screens in it`
                            : `${product.name} — this meeting's screens are not in it yet`
                      }
                    >
                      {/* The product these screens are for, once one is
                          chosen — the meeting's own name only when none is.
                          What the tree holds still waits for the move; what it
                          is called does not. */}
                      {product?.name ?? selected.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px]">{treeScreens.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
                    {(() => {
                      const renderNode = (node: FlowNode): ReactNode => {
                        const own = ownIds.has(node.screen.id);
                        const hasChildren = node.children.length > 0;
                        const folded = collapsedScreens.has(node.screen.id);
                        const active = own
                          ? activePage?.id === node.screen.id && externalId === null
                          : externalId === node.screen.id;
                        return (
                          <div key={node.screen.id}>
                            <div
                              className={cn(
                                'flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-xs',
                                active
                                  ? 'border-primary bg-muted text-foreground'
                                  : 'border-transparent text-muted-foreground hover:bg-muted/50',
                              )}
                            >
                              {/* A screen that opens others is a section as well
                                as a screen, so it folds like one — and a leaf
                                keeps the slot so no filename shifts. */}
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleScreen(node.screen.id)}
                                  aria-label={`${folded ? 'Expand' : 'Collapse'} ${node.screen.name}`}
                                  aria-expanded={!folded}
                                  className="hover:text-foreground shrink-0"
                                >
                                  {folded ? (
                                    <ChevronRight className="size-3.5" />
                                  ) : (
                                    <ChevronDown className="size-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span aria-hidden className="w-3.5 shrink-0" />
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (own) {
                                    setActivePageId(node.screen.id);
                                    setExternalId(null);
                                  } else {
                                    setExternalId(node.screen.id);
                                  }
                                }}
                                title={node.screen.name}
                                className={cn(
                                  'flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left',
                                  active && 'font-medium',
                                )}
                              >
                                {/* A screen that opens others is a section too,
                                  and Main draws a section as a folder — so it
                                  does here, and a leaf keeps the </> that says
                                  it is a page. */}
                                {hasChildren ? (
                                  folded ? (
                                    <Folder
                                      className={cn('size-3.5 shrink-0', !own && 'opacity-50')}
                                    />
                                  ) : (
                                    <FolderOpen
                                      className={cn('size-3.5 shrink-0', !own && 'opacity-50')}
                                    />
                                  )
                                ) : (
                                  <Code2
                                    className={cn('size-3.5 shrink-0', !own && 'opacity-50')}
                                  />
                                )}
                                <span
                                  className={cn('min-w-0 flex-1 truncate', !own && 'opacity-60')}
                                >
                                  {node.screen.name}
                                </span>
                                {/* Already in the product — context, not work. */}
                                {!own && (
                                  <span
                                    title={`Already in ${product?.name ?? 'the product'}`}
                                    className="text-muted-foreground shrink-0 font-mono text-[9px]"
                                  >
                                    ·
                                  </span>
                                )}
                                {/* N for new, M for modified: never sent to the
                                  product, or changed since it was. Nothing at
                                  all once the two agree. */}
                                {own &&
                                  (() => {
                                    const change = screenChange(node.screen);
                                    if (!change) return null;
                                    const isNew = change === 'added';
                                    const label = isNew
                                      ? 'New — not in the product yet'
                                      : 'Modified since it was sent';
                                    return (
                                      <span
                                        title={label}
                                        aria-label={label}
                                        className={cn(
                                          'shrink-0 font-mono text-[10px] font-semibold',
                                          isNew
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-amber-600 dark:text-amber-400',
                                        )}
                                      >
                                        {isNew ? 'N' : 'M'}
                                      </span>
                                    );
                                  })()}
                                {/* The letter marker Main uses for a popup. */}
                                {node.screen.ia.screenType !== 'Screen' && (
                                  <span
                                    title={node.screen.ia.screenType}
                                    className="w-3 shrink-0 text-center font-mono text-[10px] font-semibold text-violet-600 dark:text-violet-400"
                                  >
                                    {node.screen.ia.screenType.slice(0, 1)}
                                  </span>
                                )}
                              </button>
                            </div>
                            {hasChildren && !folded && (
                              <div className="ml-4 border-l">{node.children.map(renderNode)}</div>
                            )}
                          </div>
                        );
                      };
                      return buildFlow(treeScreens).map(renderNode);
                    })()}
                  </div>
                </div>
              )}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {previewMode === 'page' && activePage && !external ? (
                  <PageEditor
                    key={activePage.id}
                    html={activePage.html}
                    screenTitle={activePage.name}
                    onSave={(updatedHtml) => {
                      updatePageHtml(selected, activePage.id, updatedHtml);
                      /*
                       * The page only. `saveHtmlAndBlocks` would also write the
                       * html parse over the canvas, replacing the generated
                       * blocks — the ones that make the copy editable once it
                       * moves to Product — with the single header that parse
                       * recovers.
                       */
                      try {
                        workspaceStore.setItem(`we-adk:design-html:${activePage.id}`, updatedHtml);
                      } catch {
                        /* storage full */
                      }
                      window.dispatchEvent(new Event('we-adk:html-updated'));
                    }}
                  />
                ) : (
                  <MeetingScreenPreview
                    key={external?.id ?? activePage?.id ?? selected.id}
                    html={external?.html ?? activePage?.html}
                    links={pageLinks}
                    currentId={external?.id ?? activePage?.id}
                    // A screen the product already has is read here, not
                    // wired: its links belong to the round it lives in.
                    pick={picking && !external}
                  />
                )}
              </div>
            </div>
          </div>

          {/*
            The AI chat, beside the preview it talks about.

            It used to float over the notes column, centred at the bottom. That put it in
            front of the thing it was for — the screen on the right — and left it covering
            the notes, which are the other half of the conversation. As a column it covers
            nothing, and asking for a change to the screen now happens next to the screen.

            Collapsible, and the same 26rem aside the preview page, the whiteboard and the
            entity canvas all use, so the chat is in the same place wherever it appears.
          */}
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
            <aside className="bg-background flex w-[26rem] shrink-0 flex-col overflow-hidden border-l">
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
                project={findProject(projectId)!}
                /*
                 * The notes, and the screen on view.
                 *
                 * The chat has no filesystem and no tools: what it can see is
                 * this string. Without the page in it, "fix the close button"
                 * had nothing to fix, so the model asked for a file path — for
                 * a page that has never been a file.
                 */
                contextText={[
                  `Meeting: ${selected.title}`,
                  `Date: ${selected.date}`,
                  `Attendees: ${selected.attendees}`,
                  '',
                  'Notes:',
                  selected.notes,
                  ...(activePage
                    ? [
                        '',
                        `CURRENT SCREEN: ${activePage.name}` +
                          (pages.length > 1
                            ? ` (${pages.findIndex((page) => page.id === activePage.id) + 1} of ${pages.length})`
                            : ''),
                        'This is the whole of it. Return a complete ```html block to replace it.',
                        '```html',
                        activePage.html,
                        '```',
                      ]
                    : []),
                ].join('\n')}
                folderLabel={`mockup/${selected.title}`}
                greeting=""
                greetingHint=""
                initialTurns={chatTurns}
                onPersist={(turns) => {
                  if (selected) saveChatTurns(projectId, selected.id, turns);
                }}
                onResponse={(responseText) => {
                  const htmlMatch = responseText.match(/```html\s*\n([\s\S]*?)```/);
                  const chatHtml =
                    htmlMatch?.[1]?.trim() ??
                    (/^\s*<!DOCTYPE\s+html/i.test(responseText) ||
                    /^\s*<html[\s>]/i.test(responseText)
                      ? responseText.trim()
                      : null);
                  if (chatHtml) {
                    const pageId = activePage?.id ?? selected.id;
                    updatePageHtml(selected, pageId, chatHtml);
                    saveHtmlAndBlocks(pageId, chatHtml);
                  }
                }}
                pendingPrompt={aiPrompt}
                onPromptHandled={() => setAiPrompt(null)}
                onApplyNotes={(notes) => updateMeeting(selected.id, { notes })}
              />
            </aside>
          )}
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-center">
          <MessageSquare className="text-muted-foreground/20 size-12" />
          <p className="text-sm font-medium">Select a source</p>
          <p className="text-muted-foreground text-xs">
            Pick one from the list or create a new one.
          </p>
        </div>
      )}

      {/* The control just clicked on the screen, and what it should open. */}
      {selected &&
        activePage &&
        picked !== null &&
        (() => {
          const control = listPageControls(activePage.html).find((entry) => entry.index === picked);
          const save = (name: string) => {
            const updated = setPageControlTargets(activePage.html, { [picked]: name });
            const adopted = wireLink(selected, activePage.id, updated, name ? [name] : []);
            if (adopted > 0) setMoved(`${name} now opens from ${activePage.name}`);
            setPicked(null);
          };
          return (
            <Dialog
              open
              onOpenChange={(next) => {
                if (!next) setPicked(null);
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Link2 className="size-4" />
                    What does this open?
                  </DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground truncate text-xs" title={control?.label}>
                  {control?.label ?? 'That control'}
                  {control?.tag ? ` · ${control.tag}` : ''}
                </p>
                <div className="flex flex-col gap-1">
                  {pages
                    .filter((page) => page.id !== activePage.id)
                    .map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => save(page.name)}
                        className={cn(
                          'hover:border-primary hover:bg-primary/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          control?.opens === page.name && 'border-primary bg-primary/5 font-medium',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{page.name}</span>
                        {page.ia.screenType !== 'Screen' && (
                          <span className="text-muted-foreground shrink-0 text-[10px]">
                            {page.ia.screenType}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => save('')}>
                    Opens nothing
                  </Button>
                  <span className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

      {/* What to build. The product answer opens the build dialog, which then
          holds every step of it. */}
      <GenerateModeDialog
        open={modeFor !== null}
        onClose={() => setModeFor(null)}
        onPick={(mode) => {
          const meeting = modeFor;
          setModeFor(null);
          if (!meeting) return;
          // A product build asks which product before it builds anything; a
          // mockup has nothing to belong to, so it starts straight away.
          if (mode === 'product') {
            setBuild({ step: 'product', meetingId: meeting.id, product: null });
            return;
          }
          void generatePreview(meeting, mode);
        }}
      />

      {(() => {
        const meeting = meetings.find((entry) => entry.id === build?.meetingId);
        const pages = meeting ? meetingScreens(meeting) : [];
        return (
          <ProductBuildDialog
            open={build !== null && meeting !== undefined}
            step={build?.step ?? 'product'}
            meetingTitle={meeting?.title ?? ''}
            product={product}
            screens={pages}
            existing={productIA}
            moving={moving}
            onBack={() => {
              /*
               * One step back, and back from the first is the question that
               * started it. Going back from the IA re-opens the product
               * picker, which means picking again rebuilds — the screens were
               * built against a product, so changing it changes them.
               */
              if (build?.step === 'generating') stopGenerating();
              if (!build || build.step === 'product') {
                setBuild(null);
                if (meeting) setModeFor(meeting);
                return;
              }
              setBuild({
                ...build,
                step: build.step === 'walk' ? 'ia' : 'product',
              });
            }}
            onClose={() => {
              // Leaving mid-build stops the generation with it; a run nobody is
              // watching finishes into a dialog that is gone.
              if (build?.step === 'generating') stopGenerating();
              setBuild(null);
            }}
            onPickProduct={(picked) => {
              if (!meeting) return;
              const chosen = { id: picked.id, name: picked.name };
              // Remembered on the meeting: the build ends, the answer doesn't.
              updateMeeting(meeting.id, { product: chosen });
              setBuild({ step: 'generating', meetingId: meeting.id, product: chosen });
              void generatePreview(meeting, 'product');
            }}
            onConfirmIA={(ia) => {
              if (meeting) {
                const patched = withScreens(
                  meeting,
                  pages.map((page) => (ia[page.id] ? { ...page, ia: ia[page.id]! } : page)),
                );
                updateMeeting(meeting.id, {
                  screens: patched.screens,
                  htmlPreview: patched.htmlPreview,
                });
              }
              setBuild((current) => (current ? { ...current, step: 'walk' } : current));
            }}
            onMoveToRequest={() => {
              if (!meeting || !product) return;
              setMoving(true);
              try {
                /*
                 * The same hand-off Move to Product makes, from the end of a
                 * build: each screen copied under its own id, with the canvas
                 * that travels with it, carrying the placement the flow was
                 * just walked with.
                 */
                const all = [...productIA, ...meetingScreens(meeting)];
                const stamp = Date.now().toString(36);
                const createdAt = new Date().toISOString();
                meetingScreens(meeting).forEach((page, index) => {
                  const screenId = `cust-${stamp}-${index.toString(36)}-${Math.random()
                    .toString(36)
                    .slice(2, 7)}`;
                  saveHtmlAndBlocks(screenId, page.html);
                  const blocks = loadScreenBlocks(page.id, '');
                  if (blocks.length > 0) {
                    try {
                      workspaceStore.setItem(canvasKey(screenId), JSON.stringify(blocks));
                    } catch {
                      /* storage full — the copy keeps the parsed blocks */
                    }
                  }
                  addStandaloneDraft(product.id, {
                    screenId,
                    name: page.name,
                    createdAt,
                    fromLabel: `From ${findProject(projectId)?.name ?? 'a customer project'}`,
                    placement: placementFor(page, all),
                  });
                });
                const count = meetingScreens(meeting).length;
                stampMoved(meeting);
                updateMeeting(meeting.id, { movedTo: { id: product.id, name: product.name } });
                setMoved(`${count} screen${count === 1 ? '' : 's'} into ${product.name} · Request`);
                setBuild(null);
              } finally {
                setMoving(false);
              }
            }}
          />
        );
      })()}

      {/* Move to Product — every screen in the project, each with its IA. */}
      <MoveToProductDialog
        open={moveScope !== null}
        screens={dialogScreens}
        // The product these screens were generated into, so the move opens on
        // it instead of asking a question the build already answered.
        preferredProductId={product?.id}
        sourceProjectName={findProject(projectId)?.name ?? 'a customer project'}
        onClose={() => setMoveScope(null)}
        onPlacements={rememberIA}
        onMoved={(projectName, where, count, projectId) => {
          // Recorded on the meeting: from here its screens have a place in
          // that product, and the tree can show them in it.
          if (selected) {
            stampMoved(selected);
            updateMeeting(selected.id, { movedTo: { id: projectId, name: projectName } });
          }
          setMoved(`${count} screen${count === 1 ? '' : 's'} into ${projectName} · ${where}`);
        }}
      />

      {moved && (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-xs shadow-lg">
          Copied {moved}
          <button
            type="button"
            onClick={() => setMoved(null)}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Reset: the screens go, the notes stay. Asked rather than done,
          because a generation is minutes of waiting and there is no undo. */}
      <Dialog
        open={resetOpen}
        onOpenChange={(next) => {
          if (!next) setResetOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Reset screens</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The {pages.length} screen{pages.length === 1 ? '' : 's'} generated from{' '}
            <span className="text-foreground font-medium">{selected?.title}</span> will be removed,
            along with the links and placements set on them. The notes stay, and so does anything
            already moved into a product — those copies are the product&rsquo;s now. The next
            Generate asks again how to build.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (!selected) return;
                // The pages themselves, then the record that they existed.
                for (const page of meetingScreens(selected)) {
                  try {
                    workspaceStore.removeItem(`we-adk:design-html:${page.id}`);
                  } catch {
                    /* nothing to remove */
                  }
                }
                updateMeeting(selected.id, {
                  screens: [],
                  htmlPreview: undefined,
                  // Nothing of this meeting is outstanding any more, because
                  // nothing of this meeting is left.
                  movedTo: undefined,
                  // And the question is open again: how to build, and into
                  // what. The next Generate asks.
                  generateMode: undefined,
                  product: undefined,
                });
                setActivePageId(null);
                setExternalId(null);
                setPicking(false);
                setPicked(null);
                setResetOpen(false);
                window.dispatchEvent(new Event('we-adk:html-updated'));
              }}
            >
              Reset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation. Names the task, because "this meeting" told you
          nothing about which one was about to go. */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Delete source</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{pendingDelete?.title}</span> and its
            notes will be removed. This cannot be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="bg-muted/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-lg">New Source</DialogTitle>
              <p className="text-muted-foreground text-xs mt-1">
                Capture a meeting, feedback or a suggestion, and generate mockups from its notes.
              </p>
            </DialogHeader>
          </div>
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Title
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Kickoff call, Sprint review"
                  className="h-9 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmCreate();
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-9 w-[160px] text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-wider uppercase">
                Source
              </label>
              <div className="flex gap-2">
                {TASK_SOURCES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewSource(opt.id)}
                    className={cn(
                      'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                      newSource === opt.id
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-input text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Paste or type discussion points, decisions, and action items..."
                rows={7}
                className="border-input bg-background w-full rounded-lg border px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-4">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmCreate}>
              Create Meeting
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
