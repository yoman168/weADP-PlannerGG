'use client';

/**
 * The Business workspace chrome: the toolbar, the version explorer and the
 * dialogs that add files to a version.
 *
 * It lives in the `/sketcher` layout rather than in a page, so opening a design
 * file swaps only the pane on the right — the project nav and the explorer stay
 * mounted, the way a file tree behaves in an editor. Pages read what they need
 * through `useBusinessWorkspace()`.
 */
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ScrollText,
  Code2,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  GitMerge,
  GripVertical,
  Lock,
  Search,
  Paperclip,
  PenLine,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { ChangeMark, changeLabel } from '@/components/we-adk/change-mark';
import { canPreviewLive } from '@/components/we-adk/live-screen-preview';
import { VERSION_STATUS_PILL } from '@/components/we-adk/version-rail';
import {
  businessEditHref,
  businessPreviewHref,
  previewHref,
} from '@/components/we-adk/mockup-board';
import { generateBuildsForRound } from '@/lib/we-adk-mock/build-seeds';
import {
  SURFACE_LABELS,
  loadSurfaces,
  otherSurface,
  resolveSurface,
  setSurface,
  type SurfaceKind,
  type SurfaceMap,
} from '@/lib/we-adk-mock/design-surface';
import { loadUploadedFiles, sessionFiles } from '@/lib/we-adk-mock/meeting-files';
import {
  designFolderKey,
  findProject,
  projectFolders,
  type DesignFile,
  type DesignFolder,
  type DesignProject,
} from '@/lib/we-adk-mock/projects';
import {
  addBlankDesign,
  loadGeneratedScreens,
  moveGeneratedScreen,
  removeGeneratedScreen,
  renameGeneratedScreen,
  reorderGeneratedScreen,
  type SeedPattern,
  type SketchScreen,
} from '@/lib/we-adk-mock/sketches';
import { BusinessActivityLog } from '@/components/we-adk/business-activity-log';
import {
  clearActivity,
  loadActivity,
  recordActivity,
  type ActivityEvent,
} from '@/lib/we-adk-mock/activity';
import { useLocale } from '@/lib/locale';
import {
  isBaselinePrototypeFile,
  isPrototypeFile,
  screenDisplayPath,
} from '@/lib/we-adk/prototype';
import { MainViewSwitch } from '@/components/we-adk/main-view-switch';
import { loadLastView, saveLastView } from '@/lib/we-adk/last-view';
import {
  versionChanges,
  writeSavedFile,
  writeSavedSnapshot,
  type FileDiff,
} from '@/lib/we-adk/version-diff';
import { type VersionStatus } from '@/lib/we-adk-mock/types';
import {
  addSubfolder,
  BASELINE_VERSION,
  cloneReleasedInto,
  createVersion as openNextRound,
  FIRST_EDITABLE_VERSION,
  isFolderLocked,
  isVersionLocked,
  loadVersionNames,
  versionDisplayName,
  loadRemovedVersions,
  loadSubfolders,
  loadVersionCount,
  loadVersionStatuses,
  otherVersionStatus,
  projectVersionFolders,
  removeSubfolder,
  renameSubfolder,
  reorderSubfolder,
  saveVersionCount,
  setVersionStatus,
  subfolderFolderId,
  subfolderStorageKey,
  versionFolderId,
  versionFolderKey,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';

const SEED_OPTIONS: { id: SeedPattern; labelKey: string }[] = [
  { id: 'listPage', labelKey: 'newDesign.listScreen' },
  { id: 'detailPage', labelKey: 'newDesign.detailScreen' },
  { id: 'dashboard', labelKey: 'newDesign.dashboard' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Where a folder's new files are written — absent on read-only folders. */
function targetKey(folder: DesignFolder): string | null {
  return folder.storageKey ?? null;
}

/**
 * The files every folder of this project holds, read from storage.
 *
 * Most writes touch one folder and the tree state is patched in place. Starting a
 * round is not one of those: it fills the round's root and every folder inside
 * it, and replaces stale carry-overs on the way, so the tree re-reads instead of
 * trying to guess which keys moved.
 */
function readCreatedFiles(project: DesignProject): Record<string, SketchScreen[]> {
  const loaded: Record<string, SketchScreen[]> = {};
  for (const session of project.sessions) {
    loaded[session.id] = loadGeneratedScreens(session.id);
  }
  const count = loadVersionCount(project.id);
  for (let version = FIRST_EDITABLE_VERSION; version <= count; version += 1) {
    const key = versionFolderKey(project.id, version);
    loaded[key] = loadGeneratedScreens(key);
    // …and the files inside each folder someone made in that round.
    for (const sub of loadSubfolders(project.id, version)) {
      const subKey = subfolderStorageKey(project.id, version, sub.id);
      loaded[subKey] = loadGeneratedScreens(subKey);
    }
  }
  loaded[designFolderKey(project.id)] = loadGeneratedScreens(designFolderKey(project.id));
  return loaded;
}

/* ------------------------------------------------------------------ */
/* What the pages inside the workspace can use                         */
/* ------------------------------------------------------------------ */

interface BusinessWorkspaceValue {
  project: DesignProject;
  /** Version folders, then the consolidated set and real screens. */
  folders: DesignFolder[];
  /** The folder the explorer has selected, or undefined for "everything". */
  activeFolder: DesignFolder | undefined;
  /** Design file the canvas pane currently has open, if any. */
  openScreenId: string | null;
  /** True when the active folder's version has been released — editing is locked. */
  isReleased: boolean;
  /** Per-file A / M marker against the round it was cut from, keyed by file id. */
  changes: Record<string, FileDiff>;
  /**
   * Records a round as it stands, which clears its A / M markers. Everything
   * changed after this reads as changed again.
   */
  saveRound: (version: number) => void;
  /**
   * Recompute the markers. The canvases they compare live in storage, which the
   * folder tree knows nothing about — so an editor that just saved has to say so
   * or the tree keeps showing what was true when it mounted.
   */
  refreshChanges: () => void;
  deleteFile: (file: DesignFile) => void;
  /** Save a single file's current state, clearing only its marker. */
  saveFile: (fileId: string) => void;
}

const WorkspaceContext = createContext<BusinessWorkspaceValue | null>(null);

export function useBusinessWorkspace(): BusinessWorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useBusinessWorkspace must be used inside the Business workspace.');
  return value;
}

/** Returns the workspace context when inside the Business workspace, or null outside it. */
export function useOptionalBusinessWorkspace(): BusinessWorkspaceValue | null {
  return useContext(WorkspaceContext);
}

/* ------------------------------------------------------------------ */
/* New design file                                                     */
/* ------------------------------------------------------------------ */

function NewDesignDialog({
  open,
  folders,
  defaultFolderId,
  onClose,
  onCreate,
}: {
  open: boolean;
  folders: DesignFolder[];
  defaultFolderId: string;
  onClose: () => void;
  onCreate: (folder: DesignFolder, screen: SketchScreen) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [route, setRoute] = useState('');
  const [seed, setSeed] = useState<SeedPattern>('listPage');

  useEffect(() => {
    if (open) {
      setName('');
      setRoute('');
      setSeed('listPage');
      setFolderId(defaultFolderId);
    }
  }, [open, defaultFolderId]);

  const selectedFolder = folders.find((folder) => folder.id === folderId) ?? null;

  const create = () => {
    const trimmed = name.trim();
    const key = selectedFolder ? targetKey(selectedFolder) : null;
    if (!trimmed || !selectedFolder || !key) return;
    const screen = addBlankDesign(
      key,
      { name: trimmed.slice(0, 80), route: route.trim() || undefined, seedPattern: seed },
      today(),
    );
    onCreate(selectedFolder, screen);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newDesign.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-name">{t('newDesign.name')}</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('newDesign.namePlaceholder')}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-folder">{t('newDesign.version')}</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger id="new-folder" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.kind === 'group' ? `\u2514 ${folder.name}` : folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFolder && (
              <p className="text-muted-foreground truncate text-xs">{selectedFolder.label}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-route">{t('newDesign.route')}</Label>
            <Input
              id="new-route"
              value={route}
              onChange={(event) => setRoute(event.target.value)}
              placeholder={t('newDesign.routePlaceholder')}
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={create} disabled={!name.trim() || !selectedFolder}>
            <PenLine />
            {t('newDesign.create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Explorer tree                                                       */
/* ------------------------------------------------------------------ */

/**
 * Versions are the top level of the tree — there is no project root row.
 *
 * The released round carries a green edge so the one that is actually out there
 * is findable without reading; every other row keeps a transparent edge of the
 * same width so nothing shifts.
 */
function rowClass(active: boolean, released = false, inProgress = false): string {
  return cn(
    'group/folder flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-xs',
    released && active
      ? 'border-emerald-500'
      : inProgress && active
        ? 'border-blue-500'
        : active
          ? 'border-primary'
          : 'border-transparent',
    active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
  );
}

/** The version chip in the tree — small enough to sit in a 16rem column. */
/**
 * The chip's hover, on top of the shared colours.
 *
 * Only the hover lives here: the tint and the ink come from
 * `VERSION_STATUS_PILL`, which the rounds rail uses too. Restating them would
 * let the tree and the rail drift into two different blues for one round —
 * this chip is a button and the rail's is not, so the hover is the only part
 * that differs.
 */
const VERSION_STATUS_HOVER: Record<VersionStatus, string> = {
  Released: 'hover:bg-emerald-200 dark:hover:bg-emerald-500/25',
  'In progress': 'hover:bg-blue-200 dark:hover:bg-blue-500/25',
};

function folderIcon(folder: DesignFolder, open: boolean) {
  if (folder.kind === 'design') return GitMerge;
  return open ? FolderOpen : Folder;
}

/* ------------------------------------------------------------------ */
/* One design file in the tree                                         */
/* ------------------------------------------------------------------ */

/**
 * A file row, used at both levels: straight inside a version, and inside a
 * folder someone made within one.
 */
const FILE_DRAG_MIME = 'application/x-we-adk-file';

/**
 * What is being dragged right now.
 *
 * Not state — it is read during dragover, where the payload is deliberately
 * unreadable: a browser exposes `types` but not `getData` mid-drag, so a row cannot
 * ask "did this come from my folder?" from the event alone. Without knowing that, a
 * row either claims every drop — swallowing moves from other folders, since a row
 * covers most of a folder's area — or claims none and cannot reorder at all.
 */
let draggingFile: { fileId: string; sourceKey?: string } | null = null;
const FOLDER_DRAG_MIME = 'application/x-we-adk-folder';

function FileRow({
  file,
  folder,
  projectId,
  openScreenId,
  released,
  change,
  surface,
  onSurface,
  onDelete,
  onRename,
  index,
  onReorder,
}: {
  file: DesignFile;
  folder: DesignFolder;
  projectId: string;
  openScreenId: string | null;
  /** The round's status. Passed in: a folder inside a version has none of its own. */
  released: boolean;
  /** How this file differs from the round it was cut from. */
  change?: FileDiff;
  /** Whether this design is a screen or a popup over one. */
  surface: SurfaceKind;
  /** Flips it. Absent on a released round, where nothing can be re-marked. */
  onSurface?: (file: DesignFile, next: SurfaceKind) => void;
  onDelete?: (file: DesignFile) => void;
  onRename?: (file: DesignFile, newName: string) => void;
  /**
   * Where this row sits in its folder, and how to put a dropped file here.
   * Dropping onto a folder already moved files between folders; this is the other
   * half — dropping between two files to change the order inside one.
   */
  index: number;
  onReorder?: (fileId: string, toIndex: number) => void;
}) {
  const { t } = useLocale();
  const isOpen = openScreenId === file.id;
  // Baseline files ARE the prototype html; a round's files are html pages of
  // that prototype too, so both read the same way in the tree.
  const isHtml = isPrototypeFile(file.id) || file.fileName.endsWith('.html');
  // The baseline is the prototype itself and a released round has shipped —
  // neither is edited from here.
  const readOnly = released || isBaselinePrototypeFile(file.id);
  // Every version opens preview-first, version 2 included: a round is looked at
  // far more often than it is drawn, and the canvas is a click away in the
  // preview's own Preview/Edit tabs.
  const openHref = businessPreviewHref(projectId, file.id, folder.id);
  const live = canPreviewLive(file.id);

  const draggable = !released && !!file.sessionId;
  const [isDragging, setIsDragging] = useState(false);
  /** Which edge a dragged file is hovering, or null when it is elsewhere. */
  const [dropEdge, setDropEdge] = useState<'above' | 'below' | null>(null);

  /** Above or below, decided by which half of the row the pointer is in. */
  const edgeUnder = (event: React.DragEvent): 'above' | 'below' => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientY - box.top < box.height / 2 ? 'above' : 'below';
  };

  /** Whether this row should take the drop: a file from this same folder. */
  const isReorderTarget = (event: React.DragEvent): boolean =>
    !!onReorder &&
    !released &&
    event.dataTransfer.types.includes(FILE_DRAG_MIME) &&
    draggingFile !== null &&
    draggingFile.fileId !== file.id &&
    draggingFile.sourceKey === file.sessionId;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(
          FILE_DRAG_MIME,
          JSON.stringify({ fileId: file.id, sourceKey: file.sessionId }),
        );
        e.dataTransfer.effectAllowed = 'move';
        draggingFile = {
          fileId: file.id,
          ...(file.sessionId ? { sourceKey: file.sessionId } : {}),
        };
        requestAnimationFrame(() => setIsDragging(true));
      }}
      onDragEnd={() => {
        draggingFile = null;
        setIsDragging(false);
      }}
      onDragOver={(e) => {
        if (!isReorderTarget(e)) return;
        // Claimed, so the folder underneath does not read it as a move-into-folder
        // and leave the order untouched.
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropEdge(edgeUnder(e));
      }}
      onDragLeave={() => setDropEdge(null)}
      onDrop={(e) => {
        setDropEdge(null);
        // A file from another folder is a move, not a reorder — left to bubble to
        // the folder, which is what handles moves.
        if (!isReorderTarget(e) || !draggingFile) return;
        e.preventDefault();
        e.stopPropagation();
        onReorder?.(draggingFile.fileId, edgeUnder(e) === 'above' ? index : index + 1);
      }}
      className={cn(
        'group/file relative flex w-full items-center pr-1.5 transition-opacity duration-200',
        isOpen ? 'bg-primary/10 text-key-accent' : 'text-muted-foreground hover:bg-muted/50',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      {/* Where it would land. */}
      {dropEdge === 'above' && (
        <div className="bg-primary absolute top-0 right-2 left-2 z-10 h-0.5 rounded-full" />
      )}
      {dropEdge === 'below' && (
        <div className="bg-primary absolute right-2 bottom-0 left-2 z-10 h-0.5 rounded-full" />
      )}
      {draggable && (
        <GripVertical className="text-muted-foreground/40 size-3 shrink-0 opacity-0 transition-opacity group-hover/file:opacity-100" />
      )}
      <Link
        href={openHref}
        aria-current={isOpen ? 'page' : undefined}
        // The change state is in here too, so an unmarked row says why it is
        // unmarked. A blank column otherwise reads as "not computed yet"
        // rather than "carried over and identical", which is what it means.
        // Popup is named here as well: the icon is the only thing carrying it on
        // the row, and an icon is recognised rather than read.
        title={`${file.name}${file.route ? ` · ${screenDisplayPath(file.id, file.route) || file.route}` : ''}${
          surface === 'popup' ? ` · ${SURFACE_LABELS.popup}` : ''
        }${live ? ` · ${t('file.liveScreen')}` : ''}${
          change ? ` · ${changeLabel(t, change)}` : ''
        }${released ? ` ${t('file.releasedReadOnly')}` : ''}`}
        className={cn(
          // Tighter left padding and a tighter gap than the other rows, to pay
          // for the letter slot without pushing every filename right.
          'flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 text-xs',
          isOpen ? 'font-medium' : 'hover:text-foreground',
        )}
      >
        {/* The surface marker: `P` alone, at the head of the row, in the same
            mono-letter language the A / M marker uses at the other end. No glyph
            beside it — the row already carries one for the file type, and a
            second icon a few pixels away read as a pair of unrelated symbols
            rather than as one marker.

            The slot is always this wide and only sometimes inked. A marker that
            appeared and disappeared would shift every filename in the tree
            depending on what the row happened to be, which reads as a tree that
            cannot keep its columns straight. */}
        <span
          aria-hidden={surface !== 'popup'}
          title={surface === 'popup' ? SURFACE_LABELS.popup : undefined}
          className={cn(
            'w-3 shrink-0 text-center font-mono text-[10px] font-semibold',
            surface === 'popup' && 'text-violet-600 dark:text-violet-400',
          )}
        >
          {surface === 'popup' ? 'P' : ''}
        </span>
        {/* The glyph stays about the file, not about the surface: `</>` means
            this one is html, and a popup that lost that lost a fact the row was
            already carrying. */}
        {isHtml ? (
          <Code2 className="size-3.5 shrink-0" />
        ) : (
          <FileCode2 className="size-3.5 shrink-0" />
        )}
        <span className={cn('min-w-0 flex-1 truncate font-mono', released && 'opacity-60')}>
          {file.fileName}
        </span>
        {/* No popup chip here. It sat in this slot, and a filled pill next to a
            single coloured letter wins every time — the A / M is the marker
            people scan a round for, and it was being crowded out by a fact that
            the icon at the head of the row already carries. */}
        {/* A / M, the way a diff marks it — against the round this one was cut
            from. An untouched carry-over shows nothing, so the changed files
            are the ones that stand out. */}
        <ChangeMark diff={change} />
        {released && <Lock className="size-2.5 shrink-0 opacity-40" />}
      </Link>
      {!readOnly && (onRename || onDelete) && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/file:opacity-100">
          {onRename && (
            <button
              type="button"
              onClick={() => {
                const newName = window.prompt('Rename file:', file.name);
                if (newName && newName.trim() && newName.trim() !== file.name) {
                  onRename(file, newName.trim());
                }
              }}
              title={`Rename ${file.fileName}`}
              aria-label={`Rename ${file.fileName}`}
              className="text-muted-foreground/60 hover:text-foreground rounded p-0.5"
            >
              <PenLine className="size-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(file)}
              title={`Delete ${file.fileName}`}
              aria-label={`Delete ${file.fileName}`}
              className="text-muted-foreground/60 hover:text-destructive rounded p-0.5"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The chrome itself                                                   */
/* ------------------------------------------------------------------ */

export function BusinessWorkspace({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const project = findProject(params.projectId);

  const openScreenId = searchParams.get('screen');
  const folderParam = searchParams.get('folder');

  const [created, setCreated] = useState<Record<string, SketchScreen[]>>({});
  const [versionCount, setVersionCount] = useState(BASELINE_VERSION);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([versionFolderId(BASELINE_VERSION)]),
  );
  /**
   * Which path segments are folded, for the parts of the tree that are drawn
   * rather than stored.
   *
   * A folder's own open state lives in `expanded`, keyed by its id. The
   * segments above it have no id — they exist only because a folder name
   * carries a path — so they are keyed by that path instead, and start open.
   */
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const togglePath = (path: string) =>
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const [referenceCount, setReferenceCount] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  /** Narrows the round's files by name or route. */
  const [fileQuery, setFileQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  /** The round's own history, and whether it is what the main pane is showing. */
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [versionStatuses, setVersionStatuses] = useState<VersionStatuses>({});
  const [removedVersions, setRemovedVersions] = useState<number[]>([]);
  /** Which designs are popups rather than screens, keyed by canvas id. */
  const [surfaces, setSurfaces] = useState<SurfaceMap>({});
  /** Bumped when a folder inside a version is added or removed. */
  const [folderRevision, setFolderRevision] = useState(0);
  /** Subfolder id currently being renamed inline. */
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [removingSubfolder, setRemovingSubfolder] = useState<DesignFolder | null>(null);
  /** Folder id currently being hovered during a file drag. */
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  /** Folder id being hovered during a folder reorder drag. */
  const [folderDropTarget, setFolderDropTarget] = useState<string | null>(null);
  /** Position indicator: 'above' or 'below' the target folder. */
  const [folderDropPos, setFolderDropPos] = useState<'above' | 'below'>('below');

  // Files the user created are workspace state, so load them after mount.
  useEffect(() => {
    if (!project) return;
    let references = 0;
    for (const session of project.sessions) {
      references += sessionFiles(session.id, loadUploadedFiles(session.id)).length;
    }
    setCreated(readCreatedFiles(project));
    setVersionCount(loadVersionCount(project.id));
    setReferenceCount(references);
    setVersionStatuses(loadVersionStatuses(project.id));
    setRemovedVersions(loadRemovedVersions(project.id));
    setSurfaces(loadSurfaces(project.id));
    setActivity(loadActivity(project.id));
  }, [project]);

  // The explorer is organised by version, plus the consolidated design set once
  // it exists. Meeting folders and the captured production screens are not here:
  // the meetings are their own tab, and the live screens live on Research and in
  // the production console.
  const folders = useMemo(() => {
    if (!project) return [];
    return [
      ...projectVersionFolders(project, created, versionCount, versionStatuses, removedVersions),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, created, versionCount, versionStatuses, removedVersions, folderRevision]);

  const allFiles = useMemo(() => folders.flatMap((folder) => folder.files), [folders]);

  /**
   * Record what is in view, so leaving the tab and coming back returns to it: the
   * folder, the file open inside it, and which folders are unfolded.
   *
   * Recording only. Restoring the folder and file belongs to the page that already
   * decides where an arrival with no folder should land — two effects both calling
   * router.replace would race, and whichever lost would leave the URL wrong.
   */
  useEffect(() => {
    if (!project || !folderParam) return;
    saveLastView(project.id, { folder: folderParam, screen: openScreenId });
  }, [project, folderParam, openScreenId]);

  /**
   * The folder in view is unfolded in the tree.
   *
   * Landing on a file in version 2 while the tree showed version 1 open and
   * version 2 shut was the other half of losing your place: the URL was right and
   * the explorer disagreed with it. Keyed on the folder changing, so collapsing the
   * folder you are in stays collapsed rather than springing open again.
   */
  const unfolded = useRef<string | null>(null);
  useEffect(() => {
    if (!folderParam || unfolded.current === folderParam) return;
    unfolded.current = folderParam;
    setExpanded((current) => {
      const next = new Set(current);
      next.add(folderParam);
      // A subfolder is `version-2--sf-…`; its round has to be open to see it.
      const parent = folderParam.split('--')[0];
      if (parent) next.add(parent);
      return next;
    });
  }, [folderParam]);

  /**
   * The tree's shape, restored once and then recorded as it changes.
   *
   * `expanded` starts from the baseline folder during render — reading storage there
   * would make the server and the browser disagree — so the remembered set is
   * applied here instead. The guard matters: without it the recording effect would
   * fire first with that default and overwrite what it was about to restore.
   */
  const treeRestored = useRef(false);
  useEffect(() => {
    if (!project) return;
    if (!treeRestored.current) {
      treeRestored.current = true;
      const remembered = loadLastView(project.id).expanded;
      if (remembered.length > 0) setExpanded(new Set(remembered));
      return;
    }
    saveLastView(project.id, { expanded: [...expanded] });
  }, [project, expanded]);

  /**
   * A / M markers, against the round each file was cut from. Computed in an
   * effect because it reads the canvases out of workspace state: doing it during
   * render would make the server and the browser disagree about every badge.
   */
  const [changes, setChanges] = useState<Record<string, FileDiff>>({});
  /** Bumped whenever something the markers are derived from may have moved. */
  const [diffRevision, setDiffRevision] = useState(0);
  const refreshChanges = useCallback(() => setDiffRevision((count) => count + 1), []);
  useEffect(() => {
    if (!project) return;
    setChanges(versionChanges(project.id, folders));
    // The canvases, layouts and saved snapshot all live in storage rather than
    // in `folders`, so the revision — and navigating to another file, which is
    // the other moment an edit could have happened — are dependencies too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, folders, diffRevision, openScreenId, folderParam]);

  if (!project) return <>{children}</>;

  // Mini mockup projects skip the explorer — they use their own meeting layout
  if (project.archived) {
    return (
      <WorkspaceContext.Provider
        value={{
          project,
          folders: [],
          activeFolder: undefined,
          isReleased: false,
          changes: {},
          saveRound: () => {},
          saveFile: () => {},
          deleteFile: () => {},
          openScreenId: null,
          refreshChanges: () => {},
        }}
      >
        {children}
      </WorkspaceContext.Provider>
    );
  }

  const editableVersions = folders
    .filter(
      (folder) =>
        folder.kind === 'version' &&
        folder.versionNumber !== BASELINE_VERSION &&
        folder.versionStatus !== 'Released',
    )
    // A file can be created straight into a folder inside the round, so the
    // picker offers those as targets too, listed under their version.
    .flatMap((folder) => [folder, ...(folder.children ?? [])]);
  /** The round still open, if there is one — only one runs at a time. */
  const openVersion =
    [...folders]
      .reverse()
      .find(
        (folder) =>
          folder.kind === 'version' &&
          folder.versionNumber !== BASELINE_VERSION &&
          folder.versionStatus === 'In progress',
      )?.versionNumber ?? null;
  /** Every folder in the tree, versions and the folders inside them. */
  const flatFolders = folders.flatMap((folder) => [folder, ...(folder.children ?? [])]);
  const activeFolder = folderParam
    ? flatFolders.find((folder) => folder.id === folderParam)
    : undefined;

  /**
   * The rounds the rail lists, newest first — the order Developer's rail uses,
   * so the same project reads the same way on both tabs.
   */
  const railRounds = folders
    .map((folder) => folder.versionNumber)
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => b - a);

  /** Design files per round, folders inside it included. */
  const railCounts = Object.fromEntries(
    folders
      .filter((folder) => folder.versionNumber !== undefined)
      .map((folder) => [
        folder.versionNumber as number,
        folder.files.length +
          (folder.children ?? []).reduce((sum, child) => sum + child.files.length, 0),
      ]),
  );

  /**
   * Which round the tree is showing.
   *
   * The rail owns the choice and the tree shows one round's files, rather than
   * every round nested inside one scroller. Twenty-odd files per round across
   * five rounds is a tree nobody can hold in their head, and the round is the
   * unit people actually work in.
   *
   * Falls back rather than being seeded in state: the rounds are read from
   * storage after mount, so a stored default would be a number chosen before
   * the list existed. The round in view wins, then the one still open, then the
   * newest.
   */
  const railVersion =
    activeFolder?.versionNumber ??
    railRounds.find((round) => !isVersionLocked(round, versionStatuses)) ??
    railRounds[0] ??
    null;

  /**
   * The round on screen, with the search applied to its files.
   *
   * Filtered here rather than inside the rows, so a folder whose files all fail
   * the query goes with them — an empty folder left behind reads as a folder
   * that has nothing in it. The round's own row stays either way: it is what
   * says which round you are searching.
   */
  const shownFolders = folders
    .filter((folder) => folder.versionNumber === railVersion)
    .map((folder) => {
      const needle = fileQuery.trim().toLowerCase();
      if (needle === '') return folder;
      const matches = (file: DesignFile) =>
        file.fileName.toLowerCase().includes(needle) ||
        file.name.toLowerCase().includes(needle) ||
        (file.route ?? '').toLowerCase().includes(needle);
      return {
        ...folder,
        files: folder.files.filter(matches),
        children: (folder.children ?? [])
          .map((child) => ({ ...child, files: child.files.filter(matches) }))
          .filter((child) => child.files.length > 0),
      };
    });

  const base = `/we-adk/projects/${project.id}/sketcher`;
  const boardHref = `${base}/board`;
  const filesHref = activeFolder ? `${base}?folder=${activeFolder.id}` : base;

  /**
   * Says it once, and keeps it.
   *
   * The toast and the log are the same sentence — recording here rather than at
   * each of the sixteen call sites means a new outcome cannot be announced and
   * then quietly left out of the record. Refusals are kept too: "release it
   * first" explains why nothing happened, which is the question the log gets
   * asked afterwards.
   */
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
    if (project) setActivity(recordActivity(project.id, message, railVersion ?? undefined));
  };

  const registerCreated = (folder: DesignFolder, screen: SketchScreen) => {
    const key = targetKey(folder);
    if (!key) return;
    setCreated((current) => ({ ...current, [key]: [...(current[key] ?? []), screen] }));
  };

  /** Save: this round is what it should be, so nothing in it counts as changed. */
  const saveRound = (version: number) => {
    const round = folders.find(
      (folder) => folder.kind === 'version' && folder.versionNumber === version,
    );
    if (!round || isFolderLocked(round)) return;
    const files = [...round.files, ...(round.children ?? []).flatMap((child) => child.files)];
    // The pre-save markers say what this round actually changed — read before
    // the snapshot write clears them. Completing the round is what raises
    // builds: Claude puts one on the Developer tab per file of new work, task
    // included. Idempotent, so completing again only covers what moved since.
    const builds = generateBuildsForRound(project.id, version, files, today(), changes);
    writeSavedSnapshot(project.id, version, files, today());
    refreshChanges();
    flash(
      builds.length > 0
        ? `${round.name} completed — Claude generated ${builds.length} build${
            builds.length === 1 ? '' : 's'
          } for the Developer tab.`
        : t('flash.saved', { name: round.name }),
    );
  };

  /** Save a single file, clearing only its marker. */
  const saveFile = (fileId: string) => {
    const folder = flatFolders.find((f) => f.files.some((d) => d.id === fileId));
    if (!folder || isFolderLocked(folder)) return;
    const file = folder.files.find((d) => d.id === fileId);
    const version = folder.versionNumber;
    if (!file || version === undefined) return;
    writeSavedFile(project.id, version, file, today());
    refreshChanges();
    flash(t('flash.saved', { name: file.fileName }));
  };

  const handleFileDrop = (e: React.DragEvent, targetFolder: DesignFolder) => {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData(FILE_DRAG_MIME);
    if (!raw) return;
    try {
      const { fileId } = JSON.parse(raw) as { fileId: string };
      moveFileToFolder(fileId, targetFolder);
    } catch {
      /* ignore */
    }
  };

  /** Props for a subfolder row to make it draggable for reordering. */
  const folderDragProps = (child: DesignFolder) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      const subId = child.id.split('--')[1];
      const version = child.versionNumber;
      if (!subId || version === undefined) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData(FOLDER_DRAG_MIME, JSON.stringify({ subId, version }));
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      setFolderDropTarget(null);
    },
  });

  /** Combined drag-over/drop props for a subfolder: handles both file drops and folder reordering. */
  const subfolderDropProps = (child: DesignFolder, _index: number) => ({
    onDragOver: (e: React.DragEvent) => {
      const isFolder = e.dataTransfer.types.includes(FOLDER_DRAG_MIME);
      const isFile = e.dataTransfer.types.includes(FILE_DRAG_MIME);
      if (!isFolder && !isFile) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (isFolder) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setFolderDropPos(e.clientY < midY ? 'above' : 'below');
        setFolderDropTarget(child.id);
      } else {
        setDropTarget(child.id);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        setDropTarget((prev) => (prev === child.id ? null : prev));
        setFolderDropTarget((prev) => (prev === child.id ? null : prev));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Try folder reorder first.
      const folderRaw = e.dataTransfer.getData(FOLDER_DRAG_MIME);
      if (folderRaw) {
        setFolderDropTarget(null);
        try {
          const { subId, version } = JSON.parse(folderRaw) as { subId: string; version: number };
          if (child.versionNumber !== version) return;
          const targetSubId = child.id.split('--')[1];
          if (!targetSubId || subId === targetSubId) return;
          const children =
            folders.find((f) => f.kind === 'version' && f.versionNumber === version)?.children ??
            [];
          const targetIdx = children.findIndex((c) => c.id === child.id);
          const toIndex = folderDropPos === 'below' ? targetIdx + 1 : targetIdx;
          reorderSubfolder(project.id, version, subId, toIndex);
          setFolderRevision((c) => c + 1);
        } catch {
          /* ignore */
        }
        return;
      }
      // Otherwise handle file drop.
      handleFileDrop(e, child);
    },
  });

  const dropProps = (folder: DesignFolder) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(FILE_DRAG_MIME)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(folder.id);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        setDropTarget((prev) => (prev === folder.id ? null : prev));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.stopPropagation();
      handleFileDrop(e, folder);
    },
  });

  /** Move a file from its current folder to another folder within the same version. */
  /**
   * A file's place within its own folder.
   *
   * The baseline and released rounds are read-only, so their order is not ours to
   * change — the same check every other write in this tree makes.
   */
  const reorderFile = (folder: DesignFolder, fileId: string, toIndex: number) => {
    if (isFolderLocked(folder)) return;
    const key = targetKey(folder);
    if (!key) return;
    const next = reorderGeneratedScreen(key, fileId, toIndex);
    setCreated((current) => ({ ...current, [key]: next }));
  };

  const moveFileToFolder = (fileId: string, targetFolder: DesignFolder) => {
    // Find the source folder.
    const sourceFolder = flatFolders.find((f) => f.files.some((d) => d.id === fileId));
    if (!sourceFolder || !sourceFolder.storageKey || isFolderLocked(sourceFolder)) return;
    if (!targetFolder.storageKey || isFolderLocked(targetFolder)) return;
    if (sourceFolder.storageKey === targetFolder.storageKey) return;
    const moved = moveGeneratedScreen(
      sourceFolder.storageKey,
      targetFolder.storageKey,
      fileId,
      today(),
    );
    if (!moved) return;
    // Refresh the created-files state so the tree re-renders.
    setCreated((current) => ({
      ...current,
      [sourceFolder.storageKey!]: (current[sourceFolder.storageKey!] ?? []).filter(
        (s) => s.id !== fileId,
      ),
      [targetFolder.storageKey!]: [
        ...(current[targetFolder.storageKey!] ?? []).filter((s) => s.id !== fileId),
        moved,
      ],
    }));
    flash(t('flash.moved', { name: moved.name, folder: targetFolder.name }));
  };

  const deleteFile = (file: DesignFile) => {
    if (!file.sessionId) return;
    // A round that shipped keeps its files. Folders inside a round carry the
    // round's status, so a file tucked into one is covered by the same check.
    const owningFolder = flatFolders.find((f) => f.files.some((d) => d.id === file.id));
    if (owningFolder && isFolderLocked(owningFolder)) return;
    const next = removeGeneratedScreen(file.sessionId, file.id);
    setCreated((current) => ({ ...current, [file.sessionId as string]: next }));
    flash(t('flash.deleted', { name: file.fileName }));
    if (openScreenId === file.id) router.replace(filesHref, { scroll: false });
  };

  const renameFile = (file: DesignFile, newName: string) => {
    if (!file.sessionId) return;
    const next = renameGeneratedScreen(file.sessionId, file.id, newName);
    setCreated((current) => ({ ...current, [file.sessionId as string]: next }));
    flash(`Renamed to ${newName}`);
  };

  /** Opens the new-file dialog with a folder inside a version preselected. */
  const startNewDesignIn = (folder: DesignFolder) => {
    setExpanded((current) => new Set(current).add(folder.id));
    selectFolder(folder.id);
    setNewOpen(true);
  };

  /** Creates a folder inside a round with a placeholder name, then enters rename mode. */
  const createSubfolder = (parent: DesignFolder) => {
    if (parent.versionNumber === undefined) return;
    const sub = addSubfolder(project.id, parent.versionNumber, 'New folder', today());
    setFolderRevision((count) => count + 1);
    const id = subfolderFolderId(parent.versionNumber, sub.id);
    setExpanded((current) => new Set(current).add(parent.id).add(id));
    selectFolder(id);
    setEditingFolderId(id);
    setEditingFolderName('');
  };

  const startRenamingFolder = (child: DesignFolder) => {
    setEditingFolderId(child.id);
    setEditingFolderName(child.name);
  };

  const commitRenameFolder = (child: DesignFolder) => {
    const subId = child.id.split('--')[1];
    const version = child.versionNumber;
    if (!subId || version === undefined) {
      setEditingFolderId(null);
      return;
    }
    const trimmed = editingFolderName.trim();
    if (trimmed && trimmed !== child.name) {
      renameSubfolder(project.id, version, subId, trimmed);
      setFolderRevision((c) => c + 1);
    }
    setEditingFolderId(null);
  };

  /** Empty folders go quietly; one with files in it asks first. */
  const askRemoveSubfolder = (folder: DesignFolder) => {
    if (isFolderLocked(folder)) {
      flash(t('flash.roundReleased', { name: `version ${folder.versionNumber}` }));
      return;
    }
    if (folder.files.length > 0) {
      setRemovingSubfolder(folder);
      return;
    }
    dropSubfolder(folder);
  };

  const dropSubfolder = (folder: DesignFolder) => {
    if (isFolderLocked(folder)) return;
    const version = folder.versionNumber;
    const subId = folder.id.split('--')[1];
    if (version === undefined || !subId) return;
    removeSubfolder(project.id, version, subId);
    setRemovingSubfolder(null);
    setFolderRevision((count) => count + 1);
    if (activeFolder?.id === folder.id) selectFolder(null);
    flash(t('flash.removed', { name: folder.name }));
  };

  /** Keeps the tree selection in the URL, so it survives opening a file. */
  const selectFolder = (nextId: string | null) => {
    const query = nextId ? `?folder=${nextId}` : '';
    router.replace(`${base}${query}`, { scroll: false });
  };

  const toggleFolder = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFolder = (folder: DesignFolder) => {
    setExpanded((current) => new Set(current).add(folder.id));
    selectFolder(folder.id);
  };

  /**
   * Adds the next version folder and selects it. Version 1 stays the baseline.
   *
   * A new round starts as a copy of the previous version — its files, and the
   * folders it was organised into with the files in them — so it opens with
   * everything the team has so far rather than empty.
   */
  /**
   * Opens the next round, filled from the round that shipped, and selects it.
   *
   * A round still in progress is never the source, so if nothing has been
   * completed the folder opens empty — and says so, rather than looking like a
   * copy that silently failed.
   */
  const createVersion = (name = '') => {
    const opened = openNextRound(project, { name, today: today() });
    setVersionCount(Math.max(versionCount, opened.version));

    const cloned = opened.copy;
    if (cloned && (cloned.screens.length > 0 || cloned.folders > 0)) {
      setCreated(readCreatedFiles(project));
      // The copy opened folders inside the round, which the tree only re-reads
      // when it is told they changed.
      setFolderRevision((count) => count + 1);
      flash(
        t(cloned.folders > 0 ? 'flash.clonedFolders' : 'flash.cloned', {
          version: opened.version,
          from: cloned.from,
          count: cloned.screens.length,
          folders: cloned.folders,
        }),
      );
    } else {
      flash(t('flash.versionOpened', { name: opened.name ?? `version ${opened.version}` }));
    }

    const id = versionFolderId(opened.version);
    setExpanded((current) => new Set(current).add(id));
    selectFolder(id);
  };

  /** Marks a design a screen or a popup, and says which it now is. */
  const markSurface = (file: DesignFile, next: SurfaceKind) => {
    setSurfaces(setSurface(project.id, file.id, next));
    flash(t('flash.markedAs', { name: file.fileName, kind: SURFACE_LABELS[next].toLowerCase() }));
  };

  /**
   * The baseline takes no new files, so adding one opens version 2 on demand.
   * Unnamed: this is a side effect of adding a design, not a decision to start
   * a round, so it must not stop to ask what to call one.
   */
  const ensureEditableVersion = () => {
    if (editableVersions.length === 0) createVersion();
  };

  /**
   * Brings the released round's designs into an open one that was started
   * without them — the same copy the create path makes, on demand.
   */
  const carryOver = (folder: DesignFolder) => {
    if (folder.versionNumber === undefined) return;
    // The copy itself refuses a round that shipped; saying so beats reporting it
    // as up to date, which is what a refusal read as before.
    if (isFolderLocked(folder)) {
      flash(t('flash.roundReleased', { name: folder.name }));
      return;
    }
    const cloned = cloneReleasedInto(project, folder.versionNumber, today());
    if (!cloned || (cloned.screens.length === 0 && cloned.folders === 0)) {
      flash(t('flash.upToDate', { name: folder.name, version: cloned?.from ?? '' }));
      return;
    }
    setCreated(readCreatedFiles(project));
    setFolderRevision((count) => count + 1);
    setExpanded((current) => new Set(current).add(folder.id));
    flash(
      t(cloned.folders > 0 ? 'flash.carriedOverFolders' : 'flash.carriedOver', {
        count: cloned.screens.length,
        from: cloned.from,
        folders: cloned.folders,
      }),
    );
  };

  /** Empty rounds go straight away; one with files in it asks first. */
  /** Flips a version between released and in progress, and says which it is now. */
  const moveVersionStatus = (version: number | undefined, current: VersionStatus) => {
    if (version === undefined) return;
    const next = otherVersionStatus(current);
    setVersionStatuses(setVersionStatus(project.id, version, next));
    // Releasing is completing the round by another door, so it raises the
    // same builds. Idempotent per design file — a round completed from the
    // folder header first has nothing left to raise here.
    if (next === 'Released') {
      const round = folders.find(
        (folder) => folder.kind === 'version' && folder.versionNumber === version,
      );
      const files = round
        ? [...round.files, ...(round.children ?? []).flatMap((child) => child.files)]
        : [];
      const builds = generateBuildsForRound(project.id, version, files, today(), changes);
      if (builds.length > 0) {
        flash(
          `Version ${version} released — Claude generated ${builds.length} build${
            builds.length === 1 ? '' : 's'
          } for the Developer tab.`,
        );
        return;
      }
    }
    flash(t('status.versionStatus', { version, status: next.toLowerCase() }));
    window.dispatchEvent(new Event('we-adk:version-status'));
  };

  const startNewDesign = () => {
    ensureEditableVersion();
    setNewOpen(true);
  };

  const defaultTargetId =
    activeFolder && editableVersions.some((folder) => folder.id === activeFolder.id)
      ? activeFolder.id
      : (editableVersions.at(-1)?.id ?? versionFolderId(FIRST_EDITABLE_VERSION));

  const value: BusinessWorkspaceValue = {
    project,
    folders,
    activeFolder,
    openScreenId,
    isReleased: activeFolder?.versionStatus === 'Released',
    changes,
    saveRound,
    refreshChanges,
    deleteFile,
    saveFile,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1">
          {/* The rounds rail is not here: it belongs to the Business layout, on
              the left of the tab bar rather than inside one tab's view. It
              navigates by `?folder=`, which is the same query this explorer
              reads, so the two stay in step without talking to each other. */}

          {/* Explorer — the files of the round the rail has selected. It is
              mounted by the layout, so opening a design file never takes it off
              screen. */}
          <aside
            className="bg-background flex w-64 shrink-0 flex-col border-r"
            onDragEnd={() => {
              setDropTarget(null);
              setFolderDropTarget(null);
            }}
          >
            {/* The Build list's header, borrowed: the round's name at reading
                size with its file count beside it, and the actions as icons on
                the right. The old strip put a 10px uppercase "EXPLORER" here,
                which named the panel rather than what is in it — and the panel
                is the one thing the reader can already see. */}

            {/* Which reading of the round is on the right. It sits in the
                explorer rather than in one pane's header because Main lands on
                a file preview, not on the file list — a switch in the listing's
                header is one most visits never reach. */}
            <div className="shrink-0 border-b px-3 py-2">
              <MainViewSwitch projectId={project.id} active="files" folderId={activeFolder?.id} />
            </div>

            {/* Same search the Build list has. A round carries twenty-odd files
                and the tree only truncates their names, so finding one by eye
                means reading every row. */}
            <div className="relative shrink-0 border-b px-3 py-2">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2"
              />
              <Input
                value={fileQuery}
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder={t('explorer.searchFiles')}
                aria-label={t('explorer.searchFiles')}
                className="h-8 pl-7 text-xs"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {/* One round at a time — the rail on the left chooses which. The
                  row is still here rather than replaced by the rail's: it is
                  what carries the drop target, the release control and the file
                  count, and those belong next to the files they act on. */}
              {shownFolders.map((folder) => {
                const open = expanded.has(folder.id);
                const selected = activeFolder?.id === folder.id && !openScreenId;
                const Icon = folderIcon(folder, open);
                const baseline = folder.versionNumber === BASELINE_VERSION;
                const status = folder.versionStatus;
                return (
                  <div key={folder.id}>
                    <div
                      {...(folder.storageKey && !isFolderLocked(folder) ? dropProps(folder) : {})}
                      className={cn(
                        rowClass(selected, status === 'Released', status === 'In progress'),
                        'transition-colors duration-200',
                        dropTarget === folder.id && 'bg-primary/10',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFolder(folder.id)}
                        aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
                        aria-expanded={open}
                        className="hover:text-foreground shrink-0"
                      >
                        {open ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openFolder(folder)}
                        aria-pressed={selected}
                        title={folder.label}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span
                          className={cn('flex-1 truncate font-mono', selected && 'font-medium')}
                        >
                          {folder.name}
                        </span>
                        {baseline && (
                          <Lock className="size-2.5 shrink-0" aria-label={t('file.readOnly')} />
                        )}
                        {baseline && referenceCount > 0 && (
                          <span
                            className="flex shrink-0 items-center gap-0.5 text-[10px]"
                            title={`${referenceCount} reference files across the meetings`}
                          >
                            <Paperclip className="size-2.5" />
                            {referenceCount}
                          </span>
                        )}
                      </button>

                      {/* Action buttons next to the folder name — hidden when released */}
                      {status !== 'Released' && (
                        <div
                          className="ml-auto flex shrink-0 items-center gap-0.5"
                          style={{ opacity: 1 }}
                        >
                          <button
                            type="button"
                            onClick={startNewDesign}
                            title={t('explorer.newFile')}
                            aria-label={t('explorer.newFile')}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
                          >
                            <FilePlus className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => createSubfolder(folder)}
                            title={`New folder inside ${folder.name}`}
                            aria-label={`New folder inside ${folder.name}`}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
                          >
                            <FolderPlus className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (project) setActivity(loadActivity(project.id));
                              setShowActivity(true);
                            }}
                            title="Activity log"
                            aria-label="Activity log"
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
                          >
                            <ScrollText className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFolder(folder.id)}
                            title={open ? 'Collapse folder' : 'Expand folder'}
                            aria-label={open ? 'Collapse folder' : 'Expand folder'}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
                          >
                            <ChevronsDownUp className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {open && (
                      <div {...dropProps(folder)}>
                        {/* Folders someone made inside this round come first.

                            A folder can carry a whole path in its name — a screen
                            moved in from a Request brings "Login / Product Catalog"
                            with it, because a round holds one level of folder and
                            the IA is deeper than that. Drawn flat, that name is a
                            slash-joined string pretending to be one folder; drawn
                            as the path it is, the round reads as the product does.

                            The segments above the last are display only: nothing
                            is stored for them, so they cannot be renamed, dropped
                            on, or deleted. The real folder is the leaf, and it
                            keeps every one of those. */}
                        {(() => {
                          const childNode = (child: DesignFolder, childIndex: number) => {
                          const childOpen = expanded.has(child.id);
                          const childSelected = activeFolder?.id === child.id && !openScreenId;
                          const isFolderDragTarget = folderDropTarget === child.id;
                          return (
                            <div
                              key={child.id}
                              {...subfolderDropProps(child, childIndex)}
                              className="relative"
                            >
                              {/* Drop position indicator line */}
                              {isFolderDragTarget && folderDropPos === 'above' && (
                                <div className="bg-primary absolute top-0 right-2 left-2 z-10 h-0.5 rounded-full" />
                              )}
                              <div
                                {...folderDragProps(child)}
                                className={cn(
                                  rowClass(
                                    childSelected,
                                    status === 'Released',
                                    status === 'In progress',
                                  ),
                                  'pl-2 transition-all duration-200 cursor-grab active:cursor-grabbing',
                                  dropTarget === child.id && 'bg-primary/10 scale-[1.01]',
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleFolder(child.id)}
                                  aria-label={`${childOpen ? 'Collapse' : 'Expand'} ${child.name}`}
                                  aria-expanded={childOpen}
                                  className="hover:text-foreground shrink-0"
                                >
                                  {childOpen ? (
                                    <ChevronDown className="size-3.5" />
                                  ) : (
                                    <ChevronRight className="size-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openFolder(child)}
                                  aria-pressed={childSelected}
                                  title={child.label}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                >
                                  {childOpen ? (
                                    <FolderOpen className="size-3.5 shrink-0" />
                                  ) : (
                                    <Folder className="size-3.5 shrink-0" />
                                  )}
                                  {editingFolderId === child.id ? (
                                    <input
                                      type="text"
                                      value={editingFolderName}
                                      onChange={(e) => setEditingFolderName(e.target.value)}
                                      onBlur={() => commitRenameFolder(child)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitRenameFolder(child);
                                        if (e.key === 'Escape') setEditingFolderId(null);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      className="bg-background min-w-0 flex-1 rounded border px-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                  ) : (
                                    <span
                                      className={cn(
                                        'min-w-0 flex-1 truncate',
                                        childSelected && 'font-medium',
                                      )}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        startRenamingFolder(child);
                                      }}
                                    >
                                      {child.name}
                                    </span>
                                  )}
                                  <span className="shrink-0 font-mono text-[10px]">
                                    {child.files.length}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => askRemoveSubfolder(child)}
                                  title={`Remove ${child.name}`}
                                  aria-label={`Remove ${child.name}`}
                                  className="text-muted-foreground/60 hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover/folder:opacity-100 focus-visible:opacity-100"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              {childOpen && (
                                <div className="ml-5 border-l">
                                  {child.files.map((file, fileIndex) => (
                                    <FileRow
                                      key={file.id}
                                      file={file}
                                      folder={child}
                                      index={fileIndex}
                                      onReorder={(fileId, toIndex) =>
                                        reorderFile(child, fileId, toIndex)
                                      }
                                      projectId={project.id}
                                      openScreenId={openScreenId}
                                      released={status === 'Released'}
                                      change={changes[file.id]}
                                      surface={resolveSurface(file.id, surfaces)}
                                      onSurface={markSurface}
                                      onDelete={deleteFile}
                                      onRename={renameFile}
                                    />
                                  ))}
                                  {child.files.length === 0 && (
                                    <button
                                      type="button"
                                      onClick={() => startNewDesignIn(child)}
                                      className="text-muted-foreground/70 hover:text-foreground flex items-center gap-1.5 py-1 pl-3.5 text-[11px] italic"
                                    >
                                      {t('explorer.empty')}
                                      <span className="not-italic underline underline-offset-2">
                                        {t('explorer.addFile')}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Drop position indicator line — below */}
                              {isFolderDragTarget && folderDropPos === 'below' && (
                                <div className="bg-primary absolute bottom-0 right-2 left-2 z-10 h-0.5 rounded-full" />
                              )}
                            </div>
                          );
                          };

                          interface Level {
                            name: string;
                            path: string;
                            below: Level[];
                            leaf?: { child: DesignFolder; index: number };
                            files: { file: DesignFile; index: number }[];
                          }

                          const roots: Level[] = [];
                          const rootFiles: { file: DesignFile; index: number }[] = [];

                          (folder.children ?? []).forEach((child, childIndex) => {
                            // Only ›, never /: a screen may well be called
                            // "Product Catalog / Checkout".
                            const parts = child.name.split('›').map((part) => part.trim()).filter(Boolean);
                            const path = parts.length > 0 ? parts : [child.name];
                            let siblings = roots;
                            let trail = folder.id;
                            path.forEach((name, depth) => {
                              trail = `${trail}/${name}`;
                              const last = depth === path.length - 1;
                              /*
                               * One row per name at a level.
                               *
                               * A round can hold both "Login" and "Login /
                               * Product Catalog", and the second draws a
                               * segment called Login too. Making a fresh node
                               * for the real folder gave two rows with the
                               * same name, one of them a folder you could
                               * rename and one you could not — the tree's job
                               * is telling things apart, and that told them
                               * together. A name is claimed once; only a real
                               * second folder of that name gets its own row.
                               */
                              let node = siblings.find(
                                (entry) => entry.name === name && (!last || !entry.leaf),
                              );
                              if (!node) {
                                node = { name, path: trail, below: [], files: [] };
                                siblings.push(node);
                              }
                              if (last) node.leaf = { child, index: childIndex };
                              siblings = node.below;
                            });
                          });

                          /*
                           * Routes and names both name a level, so match them
                           * loosely: a screen routed at /product-catalog belongs in
                           * the folder a person called "Product Catalog", not in a
                           * second row drawn beside it.
                           */
                          const slugOf = (value: string) =>
                            value.toLowerCase().replace(/[^a-z0-9]+/g, '');
                          const titleOf = (value: string) =>
                            value
                              .split(/[-_]+/)
                              .filter(Boolean)
                              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ') || value;
                          const segmentsOf = (file: DesignFile) => {
                            if (file.name.includes('›')) {
                              const named = file.name
                                .split('›')
                                .map((part) => part.trim())
                                .filter(Boolean);
                              if (named.length > 0) return named;
                            }
                            const routed = file.route ? file.route.split('/').filter(Boolean) : [];
                            return routed.length > 0 ? routed.map(titleOf) : [file.name];
                          };
                          const levelAt = (siblings: Level[], name: string) =>
                            siblings.find((entry) => slugOf(entry.name) === slugOf(name));

                          // A file naming a path goes inside it. The rest wait, because
                          // the folder they belong in may not be drawn yet.
                          const loose: { file: DesignFile; index: number; segment: string }[] = [];
                          (folder.files ?? []).forEach((file, fileIndex) => {
                            const segments = segmentsOf(file);
                            if (segments.length < 2) {
                              loose.push({ file, index: fileIndex, segment: segments[0] ?? file.name });
                              return;
                            }
                            let siblings = roots;
                            let trail = folder.id;
                            segments.slice(0, -1).forEach((name, depth) => {
                              let node = levelAt(siblings, name);
                              if (node) {
                                trail = node.path;
                              } else {
                                trail = `${trail}/${name}`;
                                node = { name, path: trail, below: [], files: [] };
                                siblings.push(node);
                              }
                              if (depth === segments.length - 2) {
                                node.files.push({ file, index: fileIndex });
                              }
                              siblings = node.below;
                            });
                          });

                          /*
                           * A one-segment file is its section's own page whenever a
                           * folder of that name exists: /cart is the Cart folder's
                           * page, so it opens from inside Cart rather than as a stray
                           * file row under the whole tree.
                           */
                          loose.forEach(({ file, index, segment }) => {
                            const node = levelAt(roots, segment);
                            if (node) node.files.push({ file, index });
                            else rootFiles.push({ file, index });
                          });

                          const countOf = (level: Level): number =>
                            (level.leaf?.child.files.length ?? 0) +
                            level.files.length +
                            level.below.reduce((sum, entry) => sum + countOf(entry), 0);

                          const renderLevel = (level: Level): ReactNode => {
                            const fileNodes = level.files.map(({ file, index }) => (
                              <FileRow
                                key={file.id}
                                file={file}
                                folder={folder}
                                index={index}
                                onReorder={(fileId, toIndex) => reorderFile(folder, fileId, toIndex)}
                                projectId={project.id}
                                openScreenId={openScreenId}
                                released={status === 'Released'}
                                change={changes[file.id]}
                                surface={resolveSurface(file.id, surfaces)}
                                onSurface={markSurface}
                                onDelete={deleteFile}
                                onRename={renameFile}
                              />
                            ));

                            if (level.leaf) {
                              /*
                               * A real folder, with whatever deeper paths hang
                               * off its name indented beneath it. The row is
                               * the folder's own, so it keeps its rename, its
                               * drop target and its delete.
                               */
                              const node = childNode(level.leaf.child, level.leaf.index);
                              if (level.below.length === 0 && level.files.length === 0) return node;
                              return (
                                <div key={level.path}>
                                  {node}
                                  <div className="ml-5 border-l">
                                    {fileNodes}
                                    {level.below.map(renderLevel)}
                                  </div>
                                </div>
                              );
                            }
                            const levelOpen = !collapsedPaths.has(level.path);
                            return (
                              <div key={level.path}>
                                <div className={cn(rowClass(false), 'pl-2')}>
                                  <button
                                    type="button"
                                    onClick={() => togglePath(level.path)}
                                    aria-label={`${levelOpen ? 'Collapse' : 'Expand'} ${level.name}`}
                                    aria-expanded={levelOpen}
                                    className="hover:text-foreground shrink-0"
                                  >
                                    {levelOpen ? (
                                      <ChevronDown className="size-3.5" />
                                    ) : (
                                      <ChevronRight className="size-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => togglePath(level.path)}
                                    title={level.name}
                                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                  >
                                    {levelOpen ? (
                                      <FolderOpen className="size-3.5 shrink-0" />
                                    ) : (
                                      <Folder className="size-3.5 shrink-0" />
                                    )}
                                    <span className="min-w-0 flex-1 truncate">{level.name}</span>
                                    <span className="shrink-0 font-mono text-[10px]">{countOf(level)}</span>
                                  </button>
                                </div>
                                {levelOpen && (
                                  // A level reaching here has no folder of its
                                  // own — the branch above returns for those —
                                  // so there is nothing but the paths below it.
                                  <div className="ml-5 border-l">
                                    {fileNodes}
                                    {level.below.map(renderLevel)}
                                  </div>
                                )}
                              </div>
                            );
                          };

                          return (
                            <>
                              {roots.map(renderLevel)}
                              {rootFiles.map(({ file, index }) => (
                                <FileRow
                                  key={file.id}
                                  file={file}
                                  folder={folder}
                                  index={index}
                                  onReorder={(fileId, toIndex) => reorderFile(folder, fileId, toIndex)}
                                  projectId={project.id}
                                  openScreenId={openScreenId}
                                  released={status === 'Released'}
                                  change={changes[file.id]}
                                  surface={resolveSurface(file.id, surfaces)}
                                  onSurface={markSurface}
                                  onDelete={deleteFile}
                                  onRename={renameFile}
                                />
                              ))}
                            </>
                          );
                        })()}
                        {folder.files.length === 0 &&
                          (folder.children ?? []).length === 0 &&
                          (folder.kind === 'version' &&
                          folder.versionNumber !== BASELINE_VERSION ? (
                            // An empty round is where someone looks for this.
                            <button
                              type="button"
                              onClick={() => carryOver(folder)}
                              className="text-muted-foreground/70 hover:text-foreground flex items-center gap-1.5 py-1 pl-3.5 text-[11px] italic"
                            >
                              {t('explorer.empty')}
                              <span className="not-italic underline underline-offset-2">
                                {t('explorer.carryOver')}
                              </span>
                            </button>
                          ) : (
                            <p className="text-muted-foreground/70 py-1 pl-3.5 text-[11px] italic">
                              {t('explorer.noDesigns')}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explains the baseline, so it is worth reading only where there is
                one. A project created here has no rounds at all, and describing
                version 1 to someone who does not have it is the tree claiming
                content it never had. */}
          </aside>

          {/* Whatever the route puts here: the file table, or an open canvas —
              unless the log is up, which takes the pane rather than crowding
              into a corner of it. */}
          {showActivity ? (
            <BusinessActivityLog
              events={activity}
              names={loadVersionNames(project.id)}
              onClose={() => setShowActivity(false)}
              onClear={() => project && setActivity(clearActivity(project.id))}
            />
          ) : (
            children
          )}
        </div>

        <NewDesignDialog
          open={newOpen}
          folders={editableVersions}
          defaultFolderId={defaultTargetId}
          onClose={() => setNewOpen(false)}
          onCreate={(folder, screen) => {
            registerCreated(folder, screen);
            setNewOpen(false);
            router.push(businessEditHref(project.id, screen.id, folder.id));
          }}
        />

        {/* Dropping a folder with files in it is worth a question too. */}
        <Dialog
          open={removingSubfolder !== null}
          onOpenChange={(next) => !next && setRemovingSubfolder(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t('remove.folderTitle', { name: removingSubfolder?.name ?? '' })}
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              {t('remove.folderDesc', { count: removingSubfolder?.files.length ?? 0 })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemovingSubfolder(null)}>
                {t('remove.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => removingSubfolder && dropSubfolder(removingSubfolder)}
                className="gap-1"
              >
                <Trash2 className="size-3.5" />
                {t('remove.confirm', { name: removingSubfolder?.name ?? '' })}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {toast && (
          <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-xs shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
