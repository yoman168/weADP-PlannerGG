'use client';

/**
 * Design tool.
 *
 * The Business round produces structure — designs with no styling opinion of
 * their own. This tab is where that structure meets a look: it picks up the
 * latest version from Business › Main as the same folder tree the explorer
 * shows, assigns a design system to it, and exports the DESIGN.md an agent
 * needs to build the screens for real.
 *
 * The tree is not decoration. A round is rarely one look — the eACC screens in
 * it want the dense table system while an onboarding screen wants the warm one
 * — so the tree is where the system gets scoped: round default, folder
 * override, file override. Narrowest wins.
 */

import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  Folder,
  FolderOpen,
  GitMerge,
  Layers,
  Palette,
  PanelRightClose,
  RotateCcw,
  SquareTerminal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from '@/lib/locale';
import { Badge, Button, Separator, cn } from '@/components/ui';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { DesignCanvas } from '@/components/we-adk/design-canvas';
import { DesignInspector } from '@/components/we-adk/design-inspector';
import {
  DEFAULT_DESIGN_SYSTEM,
  DESIGN_SYSTEMS,
  designSystemToMarkdown,
  findDesignSystem,
  isPatched,
  tokenColor,
  withOverrides,
  type ComponentPatch,
  type DesignSystem,
  type TypePatch,
} from '@/lib/we-adk/design-systems';
import {
  EMPTY_ASSIGNMENT,
  distinctSystemCount,
  loadAssignment,
  resolveFolderSystem,
  resolveSystem,
  resetSystem,
  saveAssignment,
  setFileSystem,
  setComponent,
  setFolderSystem,
  setRadius,
  setBlock,
  setRoundSystem,
  setSpacingBase,
  setTokenColor,
  setTypography,
  type AssignmentScope,
  type SystemAssignment,
} from '@/lib/we-adk/design-system-assignment';
import { loadBoardChat, saveBoardChat } from '@/lib/we-adk/board-chat';
import { findProject, type DesignFile, type DesignFolder } from '@/lib/we-adk-mock/projects';
import { loadGeneratedScreens, type SketchScreen } from '@/lib/we-adk-mock/sketches';
import type { VersionStatus } from '@/lib/we-adk-mock/types';
import {
  BASELINE_VERSION,
  loadRemovedVersions,
  loadSubfolders,
  loadVersionCount,
  isVersionLocked,
  loadVersionStatuses,
  projectVersionFolders,
  subfolderStorageKey,
  versionFolderKey,
} from '@/lib/we-adk-mock/versions';

/* ------------------------------------------------------------------ */
/* Which round the Design tool works from                              */
/* ------------------------------------------------------------------ */

interface SourceRound {
  version: number;
  status: VersionStatus;
  /** The round's folder, exactly as the Business explorer builds it. */
  folder: DesignFolder;
}

/**
 * The round Design works from: the latest one still in progress.
 *
 * Only that one. A released round is the record of what shipped and the baseline
 * is the app as it stands — both are locked, so styling them would produce a
 * DESIGN.md against designs nobody can change. `isVersionLocked` is the same rule
 * the Business explorer enforces, asked rather than re-derived, so the two tabs
 * cannot disagree about what is open.
 *
 * The model allows one round in progress at a time, so this is normally a single
 * folder — the max guards the case where storage says otherwise.
 */
function loadRoundFolders(projectId: string): DesignFolder[] {
  const project = findProject(projectId);
  if (!project) return [];

  const count = loadVersionCount(projectId);
  const removed = loadRemovedVersions(projectId);
  const statuses = loadVersionStatuses(projectId);

  // The tree comes from the same builder the explorer uses, so the two tabs
  // cannot disagree about what a round contains. It needs the user-created files
  // read out of storage first — each round's own key, then its folders'.
  const created: Record<string, SketchScreen[]> = {};
  for (let version = BASELINE_VERSION; version <= Math.max(count, BASELINE_VERSION); version += 1) {
    if (removed.includes(version)) continue;
    const roundKey = versionFolderKey(projectId, version);
    created[roundKey] = loadGeneratedScreens(roundKey);
    for (const sub of loadSubfolders(projectId, version)) {
      const key = subfolderStorageKey(projectId, version, sub.id);
      created[key] = loadGeneratedScreens(key);
    }
  }

  const editable = projectVersionFolders(project, created, count, statuses, removed).filter(
    (folder) =>
      folder.versionNumber !== undefined && !isVersionLocked(folder.versionNumber, statuses),
  );

  if (editable.length <= 1) return editable;

  const latest = Math.max(...editable.map((folder) => folder.versionNumber as number));
  return editable.filter((folder) => folder.versionNumber === latest);
}

/** The only round on offer, or null when nothing is in progress. */
function defaultVersion(folders: DesignFolder[]): number | null {
  const numbers = folders
    .map((folder) => folder.versionNumber)
    .filter((value): value is number => value !== undefined);
  return numbers.length === 0 ? null : Math.max(...numbers);
}

/** Every file in a round, folders first then the root — the tree, flattened. */
function roundFiles(folder: DesignFolder): { file: DesignFile; folderId?: string }[] {
  const nested = (folder.children ?? []).flatMap((child) =>
    child.files.map((file) => ({ file, folderId: child.id })),
  );
  return [...nested, ...folder.files.map((file) => ({ file }))];
}

/* ------------------------------------------------------------------ */
/* What the picker is currently pointed at                             */
/* ------------------------------------------------------------------ */

type Target =
  | { kind: 'round' }
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'file'; id: string; name: string; folderId?: string };

function targetLabel(target: Target): string {
  if (target.kind === 'round') return 'the whole round';
  return target.name;
}

/* ------------------------------------------------------------------ */
/* The system chip a tree row wears                                    */
/* ------------------------------------------------------------------ */

/**
 * A dot in the system's primary colour, plus its name when the row set it
 * itself. Inherited rows show the dot alone: naming the system on every row
 * would make an inherited round read as thirty separate decisions.
 */
function SystemChip({
  system,
  scope,
  rowScope,
}: {
  system: DesignSystem;
  scope: AssignmentScope;
  /** What this row is. An override is only "own" if it was set at this level. */
  rowScope: AssignmentScope;
}) {
  const own = scope === rowScope;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 rounded px-1 text-[10px]',
        own ? 'bg-muted font-medium' : 'text-muted-foreground',
      )}
      title={own ? `${system.name} — set here` : `${system.name} — inherited`}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: tokenColor(system, 'primary') }}
      />
      {own && <span className="max-w-24 truncate">{system.name}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Pane 1 — the source tree                                            */
/* ------------------------------------------------------------------ */

const ROW = 'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs';

function FileRow({
  file,
  folderId,
  assignment,
  target,
  activeFileId,
  onSelect,
}: {
  file: DesignFile;
  folderId?: string;
  assignment: SystemAssignment;
  target: Target;
  /** The file the canvas is drawing, which is not always the one clicked. */
  activeFileId: string | null;
  onSelect: (target: Target) => void;
}) {
  const { systemId, scope } = resolveSystem(assignment, file.id, folderId);
  const system = findDesignSystem(systemId) ?? DEFAULT_DESIGN_SYSTEM;
  const selected = target.kind === 'file' && target.id === file.id;
  // Selecting a folder or the round puts the first file in scope on the canvas
  // without anyone clicking it. Highlighting what is actually on screen — rather
  // than only what was clicked — is what stops the tree and the canvas from
  // disagreeing about which design you are looking at.
  const active = file.id === activeFileId;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ kind: 'file', id: file.id, name: file.fileName, folderId })}
        aria-pressed={selected}
        aria-current={active ? 'true' : undefined}
        title={file.fileName}
        className={cn(
          ROW,
          // The clicked file is the stronger state: it owns the picker as well as
          // the canvas. A file that is merely on screen gets the fill without the
          // border, so the two are still tellable apart.
          selected
            ? 'bg-muted border-primary border-l-2 pl-1 font-medium'
            : active
              ? 'bg-muted/60'
              : 'hover:bg-muted/40',
        )}
      >
        <FileCode2 className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono">{file.fileName}</span>
        <SystemChip system={system} scope={scope} rowScope="file" />
      </button>
    </li>
  );
}

function FolderRow({
  folder,
  assignment,
  target,
  activeFileId,
  onSelect,
}: {
  folder: DesignFolder;
  assignment: SystemAssignment;
  target: Target;
  activeFileId: string | null;
  onSelect: (target: Target) => void;
}) {
  const [open, setOpen] = useState(true);
  const { systemId, scope } = resolveFolderSystem(assignment, folder.id);
  const system = findDesignSystem(systemId) ?? DEFAULT_DESIGN_SYSTEM;
  const selected = target.kind === 'folder' && target.id === folder.id;
  const Icon = open ? FolderOpen : Folder;

  return (
    <li>
      <div className={cn(ROW, selected ? 'bg-muted font-medium' : 'hover:bg-muted/40')}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onSelect({ kind: 'folder', id: folder.id, name: folder.name })}
          aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Icon className="text-muted-foreground size-3.5 shrink-0" />
          <span className={cn('min-w-0 flex-1 truncate font-mono', selected && 'font-medium')}>
            {folder.name}
          </span>
          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
            {folder.files.length}
          </span>
          <SystemChip system={system} scope={scope} rowScope="folder" />
        </button>
      </div>

      {open && (
        <ul className="border-muted ml-4 border-l pl-1">
          {folder.files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              folderId={folder.id}
              assignment={assignment}
              target={target}
              activeFileId={activeFileId}
              onSelect={onSelect}
            />
          ))}
          {folder.files.length === 0 && (
            <li className="text-muted-foreground px-2 py-1 text-[11px] italic">empty</li>
          )}
        </ul>
      )}
    </li>
  );
}

/**
 * The explorer's row language, borrowed rather than re-invented.
 *
 * Blue on the left border is how the Business tree marks the round in progress,
 * and that is the only round this pane can show — a second visual vocabulary for
 * the same tree would be worse than none.
 */
function versionRowClass(active: boolean): string {
  return cn(
    'group/folder flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-left text-xs',
    active
      ? 'border-blue-500 bg-muted text-foreground'
      : 'border-transparent text-muted-foreground hover:bg-muted/40',
  );
}

/** Files in a folder plus everything in the folders inside it. */
function folderFileCount(folder: DesignFolder): number {
  return (
    folder.files.length +
    (folder.children ?? []).reduce((sum, child) => sum + child.files.length, 0)
  );
}

function SourcePane({
  folders,
  version,
  onPickVersion,
  assignment,
  target,
  activeFileId,
  onSelect,
}: {
  /** Every round, baseline first — the whole tree, as Business shows it. */
  folders: DesignFolder[];
  /** The round being styled. Its subtree is the one that expands. */
  version: number | null;
  onPickVersion: (version: number) => void;
  assignment: SystemAssignment;
  target: Target;
  /** The file on the canvas — highlighted even when it was never clicked. */
  activeFileId: string | null;
  onSelect: (target: Target) => void;
}) {
  const roundSystem = findDesignSystem(assignment.round) ?? DEFAULT_DESIGN_SYSTEM;

  return (
    <section className="flex min-h-0 shrink-0 flex-col gap-2 xl:w-72">
      <header className="flex items-center gap-2">
        <Layers className="text-muted-foreground size-3.5" />
        <h2 className="text-[10px] font-semibold tracking-wider uppercase">Explorer</h2>
        <span className="text-muted-foreground text-[10px]">Business › Main</span>
      </header>

      {folders.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">
          No round in progress. A released round and the baseline are locked, so there is nothing to
          style — start the next round on the Business tab.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border py-1 max-xl:max-h-96">
          <ul>
            {folders.map((folder) => {
              const number = folder.versionNumber ?? BASELINE_VERSION;
              const open = number === version;
              // The round row is also the default everything inside it inherits,
              // so selecting it both opens it and points the picker at the round.
              const active = open && target.kind === 'round';

              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickVersion(number);
                      onSelect({ kind: 'round' });
                    }}
                    aria-pressed={open}
                    aria-expanded={open}
                    title={folder.label}
                    className={versionRowClass(active)}
                  >
                    {open ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                    {open ? (
                      <FolderOpen className="size-3.5 shrink-0" />
                    ) : (
                      <Folder className="size-3.5 shrink-0" />
                    )}
                    <span
                      className={cn('min-w-0 flex-1 truncate font-mono', open && 'font-medium')}
                    >
                      {folder.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px]">
                      {folderFileCount(folder)}
                    </span>
                    <Badge variant="warning" className="shrink-0 px-1 py-0 text-[9px]">
                      WIP
                    </Badge>
                  </button>

                  {open && (
                    <ul className="border-muted ml-4 border-l pl-1">
                      {(folder.children ?? []).map((child) => (
                        <FolderRow
                          key={child.id}
                          folder={child}
                          assignment={assignment}
                          target={target}
                          activeFileId={activeFileId}
                          onSelect={onSelect}
                        />
                      ))}
                      {folder.files.map((file) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          assignment={assignment}
                          target={target}
                          activeFileId={activeFileId}
                          onSelect={onSelect}
                        />
                      ))}
                      {folderFileCount(folder) === 0 && (
                        <li className="text-muted-foreground px-2 py-1 text-[11px] italic">
                          empty
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-auto px-2 pt-2">
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              Round default: <span className="font-medium">{roundSystem.name}</span>
              {distinctSystemCount(assignment) > 1 && ' · mixed round — some rows are pinned'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pane 2 — the system                                                 */
/* ------------------------------------------------------------------ */

function SystemCard({
  system,
  selected,
  onSelect,
}: {
  system: DesignSystem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-colors',
        selected ? 'border-primary bg-muted/40' : 'hover:bg-muted/40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{system.name}</span>
        {selected && <Check className="text-primary size-3.5" />}
      </div>

      {/* The swatch row is the whole point of a picker, so it reads the same
          tokens the export writes. */}
      <div className="flex gap-1">
        {system.colors.slice(0, 8).map((color) => (
          <span
            key={color.name}
            className="size-5 rounded border"
            style={{ background: color.value }}
            title={`${color.name} — ${color.role}`}
          />
        ))}
      </div>

      <p className="text-muted-foreground text-[11px] leading-relaxed">{system.tagline}</p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Pane 3 — the hand-off                                              */
/* ------------------------------------------------------------------ */

function HandoffPane({ markdown, fileName }: { markdown: string; fileName: string }) {
  const [copied, setCopied] = useState(false);

  // The tick has to go back on its own, or the button lies about the next copy.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <header className="flex items-center gap-2">
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copy}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={download}>
          <Download className="size-3" />
          Export
        </Button>
      </header>

      <pre className="bg-muted/50 min-h-0 flex-1 overflow-auto rounded-xl border p-3 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap">
        {markdown}
      </pre>
    </div>
  );
}

/** Chat history is per round: a system tuned for version 3 is a new conversation. */
function chatScope(version: number): string {
  return `design-v${version}`;
}

/* ------------------------------------------------------------------ */
/* What Claude can see                                                 */
/* ------------------------------------------------------------------ */

/**
 * The chat's context: the hand-off itself, plus what is selected.
 *
 * The DESIGN.md is passed verbatim rather than summarised — it is already the
 * canonical description of the system, and paraphrasing it into a prompt is how
 * the chat ends up answering about a system that does not exist. The selection is
 * appended because "is this radius too large" is unanswerable without knowing
 * which component is being asked about.
 */
function designChatContext(
  markdown: string,
  system: DesignSystem,
  componentId: string,
  round: SourceRound | null,
  target: Target,
): string {
  const spec = system.components.find((entry) => entry.id === componentId);

  return [
    'You are reviewing a design system as it is being applied to a round of designs.',
    '',
    round
      ? `Source: version ${round.version} (${round.status}) from Business › Main. Currently scoped to ${targetLabel(target)}.`
      : 'No Business round exists yet.',
    '',
    `Selected component: ${spec ? spec.name : componentId}${
      spec
        ? ` — radius ${spec.radius} (${system.radius[spec.radius] ?? '?'}), fill ${spec.fill}, border ${
            spec.border ?? 'none'
          }, text ${spec.text}, ${spec.heightLabel.toLowerCase()} ${spec.height}px.`
        : '.'
    }`,
    '',
    'The full specification follows. Answer against it — do not invent tokens it does not define.',
    '',
    markdown,
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DesignPage() {
  const params = useParams<{ projectId: string }>();
  const project = findProject(params.projectId);
  const { t } = useLocale();
  const [folders, setFolders] = useState<DesignFolder[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [assignment, setAssignment] = useState<SystemAssignment>(EMPTY_ASSIGNMENT);
  const [target, setTarget] = useState<Target>({ kind: 'round' });
  const [rail, setRail] = useState<'properties' | 'design.md'>('properties');
  /**
   * Whether the conversation is on screen.
   *
   * A column rather than a tab in the rail: the chat is about what you are
   * looking at, so hiding the inspector to read it is the wrong trade. Closed by
   * default — three columns already fill the width, and the chat is something you
   * reach for rather than something you need in view.
   */
  const [chatOpen, setChatOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  /** Shared by the canvas and the inspector: clicking a block selects a spec. */
  const [componentId, setComponentId] = useState('button');
  /** The block that was clicked — what "this block" scope means. */
  const [blockId, setBlockId] = useState<string | null>(null);
  const [componentScope, setComponentScope] = useState<'system' | 'block'>('block');

  // The rounds and the assignments both live in localStorage, so they can only
  // be read once the client is up — server-rendering them would produce a
  // mismatched empty state.
  useEffect(() => {
    const tree = loadRoundFolders(params.projectId);
    setFolders(tree);
    setVersion(defaultVersion(tree));
  }, [params.projectId]);

  /**
   * Assignments and chat are stored per round, so switching rounds swaps both.
   *
   * A system pinned for version 2 has nothing to say about version 3, and a
   * conversation about one round's palette would be misleading context for
   * another's.
   */
  useEffect(() => {
    if (version === null) return;
    setAssignment(loadAssignment(params.projectId, version));
    setTurns(loadBoardChat(params.projectId, chatScope(version)));
    setTarget({ kind: 'round' });
  }, [params.projectId, version]);

  const round: SourceRound | null = useMemo(() => {
    if (version === null) return null;
    const folder = folders.find((entry) => entry.versionNumber === version);
    if (!folder) return null;
    return {
      version,
      status: folder.versionStatus ?? 'In progress',
      folder,
    };
  }, [folders, version]);

  const commit = (next: SystemAssignment) => {
    setAssignment(next);
    if (version !== null) saveAssignment(params.projectId, version, next);
  };

  /** What the selected node currently resolves to, and where that came from. */
  const resolved = useMemo(() => {
    if (target.kind === 'round') return { systemId: assignment.round, scope: 'round' as const };
    if (target.kind === 'folder') return resolveFolderSystem(assignment, target.id);
    return resolveSystem(assignment, target.id, target.folderId);
  }, [assignment, target]);

  /** The system as shipped — what "reset" goes back to. */
  const base = findDesignSystem(resolved.systemId) ?? DEFAULT_DESIGN_SYSTEM;
  /** The system as it currently stands, with this round's colour edits applied. */
  const system = withOverrides(base, assignment.overrides[base.id]);

  /** Picking a system writes it at whatever level is selected. */
  const applySystem = (systemId: string) => {
    if (target.kind === 'round') commit(setRoundSystem(assignment, systemId));
    else if (target.kind === 'folder') commit(setFolderSystem(assignment, target.id, systemId));
    else commit(setFileSystem(assignment, target.id, systemId));
  };

  /** Drop this node's own pin and go back to inheriting. */
  const clearPin = () => {
    if (target.kind === 'folder') commit(setFolderSystem(assignment, target.id, null));
    else if (target.kind === 'file') commit(setFileSystem(assignment, target.id, null));
  };

  /**
   * The inspector edits the system, so every handler writes against `base.id`
   * rather than the selected node — the tree decides which system a screen
   * gets, not what that system looks like.
   */
  const handlers = {
    onColor: (token: string, value: string | null) =>
      commit(setTokenColor(assignment, base.id, token, value)),
    onRadius: (key: string, value: string | null) =>
      commit(setRadius(assignment, base.id, key, value)),
    onSpacingBase: (next: number | null) => commit(setSpacingBase(assignment, base.id, next)),
    onTypography: (role: 'display' | 'body', fragment: TypePatch) =>
      commit(setTypography(assignment, base.id, role, fragment)),
    onComponent: (id: string, fragment: ComponentPatch | null) =>
      commit(setComponent(assignment, base.id, id, fragment)),
    onBlock: (fragment: ComponentPatch | null) =>
      blockId === null ? undefined : commit(setBlock(assignment, blockId, fragment)),
    onResetAll: () => commit(resetSystem(assignment, base.id)),
  };

  const pinned = target.kind !== 'round' && resolved.scope === target.kind;

  /** The screen the canvas draws — only a file selection names one. */
  const canvasScreen = useMemo(() => {
    if (round === null) return null;
    if (target.kind === 'file') return { id: target.id, name: target.name };
    // A folder or the round is a set, not a screen. Showing the first file in
    // scope beats showing nothing: it is the same colours either way, and an
    // empty canvas next to a colour editor reads as broken.
    const scoped = roundFiles(round.folder).filter((entry) =>
      target.kind === 'folder' ? entry.folderId === target.id : true,
    );
    const first = scoped[0];
    return first ? { id: first.file.id, name: first.file.fileName } : null;
  }, [round, target]);

  /**
   * The hand-off names the screens that actually resolve to this system, not
   * every screen in the round — a mixed round exports one file per system, and
   * a DESIGN.md listing screens built to a different look is worse than one
   * listing none.
   */
  const markdown = useMemo(() => {
    if (round === null) return designSystemToMarkdown(system);
    const screens = roundFiles(round.folder)
      .filter(
        (entry) => resolveSystem(assignment, entry.file.id, entry.folderId).systemId === system.id,
      )
      .map((entry) => ({ name: entry.file.fileName, route: entry.file.route }));

    return designSystemToMarkdown(system, {
      projectName: project?.name ?? params.projectId,
      version: round.version,
      versionStatus: round.status,
      screens,
    });
  }, [system, round, assignment, project?.name, params.projectId]);

  return (
    // The WE-ADK shell tints its background (`bg-[#f4f5f7]`), which suits a page
    // of cards but not this one — the canvas has to be judged against white or a
    // system's own off-white reads as the tint. Bleeding past the layout's
    // padding and re-applying it puts white edge to edge without touching the
    // shell, so every other WE-ADK page keeps the tint.
    <div className="bg-background -mx-6 -mt-12 -mb-6 px-6 pt-12 pb-6">
      <div className="flex flex-col gap-4 xl:h-[calc(100dvh-4.5rem)]">
        <header className="flex shrink-0 items-center gap-2.5">
          <GitMerge className="size-5 text-amber-500" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Design</h1>
            <p className="text-muted-foreground text-xs">
              The latest Business round, scoped to a design system. Export the DESIGN.md and the
              screens get built to it.
            </p>
          </div>

          {/* Only while the panel is closed — open, its own header carries the
              close button, and a second control here would be two ways to do one
              thing with no way to tell which state you are in. */}
          {!chatOpen && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 text-xs"
              onClick={() => setChatOpen(true)}
            >
              <SquareTerminal className="size-3.5" />
              {t('chat.claudeCode')}
            </Button>
          )}
        </header>

        <Separator className="shrink-0" />

        <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
          <SourcePane
            folders={folders}
            version={version}
            onPickVersion={setVersion}
            assignment={assignment}
            target={target}
            activeFileId={canvasScreen?.id ?? null}
            onSelect={setTarget}
          />

          {/* The canvas inside scrolls itself, so this column must not: nesting a
            scroller around it would leave the picker and the frame fighting over
            the same wheel event. */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:overflow-hidden">
            <header className="flex shrink-0 flex-wrap items-center gap-2">
              <Palette className="text-muted-foreground size-3.5" />
              <h2 className="text-[10px] font-semibold tracking-wider uppercase">Design system</h2>
              <span className="text-muted-foreground text-[11px]">
                applying to <span className="font-mono">{targetLabel(target)}</span>
                {target.kind !== 'round' && !pinned && ' · inherited'}
              </span>
              {pinned && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-[11px]"
                  onClick={clearPin}
                >
                  <RotateCcw className="size-3" />
                  Inherit
                </Button>
              )}
            </header>

            <div className="grid shrink-0 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {DESIGN_SYSTEMS.map((entry) => (
                <SystemCard
                  key={entry.id}
                  system={entry}
                  selected={entry.id === system.id}
                  onSelect={() => applySystem(entry.id)}
                />
              ))}
            </div>

            <DesignCanvas
              system={system}
              screen={canvasScreen}
              blockOverrides={assignment.blocks}
              selectedBlockId={blockId}
              onSelect={(selection) => {
                setBlockId(selection?.blockId ?? null);
                if (!selection) return;
                setComponentId(selection.componentId);
                // A click on the canvas is a request to edit that component, so
                // the rail has to be showing the inspector to answer it.
                setRail('properties');
              }}
            />
          </section>

          {/* Properties and the hand-off share the right rail as tabs: they are
            both "about the selected system", and a fourth column would push the
            canvas below a usable width. */}
          {/* The rail yields to the chat outright rather than both squeezing the
              canvas. Even where four columns fit, the canvas is the thing being
              designed and it should keep the width. Closing the chat brings the
              rail straight back — it reads from the same assignment, so there is
              no state to lose. */}
          <section
            className={cn(
              'flex min-h-0 shrink-0 flex-col gap-2 xl:w-[22rem]',
              chatOpen && 'hidden',
            )}
          >
            <header className="flex shrink-0 items-center gap-1">
              {(['properties', 'design.md'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRail(tab)}
                  aria-pressed={rail === tab}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-semibold tracking-wider uppercase',
                    rail === tab ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab}
                </button>
              ))}
              <div className="flex-1" />
              {rail === 'properties' && isPatched(assignment.overrides[base.id]) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-[11px]"
                  onClick={handlers.onResetAll}
                >
                  <RotateCcw className="size-3" />
                  Reset all
                </Button>
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto max-xl:max-h-[32rem]">
              {rail === 'properties' ? (
                <DesignInspector
                  system={system}
                  base={base}
                  selectedComponentId={componentId}
                  componentScope={blockId === null ? 'system' : componentScope}
                  onComponentScope={setComponentScope}
                  blockPatch={blockId === null ? undefined : assignment.blocks[blockId]}
                  hasBlock={blockId !== null}
                  handlers={handlers}
                />
              ) : (
                <HandoffPane
                  markdown={markdown}
                  fileName={`DESIGN-${system.id}${round ? `-v${round.version}` : ''}.md`}
                />
              )}
            </div>
          </section>

          {/* The conversation, in its own column so the inspector can stay open
              beside it — the same 26rem the sketcher gives it. */}
          {chatOpen && project && (
            <section className="flex min-h-0 shrink-0 flex-col xl:w-[34rem]">
              <header className="flex shrink-0 items-center gap-2 border-b px-1 pb-2">
                <SquareTerminal className="text-primary size-4 shrink-0" />
                <span className="text-sm font-semibold">{t('chat.claudeCode')}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  {canvasScreen?.name ?? (round ? `version ${round.version}` : 'design')}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {t('badge.localCli')}
                </Badge>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  title="Hide chat"
                  aria-label="Hide chat"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <PanelRightClose className="size-4" />
                </button>
              </header>

              {/* The chat scrolls itself, so it must not sit inside a scroller —
                  two nested scroll areas is how a message list stops following
                  the stream. */}
              {/* `flex flex-col` is load-bearing: ChatPane's root is `flex-1`,
                  which only resolves inside a flex parent — without it the pane
                  collapses to its content and the composer floats mid-panel
                  instead of sitting at the bottom. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-xl:h-[42rem]">
                <ChatPane
                  project={project}
                  contextText={designChatContext(markdown, system, componentId, round, target)}
                  folderLabel={round ? `version ${round.version}` : 'design'}
                  greeting={`Ask about ${system.name}`}
                  greetingHint="The whole DESIGN.md is in context, plus the selected component and which screens it applies to."
                  initialTurns={turns}
                  onPersist={(next) => {
                    setTurns(next);
                    if (version !== null) saveBoardChat(params.projectId, next, chatScope(version));
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
