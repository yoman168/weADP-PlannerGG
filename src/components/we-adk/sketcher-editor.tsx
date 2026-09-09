'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  MonitorPlay,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  MessageSquare,
  Redo2,
  RotateCcw,
  ClipboardList,
  Sparkles,
  Trash2,
  X,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@/components/ui';
import { AssistantMarkdown, readChatEvent } from '@/components/we-adk/claude-chat';
import { DesignHtmlButton } from '@/components/we-adk/design-html-button';
import {
  businessEditHref,
  businessPreviewHref,
  previewHref,
} from '@/components/we-adk/mockup-board';
import { DeviceSwitcher, PreviewEditTabs } from '@/components/we-adk/screen-preview';
import { DesignChromeFrame, hasAppChrome, loadSidebarOverrides, saveSidebarOverrides, type SidebarOverrides } from '@/components/we-adk/live-screen-preview';
import { useOptionalBusinessWorkspace } from '@/components/we-adk/business-workspace';
import { useLocale } from '@/lib/locale';
import { BlockPreview } from '@/components/we-adk/sketcher/block-preview';
import { ScreenShell, splitShell } from '@/components/we-adk/sketcher/screen-shell';
import { LAYER_DRAG_PREFIX, LayersPanel } from '@/components/we-adk/sketcher/layers-panel';
import { PALETTE_DRAG_PREFIX, Palette } from '@/components/we-adk/sketcher/palette';
import { PropertyInspector } from '@/components/we-adk/sketcher/property-inspector';
import { useCanvas } from '@/components/we-adk/sketcher/use-canvas';
import {
  AI_MESSAGE_SEED,
  BLOCK_CATALOG,
  CANVAS_STORAGE_KEY,
  DEVICE_PRESETS,
  PATTERN_CATALOG,
  createPatternBlocks,
  type BlockKind,
  type CanvasBlock,
  type ChatEntry,
  type DevicePresetId,
} from '@/lib/we-adk-mock/sketcher';
import { claudeHeaders } from '@/lib/we-adk/claude-account';
import { isHtmlDesignFile } from '@/lib/we-adk/design-html';
import { aiResponseSchema, describeCanvas } from '@/lib/we-adk/sketcher-operations';
import { pushCanvasToScreen } from '@/lib/we-adk/design-sync';
import { findPrototypeByRoute, findPrototypeFile, prototypeConfigKeyForScreen } from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { resolveScreen } from '@/lib/we-adk/screen-registry';
import { EACC_NAV } from '@/lib/eacc/nav';

const CANVAS_DROP_ID = 'sketcher-canvas';

/* ------------------------------------------------------------------ */
/* Sidebar property inspector                                          */
/* ------------------------------------------------------------------ */

function SidebarInspector({
  overrides,
  onChange,
  onDeselect,
}: {
  overrides: SidebarOverrides;
  onChange: (next: SidebarOverrides) => void;
  onDeselect: () => void;
}) {
  const allItems = EACC_NAV.flatMap((g) => g.items);

  const update = (href: string, patch: { label?: string; visible?: boolean }) => {
    onChange({ ...overrides, [href]: { ...overrides[href], ...patch } });
  };

  const toggleVisibility = (href: string) => {
    const current = overrides[href]?.visible !== false;
    update(href, { visible: !current });
  };

  return (
    <aside className="bg-background flex w-72 shrink-0 flex-col border-l">
      <div className="mx-2 mt-3 mb-1">
        <p className="text-sm font-medium">Properties</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">Sidebar</Badge>
            <button
              type="button"
              aria-label="Deselect"
              onClick={onDeselect}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Layer name</span>
            <Input value="Sidebar" readOnly className="h-8" />
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-4">
            <span className="text-muted-foreground text-xs">Navigation</span>
            {allItems.map((item, index) => {
              const ov = overrides[item.href];
              const visible = ov?.visible !== false;
              return (
                <div key={item.href} className={cn('flex items-center gap-1', !visible && 'opacity-40')}>
                  <Input
                    value={ov?.label ?? item.label}
                    onChange={(e) => update(item.href, { label: e.target.value })}
                    className="h-7 text-xs"
                  />
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === allItems.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={visible ? 'Hide' : 'Show'}
                      onClick={() => toggleVisibility(item.href)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The two ways to work on a screen, in tab order. Preview is the default. */
const VIEW_MODES = [
  { id: 'preview', label: 'Preview', preview: true },
  { id: 'edit', label: 'Edit', preview: false },
] as const;

/** Lowercase label → kind, so the AI chat can resolve "add a checkbox". */
const KIND_BY_LABEL = new Map<string, BlockKind>(
  Object.values(BLOCK_CATALOG).map((definition) => [
    definition.label.toLowerCase(),
    definition.kind,
  ]),
);
const KIND_ALIASES: Record<string, BlockKind> = {
  input: 'input',
  textbox: 'input',
  dropdown: 'select',
  combobox: 'select',
  toggle: 'switch',
  tabs: 'statusTabs',
  grid: 'table',
  list: 'table',
  header: 'screenHeader',
  title: 'heading',
  text: 'paragraph',
  stats: 'statCards',
  cards: 'statCards',
  progress: 'progressSummary',
  badges: 'badgeRow',
  radio: 'radioGroup',
  buttons: 'buttonBar',
  button: 'buttonBar',
  date: 'datePicker',
  daterange: 'dateRange',
  divider: 'divider',
  spacer: 'spacer',
};

function resolveKind(text: string): BlockKind | null {
  const haystack = text.toLowerCase();
  for (const [label, kind] of KIND_BY_LABEL) {
    if (haystack.includes(label)) return kind;
  }
  for (const [alias, kind] of Object.entries(KIND_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(haystack)) return kind;
  }
  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
  );
}

/* ------------------------------------------------------------------ */
/* Canvas block wrapper                                                */
/* ------------------------------------------------------------------ */

function CanvasBlockShell({
  block,
  selected,
  preview,
  onSelect,
  onDuplicate,
  onDelete,
  onToggleHidden,
}: {
  block: CanvasBlock;
  selected: boolean;
  preview: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: preview,
  });

  if (preview) {
    if (block.hidden) return null;
    return (
      <div className="px-1 py-1">
        <BlockPreview block={block} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      // Keyboard users can tab to a block and select it with Enter/Space.
      tabIndex={0}
      aria-label={`${block.name} block${selected ? ', selected' : ''}`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'group relative rounded-lg border-2 px-3 py-2.5 transition-colors',
        selected ? 'border-primary/70 bg-primary/[0.03]' : 'border-transparent hover:border-border',
        isDragging && 'opacity-40',
        block.hidden && 'opacity-40',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${block.name}`}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'bg-background text-muted-foreground hover:text-foreground absolute -left-3 top-1/2 flex size-6 -translate-y-1/2 cursor-grab items-center justify-center rounded border opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100',
          selected && 'opacity-100',
        )}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Hover toolbar */}
      <div
        className={cn(
          'bg-background absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
          selected && 'opacity-100',
        )}
      >
        <span className="text-muted-foreground px-1 text-[10px]">{block.name}</span>
        <button
          type="button"
          aria-label={t('misc.toggleVisibility')}
          onClick={(event) => {
            event.stopPropagation();
            onToggleHidden();
          }}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          {block.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </button>
        <button
          type="button"
          aria-label={t('misc.duplicateBlock')}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          <Copy className="size-3" />
        </button>
        <button
          type="button"
          aria-label={t('misc.deleteBlock')}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="text-muted-foreground hover:text-destructive p-0.5"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {/* Preview content is click-through so the block itself takes selection. */}
      <div className="pointer-events-none">
        <BlockPreview block={block} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * The shared canvas editor. It reads `?screen=` itself, so it works both as a
 * full-screen route and as the right-hand pane of a workspace that keeps its
 * own sidebars mounted — pass `embedded` for the latter.
 */
export function SketcherEditor({
  embedded = false,
  overrideScreenId,
  overrideProjectId,
  overrideFolderId,
  onSwitchToPreview,
}: {
  embedded?: boolean;
  /** When provided, bypass URL params for the screen id. */
  overrideScreenId?: string;
  /** When provided, bypass URL params for the project id. */
  overrideProjectId?: string;
  /** When provided, bypass URL params for the folder id. */
  overrideFolderId?: string;
  /** When provided, the Preview tab calls this instead of navigating. */
  onSwitchToPreview?: () => void;
}) {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const screenId = overrideScreenId ?? searchParams.get('screen');
  // Which project the editor was opened from, so the breadcrumb can go back there.
  // Inside the Business workspace the project is in the path, not the query.
  const routeParams = useParams<{ projectId?: string }>();
  const projectId =
    overrideProjectId ?? searchParams.get('project') ?? routeParams.projectId ?? null;
  const folderId = overrideFolderId ?? searchParams.get('folder');
  // Inside the workspace, Preview and Edit are two routes, so the editor's own
  // block-level toggle would be a second control saying almost the same thing.
  // Every design file gets that pair — a wireframe drawn in a round is opened,
  // labelled and switched exactly the way an html file of the prototype is.
  const prototype = screenId ? findPrototypeFile(screenId) : null;
  const navTabs = Boolean(embedded && projectId && screenId);
  const workspace = useOptionalBusinessWorkspace();
  /**
   * Frozen when the round this screen belongs to is released.
   *
   * `workspace.isReleased` describes the round that is *open*, which is not
   * always the round the open screen came from — so the folder in the URL wins
   * whenever it names one, and the workspace flag is the fallback.
   */
  const isReleased = useMemo(() => {
    const round = folderId
      ? (workspace?.folders ?? [])
          .flatMap((folder) => [folder, ...(folder.children ?? [])])
          .find((folder) => folder.id === folderId)
      : undefined;
    if (round) return round.versionStatus === 'Released';
    return workspace?.isReleased ?? false;
  }, [folderId, workspace?.folders, workspace?.isReleased]);

  // A screen opened from Builder gets its own seed layout and its own saved canvas.
  const opened = useMemo(
    () => (screenId ? resolveScreen(screenId, projectId ?? undefined) : null),
    [screenId, projectId],
  );
  // The file as the explorer knows it. A design drawn inside a round is not one
  // of the seeded prototype pages, so its name lives in the tree rather than in
  // PROTOTYPE_FILES — without this the toolbar had nothing to call it.
  const file = screenId
    ? (workspace?.folders ?? [])
        .flatMap((folder) => [...folder.files, ...(folder.children ?? []).flatMap((c) => c.files)])
        .find((entry) => entry.id === screenId)
    : undefined;
  const headerFileName = prototype?.fileName ?? file?.fileName ?? opened?.name ?? screenId;
  const headerName = prototype?.name ?? file?.name ?? opened?.route ?? '';
  // A round's own designs are html files too — same badge, same export.
  const isHtml = screenId ? isHtmlDesignFile(screenId, file?.fileName) : false;
  const exportName = prototype?.name ?? file?.name ?? opened?.name ?? 'design';
  const canvas = useCanvas(
    useMemo(
      () =>
        opened
          ? {
              storageKey: `${CANVAS_STORAGE_KEY}:${opened.id}`,
              // A prototype file starts as the screen it stands for, not as a
              // generic list page.
              seed: () =>
                prototypeDesignBlocks(opened.id) ?? createPatternBlocks(opened.seedPattern),
            }
          : screenId
            ? {
                // Unresolved screen (e.g. a customer meeting) — use the
                // screenId directly, so the blocks generated for that meeting
                // are picked up. It starts empty rather than on a stock list
                // page: a screen with no canvas yet should look like one, so
                // that generating it is the obvious next move.
                storageKey: `${CANVAS_STORAGE_KEY}:${screenId}`,
                seed: () => [],
              }
            : {},
      [opened, screenId],
    ),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarSelected, setSidebarSelected] = useState(false);
  const [sidebarOverrides, setSidebarOverrides] = useState<SidebarOverrides>(() => loadSidebarOverrides());
  const [leftTab, setLeftTab] = useState('blocks');
  const [device, setDevice] = useState<DevicePresetId>('full');
  // Opens on Preview normally; an html file arrives here from its Design tab,
  // so it opens ready to edit.
  // A released round can only be looked at, so it is pinned to preview: that
  // one flag already hides the palette, the layers, the inspector and the AI
  // chat, and disables dragging. `setPreview` refuses to unpin it, so Escape
  // and the view toggle cannot open a shipped round for editing either.
  const [previewMode, setPreviewMode] = useState(!navTabs);
  const preview = previewMode || isReleased;
  const setPreview = (next: boolean) => {
    if (!isReleased) setPreviewMode(next);
  };
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [message, setMessage] = useState(AI_MESSAGE_SEED);
  const [pending, setPending] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  // Edit turns instructions into canvas operations; Ask is a conversation
  // about the screen, streamed from the same local Claude Code install.
  const [chatMode, setChatMode] = useState<'edit' | 'ask'>('edit');
  const [chatModel, setChatModel] = useState<'sonnet' | 'opus' | 'haiku'>('opus');
  const [streamText, setStreamText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { setNodeRef: setCanvasDropRef, isOver } = useDroppable({ id: CANVAS_DROP_ID });

  const selectedBlock = useMemo(
    () => canvas.blocks.find((block) => block.id === selectedId) ?? null,
    [canvas.blocks, selectedId],
  );
  // 0 is the full-width preset — no cap, so the canvas fills the pane.
  const deviceWidth = DEVICE_PRESETS.find((entry) => entry.id === device)?.width ?? 1440;

  const flash = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setSidebarSelected(false);
  }, []);

  /* ------------------------------ actions ------------------------------ */

  const addBlock = useCallback(
    (kind: BlockKind, atIndex?: number) => {
      const id = canvas.insertBlock(kind, atIndex);
      select(id);
      return id;
    },
    [canvas, select],
  );

  const addPattern = useCallback(
    (patternId: string, atIndex?: number) => {
      const id = canvas.insertPattern(patternId, atIndex);
      if (id) select(id);
    },
    [canvas, select],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      canvas.removeBlock(id);
      setSelectedId((current) => (current === id ? null : current));
    },
    [canvas],
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const copyId = canvas.duplicateBlock(id);
      if (copyId) select(copyId);
    },
    [canvas, select],
  );

  /**
   * Where this file's layout lives. It has to be the *screen's* key, not the
   * prototype's: a round's copy and the baseline share a slug, so writing
   * `prototypeConfigKey(slug)` from a round pushed the round's layout onto
   * version 1 — editing version 2 quietly rewrote the read-only baseline.
   */
  const configKey = screenId ? prototypeConfigKeyForScreen(screenId) : undefined;

  // An html file's canvas IS the design its Preview shows, so it saves as you
  // edit and pushes the layout across, rather than waiting for ⌘S.
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;
  const blocksSignature = JSON.stringify(canvas.blocks);

  useEffect(() => {
    if (!canvas.hydrated) return;
    const timer = window.setTimeout(() => {
      const current = canvasRef.current;
      if (!current.dirty) return;
      current.save();
      if (prototype && configKey) pushCanvasToScreen(configKey, current.blocks);
      workspace?.refreshChanges();
      window.dispatchEvent(new Event('we-adk:canvas-saved'));
    }, 400);
    return () => window.clearTimeout(timer);
    // canvas is read through the ref so this runs on content change, not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.hydrated, blocksSignature, prototype, configKey]);

  const handleSave = useCallback(() => {
    const saved = canvas.save();
    if (saved) {
      workspace?.refreshChanges();
      if (prototype && configKey) pushCanvasToScreen(configKey, canvas.blocks);
      window.dispatchEvent(new Event('we-adk:canvas-saved'));
    }
    flash(saved ? 'Canvas saved · Preview updated' : 'Could not save — storage unavailable');
  }, [canvas, flash, prototype, configKey, workspace]);

  /* --------------------------- drag & drop --------------------------- */

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith(PALETTE_DRAG_PREFIX)) {
      const token = id.slice(PALETTE_DRAG_PREFIX.length);
      if (token.startsWith('pattern:')) {
        const pattern = PATTERN_CATALOG.find((entry) => entry.id === token.slice(8));
        setDragLabel(pattern?.label ?? 'Pattern');
      } else {
        const kind = token.slice(6) as BlockKind;
        setDragLabel(BLOCK_CATALOG[kind]?.label ?? 'Block');
      }
      return;
    }
    const blockId = id.startsWith(LAYER_DRAG_PREFIX) ? id.slice(LAYER_DRAG_PREFIX.length) : id;
    setDragLabel(canvas.blocks.find((block) => block.id === blockId)?.name ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragLabel(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const overBlockId = overId.startsWith(LAYER_DRAG_PREFIX)
      ? overId.slice(LAYER_DRAG_PREFIX.length)
      : overId;

    // 1. Dropping a new block/pattern in from the palette.
    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const token = activeId.slice(PALETTE_DRAG_PREFIX.length);
      const overIndex = canvas.blocks.findIndex((block) => block.id === overBlockId);
      const insertAt = overIndex === -1 ? undefined : overIndex + 1;
      if (token.startsWith('pattern:')) {
        addPattern(token.slice(8), insertAt);
      } else {
        addBlock(token.slice(6) as BlockKind, insertAt);
      }
      return;
    }

    // 2. Reordering an existing block (from canvas or layers list).
    const activeBlockId = activeId.startsWith(LAYER_DRAG_PREFIX)
      ? activeId.slice(LAYER_DRAG_PREFIX.length)
      : activeId;
    if (activeBlockId !== overBlockId) canvas.reorderBlocks(activeBlockId, overBlockId);
  };

  /* -------------------------- keyboard shortcuts -------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (event.key === 'Escape') {
        if (preview) setPreview(false);
        else setSelectedId(null);
        return;
      }
      if (isTypingTarget(event.target)) return;
      // Everything below this line changes the canvas, so it is out of bounds
      // while the screen is only being looked at — which is the only thing a
      // released round allows.
      if (preview) return;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) canvas.redo();
        else canvas.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }
      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (selectedId) duplicateBlock(selectedId);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        deleteBlock(selectedId);
        return;
      }
      if (event.altKey && selectedId && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        canvas.moveBlockBy(selectedId, event.key === 'ArrowUp' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canvas, deleteBlock, duplicateBlock, handleSave, preview, selectedId]);

  /* ------------------------------ AI chat ------------------------------ */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chat]);

  /** Offline path: the handful of commands worth handling without a round trip. */
  const runLocalCommand = useCallback(
    (text: string): string | null => {
      const lower = text.toLowerCase();
      if (/^(clear|empty)\b/.test(lower)) {
        canvas.clearCanvas();
        setSelectedId(null);
        return 'Cleared the canvas. ⌘Z to undo.';
      }
      if (/^reset\b/.test(lower)) {
        canvas.resetCanvas();
        setSelectedId(null);
        return 'Reset the canvas to the List page pattern.';
      }
      if (/^undo\b/.test(lower)) {
        canvas.undo();
        return 'Undone.';
      }
      if (/^(add|insert|create)\b/.test(lower)) {
        const pattern = PATTERN_CATALOG.find((entry) => lower.includes(entry.label.toLowerCase()));
        if (pattern) {
          addPattern(pattern.id);
          return `Added the ${pattern.label} pattern (${pattern.blocks.length} blocks).`;
        }
        const kind = resolveKind(lower);
        if (kind) {
          addBlock(kind);
          return `Added a ${BLOCK_CATALOG[kind].label} block.`;
        }
      }
      if (/^(remove|delete|drop)\b/.test(lower)) {
        const kind = resolveKind(lower);
        const target = kind
          ? [...canvas.blocks].reverse().find((block) => block.kind === kind)
          : undefined;
        if (target) {
          deleteBlock(target.id);
          return `Removed the ${BLOCK_CATALOG[target.kind].label} block.`;
        }
      }
      return null;
    },
    [addBlock, addPattern, canvas, deleteBlock],
  );

  const runCommand = useCallback(async () => {
    const text = message.trim();
    if (!text || pending) return;

    setChat((current) => [...current, { from: 'me', text }]);
    setMessage('');
    setPending(true);

    try {
      const response = await fetch('/api/sketcher/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        body: JSON.stringify({ instruction: text, blocks: canvas.blocks }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : `Request failed (${response.status}).`;
        const fallback = runLocalCommand(text);
        setChat((current) => [
          ...current,
          {
            from: 'ai',
            text: fallback
              ? `${detail}\n\nHandled it locally instead: ${fallback}`
              : `${detail}\n\nStart the app with the \`claude\` CLI on PATH to use Claude Code from here.`,
          },
        ]);
        return;
      }

      const parsed = aiResponseSchema.safeParse(payload);
      if (!parsed.success) {
        setChat((current) => [
          ...current,
          { from: 'ai', text: 'Claude replied in an unexpected shape — nothing was changed.' },
        ]);
        return;
      }

      const applied = canvas.applyOperations(parsed.data.operations);
      const skipped = Array.isArray((payload as { skipped?: unknown }).skipped)
        ? (payload as { skipped: unknown[] }).skipped.filter(
            (entry): entry is string => typeof entry === 'string',
          )
        : [];
      const parts: string[] = [parsed.data.reply];
      if (applied > 0) {
        parts.push(`(${applied} change${applied === 1 ? '' : 's'} applied · ⌘Z to undo)`);
      }
      if (skipped.length > 0) {
        parts.push(`Skipped ${skipped.length} invalid operation(s): ${skipped.join('; ')}`);
      }
      setChat((current) => [...current, { from: 'ai', text: parts.join('\n\n') }]);
    } catch {
      const fallback = runLocalCommand(text);
      setChat((current) => [
        ...current,
        {
          from: 'ai',
          text: fallback
            ? `Couldn't reach the local Claude Code bridge. Handled it locally instead: ${fallback}`
            : "Couldn't reach the local Claude Code bridge (/api/sketcher/ai).",
        },
      ]);
    } finally {
      setPending(false);
    }
  }, [canvas, message, pending, runLocalCommand]);

  /** Ask mode: talk about the screen, grounded in the live canvas. */
  const askClaude = useCallback(async () => {
    const text = message.trim();
    if (!text || pending) return;
    const history = chat
      .slice(1) // drop the seeded intro
      .slice(-16)
      .map((entry) => ({
        role: entry.from === 'me' ? ('user' as const) : ('assistant' as const),
        text: entry.text,
      }));
    setChat((current) => [...current, { from: 'me', text }]);
    setMessage('');
    setPending(true);
    setStreamText('');

    const context = [
      opened
        ? `Screen: ${opened.name}${opened.route ? ` (route ${opened.route})` : ''} — ${opened.parentLabel}.`
        : 'A scratch canvas, not attached to any project.',
      '',
      'Current canvas, top to bottom:',
      describeCanvas(canvas.blocks),
    ]
      .join('\n')
      .slice(0, 14_000);

    let acc = '';
    let errorText: string | null = null;
    try {
      const response = await fetch('/api/sketcher/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        body: JSON.stringify({
          message: text,
          history,
          context,
          folderLabel: `canvas/${opened?.name ?? 'scratch'}`,
          projectName: opened?.parentLabel ?? 'WE-ADK',
          model: chatModel,
        }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        errorText = payload?.error ?? `Request failed (${response.status}).`;
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = readChatEvent(line);
            if (event.kind === 'delta') {
              acc += event.text;
              setStreamText(acc);
            } else if (event.kind === 'full') {
              acc = event.text;
              setStreamText(acc);
            } else if (event.kind === 'error') {
              errorText = event.text;
            }
          }
        }
      }
    } catch {
      errorText = 'Lost the connection to the local bridge.';
    }

    setPending(false);
    setStreamText('');
    setChat((current) => [...current, { from: 'ai', text: errorText ?? (acc || '(no reply)') }]);
  }, [canvas.blocks, chat, chatModel, message, opened, pending]);

  const submitChat = chatMode === 'ask' ? askClaude : runCommand;

  /* ------------------------------ render ------------------------------ */


  return (
    <TooltipProvider delayDuration={400}>
      {/* Explicit id: dnd-kit otherwise numbers its aria-describedby from a
          counter that differs between the server and client render, which
          hydrates as a mismatch. */}
      <DndContext
        id="sketcher-canvas"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className={cn(
            'flex flex-col overflow-hidden',
            embedded ? 'h-full min-w-0 flex-1' : '-m-6 h-[calc(100dvh-3rem)]',
          )}
        >
          {/* Toolbar. The chat's header is the second cell of this row, so the
              two are the same height however the controls wrap. */}
          <div className="bg-background flex shrink-0 border-b">
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-4 py-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                {/* A file keeps the header its Preview tab has, so switching
                  views does not move the file's identity across the toolbar.
                  The badge is the one difference: it says what the file is, and
                  only a prototype page is really html. */}
                {navTabs && projectId && screenId && (
                  <div className="flex min-w-0 items-center gap-2 pr-1">
                    {prototype ? (
                      <Code2 className="text-muted-foreground size-3.5 shrink-0" />
                    ) : (
                      <MonitorPlay className="text-muted-foreground size-3.5 shrink-0" />
                    )}
                    <span className="truncate font-mono text-xs font-medium">{headerFileName}</span>
                    {headerName && (
                      <span className="text-muted-foreground truncate text-xs">{headerName}</span>
                    )}
                    {!isHtml && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {t('badge.wireframe')}
                      </Badge>
                    )}
                    {/* PreviewEditTabs moved to the right-side group */}
                  </div>
                )}

                {navTabs && screenId && !isReleased && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!workspace?.changes[screenId]}
                    onClick={() => workspace?.saveFile(screenId)}
                  >
                    <Check className="size-3" />
                    {t('file.save')}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('canvas.undoAction')}
                        disabled={!canvas.canUndo}
                        onClick={canvas.undo}
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.undo')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('canvas.redoAction')}
                        disabled={!canvas.canRedo}
                        onClick={canvas.redo}
                      >
                        <Redo2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.redo')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('canvas.duplicateSelected')}
                        disabled={!selectedId}
                        onClick={() => selectedId && duplicateBlock(selectedId)}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.duplicate')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('canvas.deleteSelected')}
                        disabled={!selectedId}
                        onClick={() => selectedId && deleteBlock(selectedId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.delete')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('canvas.resetCanvas')}
                        onClick={() => {
                          canvas.resetCanvas();
                          setSelectedId(null);
                          flash('Canvas reset');
                        }}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.resetLayout')}</TooltipContent>
                  </Tooltip>
                </div>
                {navTabs && projectId && screenId && !onSwitchToPreview && (
                  <PreviewEditTabs
                    active="edit"
                    released={isReleased}
                    previewHref={businessPreviewHref(projectId, screenId, folderId)}
                    editHref={businessEditHref(projectId, screenId, folderId)}
                  />
                )}
                <DeviceSwitcher device={device} onChange={setDevice} />
                {!navTabs && !isReleased && (
                  <div className="bg-muted flex rounded-md p-0.5">
                    {VIEW_MODES.map((mode) => {
                      const active = mode.preview === preview;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPreview(mode.preview)}
                          aria-pressed={active}
                          className={cn(
                            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                            active ? 'bg-background shadow-xs' : 'text-muted-foreground',
                          )}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isHtml && screenId && (
                  <DesignHtmlButton
                    screenId={screenId}
                    name={exportName}
                    route={prototype?.route ?? file?.route ?? opened?.route}
                    seedPattern={opened?.seedPattern}
                    origin={opened?.parentLabel}
                    className="h-7 gap-1 px-2 text-xs"
                  />
                )}
                {screenId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        asChild
                      >
                        <a
                          href={previewHref(screenId, projectId ?? undefined)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t('canvas.openNewTab')}
                        >
                          <ExternalLink className="size-3" />
                          {t('view.openBrowser')}
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Opens on its own URL, without the editor — shareable as a link
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

          </div>

          <div className="flex min-h-0 flex-1">
            {/* Left panel */}
            {!preview && (
              <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r bg-background">
                <Tabs value={leftTab} onValueChange={setLeftTab} className="flex-1">
                  <TabsList className="mx-2 mt-2 grid grid-cols-2">
                    <TabsTrigger value="blocks">{t('canvas.blocks')}</TabsTrigger>
                    <TabsTrigger value="layers">
                      Layers
                      <Badge variant="secondary" className="ml-1 px-1">
                        {canvas.blocks.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="blocks">
                    <Palette
                      onAddBlock={(kind) => addBlock(kind)}
                      onAddPattern={(id) => addPattern(id)}
                    />
                  </TabsContent>
                  <TabsContent value="layers">
                    <LayersPanel
                      blocks={canvas.blocks}
                      selectedId={selectedId}
                      onSelect={select}
                      onRename={canvas.renameBlock}
                      onToggleHidden={canvas.toggleHidden}
                      onDelete={deleteBlock}
                    />
                  </TabsContent>
                </Tabs>
              </aside>
            )}

            {/* Canvas */}
            {(() => {
              const canvasRoute = prototype?.route ?? file?.route ?? opened?.route;
              /*
               * A screen that carries its own `appShell` is framed by that.
               * `DesignChromeFrame` is the eACC app's nav specifically — right
               * for a prototype of that app, wrong for a customer's product —
               * so the block wins wherever a screen has one.
               */
              const { shell, content } = splitShell(canvas.blocks);
              const showChrome = !shell && hasAppChrome(canvasRoute);
              const framed = Boolean(shell) || showChrome;

              const blocksContent = (
                <div
                  ref={setCanvasDropRef}
                  onClick={(event) => event.stopPropagation()}
                  style={deviceWidth > 0 ? { maxWidth: `${deviceWidth}px` } : undefined}
                  className={cn(
                    framed
                      ? 'flex flex-col gap-1 p-5'
                      : 'mx-auto flex flex-col gap-1 rounded-xl border bg-background p-5 shadow-sm transition-colors',
                    isOver && 'border-primary/60 ring-primary/20 ring-2',
                  )}
                >
                  <SortableContext
                    items={content.map((block) => block.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {content.map((block) => (
                      <CanvasBlockShell
                        key={block.id}
                        block={block}
                        selected={block.id === selectedId}
                        preview={preview}
                        onSelect={() => select(block.id)}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onDelete={() => deleteBlock(block.id)}
                        onToggleHidden={() => canvas.toggleHidden(block.id)}
                      />
                    ))}
                  </SortableContext>

                  {content.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                      <p className="text-sm font-medium">{t('canvas.empty')}</p>
                      <p className="text-muted-foreground text-xs">{t('canvas.emptyHint')}</p>
                      <Button size="sm" variant="outline" onClick={() => addPattern('listPage')}>
                        {t('canvas.startList')}
                      </Button>
                    </div>
                  )}
                </div>
              );

              return (
                <main
                  className="min-w-0 flex-1 overflow-auto bg-[#f4f5f7] dark:bg-[#0b0e14]"
                  onClick={() => { setSelectedId(null); setSidebarSelected(false); }}
                >
                  {shell ? (
                    <div className="flex min-h-full flex-col overflow-x-auto rounded-xl border bg-background shadow-sm">
                      <ScreenShell
                        block={shell}
                        selected={selectedId === shell.id}
                        onSelect={preview ? undefined : () => select(shell.id)}
                      >
                        {blocksContent}
                      </ScreenShell>
                    </div>
                  ) : showChrome ? (
                    <div className="flex min-h-full flex-col rounded-xl border bg-background shadow-sm">
                      <DesignChromeFrame
                        route={canvasRoute!}
                        hrefForRoute={projectId ? (route) => {
                          const target = findPrototypeByRoute(route);
                          return target ? businessEditHref(projectId, target.id, folderId) : null;
                        } : undefined}
                        sidebarSelected={sidebarSelected}
                        onSidebarSelect={preview ? undefined : () => {
                          setSidebarSelected(true);
                          setSelectedId(null);
                        }}
                        sidebarOverrides={sidebarOverrides}
                      >
                        {blocksContent}
                      </DesignChromeFrame>
                    </div>
                  ) : (
                    <div className="p-6">{blocksContent}</div>
                  )}
                  {!preview && (
                    <p className="text-muted-foreground mt-3 text-center text-[10px]">
                      {t('canvas.helpText')}
                    </p>
                  )}

                  {/* Floating action bar — hidden for released versions */}
                  {!isReleased && (
                    <div className="sticky bottom-4 z-40 flex justify-center pt-4">
                      <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-lg">
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-full">
                          <Sparkles className="size-3.5" />
                          {t('action.improveAi')}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-full">
                          <ClipboardList className="size-3.5" />
                          {t('action.createTask')}
                        </Button>
                      </div>
                    </div>
                  )}
                </main>
              );
            })()}

            {/* Right: the block inspector, on screen while a block is selected —
                with the chat permanently docked, the canvas needs the room back
                when nothing is being edited. */}
            {!preview && selectedBlock && (
              <aside className="bg-background flex w-72 shrink-0 flex-col border-l">
                <div className="mx-2 mt-3 mb-1">
                  <p className="text-sm font-medium">{t('canvas.properties')}</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <PropertyInspector
                    block={selectedBlock}
                    onPatch={(patch) =>
                      selectedBlock && canvas.updateProps(selectedBlock.id, patch)
                    }
                    onRename={(name) => selectedBlock && canvas.renameBlock(selectedBlock.id, name)}
                    onDuplicate={() => selectedBlock && duplicateBlock(selectedBlock.id)}
                    onDelete={() => selectedBlock && deleteBlock(selectedBlock.id)}
                  />
                </div>
              </aside>
            )}
            {!preview && sidebarSelected && (
              <SidebarInspector
                overrides={sidebarOverrides}
                onChange={(next) => {
                  setSidebarOverrides(next);
                  saveSidebarOverrides(next);
                }}
                onDeselect={() => setSidebarSelected(false)}
              />
            )}

            {/* AI Chat — collapsible, same pattern as the task tab */}
            {!preview && (
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
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-3.5 py-3 text-sm">
                      {chat.length === 0 && !pending && (
                        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                          <MessageSquare className="size-5" />
                          <p className="text-foreground text-sm font-medium">
                            Ask about {prototype?.name ?? opened?.name ?? 'this canvas'}
                          </p>
                          <p className="max-w-sm text-xs">
                            The canvas is in context as it stands. Edit changes it directly; Ask talks
                            about it without touching anything. ⌘Z undoes any change.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        {chat.map((entry, index) =>
                          entry.from === 'me' ? (
                            <div key={index} className="flex justify-end">
                              <p className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
                                {entry.text}
                              </p>
                            </div>
                          ) : (
                            <div key={index} className="flex gap-2">
                              <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                              <div className="min-w-0 flex-1">
                                <AssistantMarkdown text={entry.text} />
                              </div>
                            </div>
                          ),
                        )}

                        {pending && (
                          <div className="flex gap-2">
                            <span className="bg-primary mt-1.5 size-2 shrink-0 animate-pulse rounded-full" />
                            <div className="min-w-0 flex-1">
                              {streamText ? (
                                <AssistantMarkdown text={streamText} />
                              ) : (
                                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                                  <Loader2 className="size-3.5 animate-spin" />
                                  {chatMode === 'ask'
                                    ? 'Reading the canvas…'
                                    : 'Claude Code is working…'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div ref={chatEndRef} />
                    </div>

                    <div className="shrink-0 px-3 pt-2 pb-2">
                      <div className="border-input focus-within:border-ring rounded-xl border px-3 py-2 shadow-sm">
                        <label className="sr-only" htmlFor="canvas-message">
                          Message about this canvas
                        </label>
                        <textarea
                          id="canvas-message"
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void submitChat();
                            }
                          }}
                          rows={Math.min(6, Math.max(1, message.split('\n').length))}
                          disabled={pending}
                          placeholder={
                            chatMode === 'ask'
                              ? `Ask about ${opened?.name ?? 'this canvas'} …`
                              : 'e.g. "make the table dense and drop the CEO column"'
                          }
                          className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-1 pt-0.5 text-sm outline-none disabled:opacity-60"
                        />

                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="bg-muted flex rounded-md p-0.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setChatMode('edit')}
                              aria-pressed={chatMode === 'edit'}
                              className={cn(
                                'rounded px-2 py-0.5',
                                chatMode === 'edit'
                                  ? 'bg-background font-medium shadow-xs'
                                  : 'text-muted-foreground',
                              )}
                            >
                              Edit canvas
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatMode('ask')}
                              aria-pressed={chatMode === 'ask'}
                              className={cn(
                                'rounded px-2 py-0.5',
                                chatMode === 'ask'
                                  ? 'bg-background font-medium shadow-xs'
                                  : 'text-muted-foreground',
                              )}
                            >
                              Ask
                            </button>
                          </div>

                          <div className="ml-auto flex items-center gap-1">
                            <Select
                              value={chatModel}
                              onValueChange={(value) =>
                                setChatModel(value as 'sonnet' | 'opus' | 'haiku')
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={t('chat.model')}
                                className="text-muted-foreground h-7 gap-1 border-0 px-1.5 text-xs font-medium shadow-none"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent align="end">
                                <SelectItem value="sonnet">Sonnet</SelectItem>
                                <SelectItem value="opus">Opus</SelectItem>
                                <SelectItem value="haiku">Haiku</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="size-7 rounded-full p-0"
                              title={t('terminal.send')}
                              aria-label={t('canvas.sendMessage')}
                              disabled={pending || message.trim().length === 0}
                              onClick={() => void submitChat()}
                            >
                              {pending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <ArrowUp className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <p className="text-muted-foreground/80 pt-1.5 pb-0.5 text-center text-[11px]">
                        Runs on the Claude Code CLI installed on this machine · Enter to send
                      </p>
                    </div>
                  </div>
                </aside>
              )
            )}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragLabel && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs shadow-lg">
              <GripVertical className="size-3" />
              {dragLabel}
            </div>
          )}
        </DragOverlay>

        {toast && (
          <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md px-3 py-1.5 text-xs shadow-lg">
            {toast}
          </div>
        )}
      </DndContext>
    </TooltipProvider>
  );
}
