'use client';

import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Code2,
  ExternalLink,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  GitMerge,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Sparkles,
  SquareTerminal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
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
import { useLocale } from '@/lib/locale';
import { ChatPane } from '@/components/we-adk/claude-chat';
import { DesignHtmlButton } from '@/components/we-adk/design-html-button';
import { ChangeMark } from '@/components/we-adk/change-mark';
import { MergeToMainDialog } from '@/components/we-adk/merge-to-main-dialog';
import {
  addUserDesign,
  addUserSubfolder,
  initUserScreens,
  isUserMember,
  loadUserSubfolders,
  removeUserSubfolder,
  userSubfolderFolderId,
  loadUserScreens,
  loadUserMembers,
  reorderUserScreen,
  renameUserSubfolder,
  saveUserScreens,
  MEMBER_ROLES,
  PROJECT_TEAMS,
  saveUserMembers,
  userScreensStorageKey,
  type MemberRole,
  type TeamMember,
} from '@/lib/we-adk/user-workspace';
import { loadLastUserView, saveLastUserView } from '@/lib/we-adk/last-view';
import {
  changesAgainst,
  changesAgainstSnapshot,
  loadSavedSnapshot,
  writeSavedSnapshot,
  type FileDiff,
} from '@/lib/we-adk/version-diff';
import { SketcherEditor } from '@/components/we-adk/sketcher-editor';
import { businessPreviewHref, previewHref } from '@/components/we-adk/mockup-board';
import {
  DeviceSwitcher,
  ScreenPreviewSurface,
  type PreviewMode,
} from '@/components/we-adk/screen-preview';
import { canPreviewLive } from '@/components/we-adk/live-screen-preview';
import { findPrototypeByRoute } from '@/lib/we-adk/prototype';
import { StatusChip } from '@/components/we-adk/status-chip';
import { type DevicePresetId } from '@/lib/we-adk-mock/sketcher';
import {
  designFileFromScreen,
  findProject,
  type DesignFile,
  type DesignProject,
} from '@/lib/we-adk-mock/projects';
import { type Chip } from '@/lib/we-adk-mock/types';
import {
  loadGeneratedScreens,
  removeGeneratedScreen,
  saveGeneratedScreens,
  type SeedPattern,
  type SketchScreen,
} from '@/lib/we-adk-mock/sketches';
import { isPrototypeFile, readPrototypeId } from '@/lib/we-adk/prototype';
import {
  BASELINE_VERSION,
  FIRST_EDITABLE_VERSION,
  loadRemovedVersions,
  loadVersionCount,
  loadVersionStatuses,
  resolveVersionStatus,
  versionFolderId,
  versionScreens,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';
import { type VersionStatus } from '@/lib/we-adk-mock/types';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

// Page-local: a route file may only export what Next recognises, so these
// stay unexported (nothing outside this page uses them).
/** A version folder in the user workspace — this page's view model. */
interface UserVersionFolder {
  version: number;
  id: string;
  name: string;
  status: VersionStatus;
  files: DesignFile[];
  /** Folders this member made inside the round. Absent on the folders themselves. */
  children?: UserVersionFolder[];
  /** Set on a child, so actions know which folder they are acting in. */
  subfolderId?: string;
}

/* ------------------------------------------------------------------ */
/* Build per-user version folders                                      */
/* ------------------------------------------------------------------ */

function buildUserVersionFolders(
  projectId: string,
  userId: string,
  statuses: VersionStatuses,
): UserVersionFolder[] {
  const count = loadVersionCount(projectId);
  const removed = loadRemovedVersions(projectId);

  // Find the last (newest) non-removed version.
  let latest: number | null = null;
  for (let version = count; version >= FIRST_EDITABLE_VERSION; version -= 1) {
    if (!removed.includes(version)) {
      latest = version;
      break;
    }
  }
  if (latest === null) return [];

  const folders: UserVersionFolder[] = [];
  const version = latest;
  const screens = initUserScreens(projectId, userId, version);
  const folderId = versionFolderId(version);
  const status = resolveVersionStatus(version, statuses);
  const storageKey = userScreensStorageKey(projectId, userId, version);

  const files: DesignFile[] = screens.map((screen) =>
    designFileFromScreen(screen, { id: folderId, label: `version ${version}`, storageKey }),
  );

  // The member's own folders inside the round, each with its own file list.
  const children: UserVersionFolder[] = loadUserSubfolders(projectId, userId, version).map(
    (sub) => {
      const childId = userSubfolderFolderId(version, sub.id);
      const childKey = userScreensStorageKey(projectId, userId, version, sub.id);
      return {
        version,
        id: childId,
        name: sub.name,
        status,
        subfolderId: sub.id,
        files: loadGeneratedScreens(childKey).map((screen) =>
          designFileFromScreen(screen, {
            id: childId,
            label: sub.name,
            storageKey: childKey,
          }),
        ),
      };
    },
  );

  folders.push({
    version,
    id: folderId,
    name: `version ${version}`,
    status,
    files,
    children,
  });

  return folders;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

const ROLE_TONE: Record<MemberRole, string> = {
  'Project Lead': 'text-violet-600 dark:text-violet-400',
  Developer: 'text-sky-600 dark:text-sky-400',
  Designer: 'text-pink-600 dark:text-pink-400',
  QA: 'text-amber-600 dark:text-amber-400',
  PM: 'text-emerald-600 dark:text-emerald-400',
  Other: 'text-slate-600 dark:text-slate-400',
};

const VERSION_STATUS_CLASS: Record<VersionStatus, string> = {
  Released: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  'In progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
};

/**
 * How many files a member has in the newest live round.
 *
 * Every read here is localStorage, so this cannot run during render — see the
 * effect that calls it. On the server the try/catch would quietly return 0 and
 * the browser would then render the real count, which is a hydration mismatch.
 */
function countMemberFiles(projectId: string, memberId: string): number {
  try {
    const count = loadVersionCount(projectId);
    const removed = loadRemovedVersions(projectId);
    for (let v = count; v >= FIRST_EDITABLE_VERSION; v -= 1) {
      if (removed.includes(v)) continue;
      const screens = loadUserScreens(projectId, memberId, v);
      // Before they open the tab there is nothing of theirs to count, so the
      // round stands in for it — all of it, folders included, which is what the
      // fork will hand them.
      return screens ? screens.length : versionScreens(projectId, v).length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Member form dialog                                                  */
/* ------------------------------------------------------------------ */

function MemberFormDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: TeamMember;
  onClose: () => void;
  onSave: (fields: Omit<TeamMember, 'id'>) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('Developer');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setRole(initial.role);
      setEmail(initial.email ?? '');
      setDepartment(initial.department ?? '');
    } else {
      setName('');
      setRole('Developer');
      setEmail('');
      setDepartment('');
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t('user.editMember') : t('user.addMember')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-name">{t('member.name')}</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('member.namePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-role">{t('member.role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMBER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-email">{t('member.email')}</Label>
            <Input
              id="member-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('member.emailPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-dept">{t('member.department')}</Label>
            <Input
              id="member-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={t('member.departmentPlaceholder')}
            />
          </div>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onSave({
                name: name.trim(),
                role,
                email: email.trim() || undefined,
                department: department.trim() || undefined,
              });
            }}
            disabled={!name.trim()}
          >
            {initial ? t('member.save') : t('member.add')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Preview pane — shows the live screen preview like the Main tab      */
/* ------------------------------------------------------------------ */

function UserPreviewPane({
  file,
  project,
  onClose,
}: {
  file: DesignFile;
  project: DesignProject;
  onClose: () => void;
}) {
  const { t } = useLocale();
  // Full width, like every other preview in the app — the Main tab, the editor and
  // the standalone preview page all open this way. This pane was the only one that
  // started at the 1440px Desktop frame, which showed a member's screen boxed in
  // and narrower than the same file looks in Main.
  const [device, setDevice] = useState<DevicePresetId>('full');
  const [mode] = useState<PreviewMode>('live');
  const [view, setView] = useState<'preview' | 'edit'>('preview');
  const hasLive = canPreviewLive(file.id);
  const isHtml = isPrototypeFile(file.id) || file.fileName.endsWith('.html');

  // Edit mode: render the full canvas editor directly (it has its own toolbar,
  // Preview/Edit tabs, and chat pane built in).
  if (view === 'edit') {
    return (
      <SketcherEditor
        embedded
        overrideScreenId={file.id}
        overrideProjectId={project.id}
        overrideFolderId={file.folderId}
        onSwitchToPreview={() => setView('preview')}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Top bar: toolbar + chat header in one row */}
      <div className="bg-background flex shrink-0 border-b">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-4 py-2">
          {isHtml ? (
            <Code2 className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <FileCode2 className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <span className="truncate font-mono text-xs font-medium">{file.fileName}</span>
          <span className="text-muted-foreground truncate text-xs">{file.name}</span>
          {isHtml ? (
            <Badge variant="info" className="shrink-0 text-[10px]">
              {t('badge.html')}
            </Badge>
          ) : hasLive ? (
            <Badge variant="success" className="shrink-0 text-[10px]">
              {t('badge.liveScreen')}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {t('badge.wireframe')}
            </Badge>
          )}

          {/* Preview / Edit leads the right-hand controls rather than sitting in the
              middle of the file's name and badges: it belongs with the other things
              that change what the pane shows, not with the things that describe the
              file. */}
          <div className="ml-auto flex items-center gap-2">
            <div className="bg-muted flex shrink-0 rounded-md p-0.5">
              {(['preview', 'edit'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setView(tab)}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px]',
                    view === tab
                      ? 'bg-background shadow-xs font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab === 'preview' ? t('view.preview') : t('view.edit')}
                </button>
              ))}
            </div>
            <DeviceSwitcher device={device} onChange={setDevice} />
            {isHtml && (
              <DesignHtmlButton
                screenId={file.id}
                name={file.name}
                route={file.route}
                seedPattern={file.seedPattern}
                className="h-7 gap-1 px-2 text-xs"
              />
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <a href={previewHref(file.id, project.id)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" />
                {t('view.openBrowser')}
              </a>
            </Button>
          </div>
        </div>

        {/* Chat header — same row as toolbar */}
        <div className="flex w-[26rem] shrink-0 items-center gap-2 border-l px-3 py-2">
          <SquareTerminal className="text-primary size-4 shrink-0" />
          <span className="text-sm font-semibold">{t('chat.claudeCode')}</span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {file.fileName}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {t('badge.localCli')}
          </Badge>
        </div>
      </div>

      {/* Below: screen on the left, chat on the right */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[#f4f5f7] p-5 dark:bg-[#0b0e14]">
            <ScreenPreviewSurface
              screenId={file.id}
              seedPattern={file.seedPattern ?? 'listPage'}
              route={file.route}
              device={device}
              mode={mode}
              editable
              hrefForRoute={(route) => {
                const target = findPrototypeByRoute(route);
                return target ? businessPreviewHref(project.id, target.id, file.folderId) : null;
              }}
            />
          </div>

          {/* Floating action bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-lg">
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
        </div>

        <aside className="bg-background flex w-[26rem] shrink-0 flex-col border-l">
          <ChatPane
            project={project}
            contextText={`Preview of ${file.name}${file.route ? ` (${file.route})` : ''}`}
            folderLabel={`user-preview/${file.fileName}`}
            greeting={`Ask about ${file.name}`}
            greetingHint="The screen you are previewing is in context — its layout and the file it belongs to."
            initialTurns={[]}
            onPersist={() => {}}
          />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Naming a new design                                                 */
/* ------------------------------------------------------------------ */

/**
 * The same three things Main asks for when a design is created: a name, an optional
 * route, and which seed layout the canvas opens on. A file made in a member's
 * workspace should be the same kind of object as one made in the round, or merging
 * it back would be comparing unlike things.
 */
function UserNewDesignDialog({
  open,
  target,
  folders,
  onClose,
  onCreate,
}: {
  open: boolean;
  /** The folder it is going into: the round itself, or one of the member's. */
  target: string | null;
  folders: UserVersionFolder[];
  onClose: () => void;
  onCreate: (
    target: string,
    fields: { name: string; route?: string; seedPattern: SeedPattern },
  ) => void;
}) {
  const [name, setName] = useState('');
  const [route, setRoute] = useState('');
  const [seed, setSeed] = useState<SeedPattern>('listPage');

  useEffect(() => {
    if (!open) return;
    setName('');
    setRoute('');
    setSeed('listPage');
  }, [open]);

  const round = folders[0] ?? null;
  const where =
    target && round
      ? ((round.children ?? []).find((child) => child.id === target)?.name ?? round.name)
      : '';

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed || !target) return;
    onCreate(target, {
      name: trimmed.slice(0, 80),
      ...(route.trim() ? { route: route.trim() } : {}),
      seedPattern: seed,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New design</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-design-name">Name</Label>
            <Input
              id="user-design-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && create()}
              placeholder="Approval queue"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-design-route">Route</Label>
            <Input
              id="user-design-route"
              value={route}
              onChange={(event) => setRoute(event.target.value)}
              placeholder="/eacc/approvals (optional)"
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-design-seed">Starting layout</Label>
            <Select value={seed} onValueChange={(value) => setSeed(value as SeedPattern)}>
              <SelectTrigger id="user-design-seed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listPage">List page</SelectItem>
                <SelectItem value="detailPage">Detail page</SelectItem>
                <SelectItem value="dashboard">Dashboard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {where && <p className="text-muted-foreground text-[11px]">Goes into {where}.</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={name.trim().length === 0}>
            Create design
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* User workspace — file explorer per member (matches Main layout)     */
/* ------------------------------------------------------------------ */

function UserWorkspace({
  member,
  project,
  projectId,
  onClose,
}: {
  member: TeamMember;
  project: DesignProject;
  projectId: string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [statuses, setStatuses] = useState<VersionStatuses>({});
  const [folders, setFolders] = useState<UserVersionFolder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Guards the one-time restore below against later rebuilds of the tree. */
  const treeRestored = useRef(false);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  /**
   * A· / M· for this member, against the round in Main they forked from.
   *
   * Same mark and same comparison the Main explorer uses — only the baseline
   * differs: here it answers "what have I changed that a merge would carry?"
   */
  const [changes, setChanges] = useState<Record<string, FileDiff>>({});

  useEffect(() => {
    const s = loadVersionStatuses(projectId);
    setStatuses(s);
    const built = buildUserVersionFolders(projectId, member.id, s);
    setFolders(built);

    // Where this tab was last, if it is still there. Without it, coming back from
    // Main or Task reopened the first design and refolded the tree — the same way
    // Main used to drop you back on version 1.
    //
    // Only on the way in, though: this effect also runs whenever the workspace
    // changes — a design created, a folder added, a save — and re-applying the
    // remembered set then folded away the folder you had just made.
    const remembered = loadLastUserView(projectId);
    if (!treeRestored.current) {
      treeRestored.current = true;
      setExpanded(
        new Set(remembered.expanded.length > 0 ? remembered.expanded : built.map((f) => f.id)),
      );
    }
    const files = built.flatMap((f) => f.files);
    // Preview-first, like Main: an explorer beside an empty pane makes you click
    // once before the tab shows you anything. Only fills a gap — a file already
    // open stays open.
    setOpenFileId(
      (current) =>
        current ?? files.find((file) => file.id === remembered.file)?.id ?? files[0]?.id ?? null,
    );

    const marks: Record<string, FileDiff> = {};
    for (const folder of built) {
      // Saved once, and the markers are about what has moved since — the same
      // rule Main follows. Until then they answer the question a fresh workspace
      // actually raises: what is different from the round I forked from.
      const saved = loadSavedSnapshot(projectId, folder.version, member.id);
      if (saved) {
        Object.assign(marks, changesAgainstSnapshot(folder.files, saved));
        continue;
      }
      // The round as Main holds it, in the same shape the diff compares — the
      // whole round, since that is what was forked: a file Main keeps in one of
      // its folders would otherwise read as one this member added.
      const roundFiles = versionScreens(projectId, folder.version).map((screen) =>
        designFileFromScreen(screen, {
          id: versionFolderId(folder.version),
          label: `version ${folder.version}`,
        }),
      );
      Object.assign(marks, changesAgainst(folder.files, roundFiles));
    }
    setChanges(marks);
  }, [projectId, member.id, revision]);

  /**
   * Record what is in view. Guarded so the first pass — before the effect above has
   * restored anything — cannot overwrite what it is about to read.
   */
  const recording = useRef(false);
  useEffect(() => {
    if (folders.length === 0) return;
    if (!recording.current) {
      recording.current = true;
      return;
    }
    saveLastUserView(projectId, { file: openFileId, expanded: [...expanded] });
  }, [projectId, folders, openFileId, expanded]);

  const today = () => new Date().toISOString().slice(0, 10);

  /**
   * A design in this member's workspace, in the round or in one of their folders.
   *
   * Opens straight away: a file you just made and cannot see is a file you have to
   * go looking for.
   */
  const createDesign = (
    target: string,
    fields: { name: string; route?: string; seedPattern: SeedPattern },
  ) => {
    const parent = folders[0];
    if (!parent || parent.status === 'Released') return;
    const child = (parent.children ?? []).find((entry) => entry.id === target);
    const screen = addUserDesign(
      projectId,
      member.id,
      parent.version,
      fields,
      today(),
      child?.subfolderId,
    );
    setNewDesignIn(null);
    setRevision((count) => count + 1);
    setExpanded((current) => new Set(current).add(parent.id).add(target));
    setOpenFileId(screen.id);
  };

  const createFolder = () => {
    const parent = folders[0];
    if (!parent || parent.status === 'Released') return;
    const placeholder = 'New folder';
    const folder = addUserSubfolder(projectId, member.id, parent.version, placeholder, today());
    const folderId = userSubfolderFolderId(parent.version, folder.id);
    setRevision((count) => count + 1);
    setExpanded((current) => new Set(current).add(parent.id).add(folderId));
    // Immediately enter rename mode so the user can type the name.
    setEditingFolderId(folderId);
    setEditingName('');
  };

  /** A folder and everything in it. Empty ones go without asking. */
  const deleteFolder = (folder: UserVersionFolder) => {
    if (!folder.subfolderId || folder.status === 'Released') return;
    if (
      folder.files.length > 0 &&
      !window.confirm(
        `Delete ${folder.name} and its ${folder.files.length} design${folder.files.length === 1 ? '' : 's'}?`,
      )
    ) {
      return;
    }
    removeUserSubfolder(projectId, member.id, folder.version, folder.subfolderId);
    if (folder.files.some((file) => file.id === openFileId)) setOpenFileId(null);
    setRevision((count) => count + 1);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteFile = useCallback(
    (file: DesignFile) => {
      if (!file.sessionId) return;
      // Remove from per-user storage
      const next = removeGeneratedScreen(file.sessionId, file.id);
      if (openFileId === file.id) setOpenFileId(null);
      setRevision((r) => r + 1);
    },
    [openFileId],
  );

  /* --- File drag-drop reordering ---------------------------------------- */
  const FILE_DRAG_MIME = 'application/x-we-adk-user-file';
  const [dragFileId, setDragFileId] = useState<string | null>(null);
  const [fileDropTarget, setFileDropTarget] = useState<string | null>(null);
  const [fileDropPos, setFileDropPos] = useState<'above' | 'below'>('below');

  const fileDragProps = (file: DesignFile) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(FILE_DRAG_MIME, file.id);
      e.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => setDragFileId(file.id));
    },
    onDragEnd: () => {
      setDragFileId(null);
      setFileDropTarget(null);
      setFolderDropTarget(null);
    },
  });

  const fileDropProps = (file: DesignFile, index: number, folder: UserVersionFolder) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(FILE_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setFileDropPos(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
      setFileDropTarget(file.id);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        setFileDropTarget((prev) => (prev === file.id ? null : prev));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setFileDropTarget(null);
      setDragFileId(null);
      const screenId = e.dataTransfer.getData(FILE_DRAG_MIME);
      if (!screenId || screenId === file.id) return;
      const targetIdx = folder.files.findIndex((f) => f.id === file.id);
      const toIndex = fileDropPos === 'below' ? targetIdx + 1 : targetIdx;
      reorderUserScreen(projectId, member.id, folder.version, screenId, toIndex);
      setRevision((r) => r + 1);
    },
  });

  /* --- Inline folder rename ---------------------------------------------- */
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startRename = (child: UserVersionFolder) => {
    setEditingFolderId(child.id);
    setEditingName(child.name);
  };

  const commitRename = (child: UserVersionFolder) => {
    if (!child.subfolderId) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== child.name) {
      renameUserSubfolder(projectId, member.id, child.version, child.subfolderId, trimmed);
      setRevision((r) => r + 1);
    }
    setEditingFolderId(null);
  };

  /* --- Drag file into folder --------------------------------------------- */
  const [folderDropTarget, setFolderDropTarget] = useState<string | null>(null);

  const moveFileToFolder = (screenId: string, targetFolder: UserVersionFolder) => {
    const version = targetFolder.version;
    // Find source: either root or a subfolder.
    const rootFolder = folders.find((f) => f.version === version);
    if (!rootFolder) return;
    const allFolders = [rootFolder, ...(rootFolder.children ?? [])];
    const sourceFolder = allFolders.find((f) => f.files.some((file) => file.id === screenId));
    if (!sourceFolder) return;

    // Find the screen object.
    const screen = (
      sourceFolder.subfolderId
        ? loadGeneratedScreens(
            userScreensStorageKey(projectId, member.id, version, sourceFolder.subfolderId),
          )
        : (loadUserScreens(projectId, member.id, version) ?? [])
    ).find((s) => s.id === screenId);
    if (!screen) return;

    // Remove from source.
    if (sourceFolder.subfolderId) {
      const srcKey = userScreensStorageKey(projectId, member.id, version, sourceFolder.subfolderId);
      saveGeneratedScreens(
        srcKey,
        loadGeneratedScreens(srcKey).filter((s) => s.id !== screenId),
      );
    } else {
      const srcScreens = loadUserScreens(projectId, member.id, version) ?? [];
      saveUserScreens(
        projectId,
        member.id,
        version,
        srcScreens.filter((s) => s.id !== screenId),
      );
    }

    // Add to target.
    if (targetFolder.subfolderId) {
      const tgtKey = userScreensStorageKey(projectId, member.id, version, targetFolder.subfolderId);
      const existing = loadGeneratedScreens(tgtKey).filter((s) => s.id !== screenId);
      saveGeneratedScreens(tgtKey, [...existing, screen]);
    } else {
      const tgtScreens = (loadUserScreens(projectId, member.id, version) ?? []).filter(
        (s) => s.id !== screenId,
      );
      saveUserScreens(projectId, member.id, version, [...tgtScreens, screen]);
    }

    setRevision((r) => r + 1);
  };

  const folderDropProps = (folder: UserVersionFolder) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(FILE_DRAG_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setFolderDropTarget(folder.id);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        setFolderDropTarget((prev) => (prev === folder.id ? null : prev));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setFolderDropTarget(null);
      setDragFileId(null);
      const screenId = e.dataTransfer.getData(FILE_DRAG_MIME);
      if (!screenId) return;
      moveFileToFolder(screenId, folder);
    },
  });

  const totalFiles = folders.reduce((sum, f) => sum + f.files.length, 0);
  /** How many designs carry an A· or M· mark — what Save would clear. */
  const markedCount = Object.values(changes).filter((diff) => diff.change !== 'unchanged').length;

  /**
   * Save: this workspace is what it should be, so nothing in it counts as changed.
   *
   * Recorded under this member's own scope, so it clears their markers without
   * touching the round's in Main — two people forked from the same round and each
   * has their own idea of "since I last looked".
   */
  const saveWork = () => {
    const target = folders[0];
    if (!target || target.status === 'Released') return;
    writeSavedSnapshot(
      projectId,
      target.version,
      target.files,
      new Date().toISOString().slice(0, 10),
      member.id,
    );
    setRevision((value) => value + 1);
    setMergeNote(`Saved ${member.name}'s workspace — markers cleared.`);
  };
  const openFile = openFileId
    ? (folders.flatMap((f) => f.files).find((f) => f.id === openFileId) ?? null)
    : null;

  /* --- Merging this member's work back into Main --------------------- */

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  /** Which folder a new design is going into — null when the dialog is shut. */
  const [newDesignIn, setNewDesignIn] = useState<string | null>(null);
  // The round the member is working against — their tree only ever holds one.
  const round = folders[0] ?? null;
  const roundScreens = useMemo(
    () => (round ? initUserScreens(projectId, member.id, round.version) : []),
    // `revision` is in here so the list is re-read after a delete or a merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, member.id, round?.version, revision],
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* Explorer tree */}
      <div className="bg-background flex w-64 shrink-0 flex-col border-r">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
            {initials(member.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{member.name}</p>
            <p className="text-muted-foreground truncate text-[10px]">{member.role}</p>
          </div>

          {/* The same two actions the Main explorer offers, in the same order. A
              released round takes neither — the standing rule about released
              versions, enforced here rather than left to fail on the click. */}
          <button
            type="button"
            disabled={!round || round.status === 'Released'}
            title={
              !round
                ? 'No round open yet'
                : round.status === 'Released'
                  ? `${round.name} has been released — its files are read-only`
                  : `New design in ${member.name}'s workspace`
            }
            onClick={() => setNewDesignIn(round?.id ?? null)}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 disabled:opacity-40"
          >
            <FilePlus className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={!round || round.status === 'Released'}
            title={
              !round
                ? 'No round open yet'
                : round.status === 'Released'
                  ? `${round.name} has been released — no folders can be added`
                  : `New folder in ${round.name}`
            }
            onClick={createFolder}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 disabled:opacity-40"
          >
            <FolderPlus className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Folder tree — same layout as the Main explorer */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {folders.map((folder) => {
            const open = expanded.has(folder.id);
            const FolderIcon = open ? FolderOpen : Folder;
            const released = folder.status === 'Released';
            return (
              <div key={folder.id}>
                {/* Version folder row */}
                <div
                  className={cn(
                    'group/folder flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-xs',
                    folder.files.some((f) => f.id === openFileId)
                      ? cn(
                          'bg-muted text-foreground',
                          folder.status === 'Released' ? 'border-emerald-500'
                            : folder.status === 'In progress' ? 'border-blue-500'
                            : 'border-primary',
                        )
                      : 'border-transparent text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(folder.id)}
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
                    onClick={() => toggle(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <FolderIcon className="size-3.5 shrink-0" />
                    <span className="flex-1 truncate font-mono">{folder.name}</span>
                    <span className="shrink-0 font-mono text-[10px]">{folder.files.length}</span>
                  </button>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
                      VERSION_STATUS_CLASS[folder.status],
                    )}
                  >
                    {folder.status}
                  </span>
                </div>

                {/* Files */}
                {open && (
                  <div className="ml-6 border-l" {...folderDropProps(folder)}>
                    {/* This member's own folders inside the round — always on top. */}
                    {(folder.children ?? []).map((child) => {
                      const childOpen = expanded.has(child.id);
                      const ChildIcon = childOpen ? FolderOpen : Folder;
                      return (
                        <div key={child.id} {...folderDropProps(child)}>
                          <div
                            className={cn(
                              'group/sub flex w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-2 text-xs transition-colors duration-200',
                              child.files.some((f) => f.id === openFileId)
                                ? cn(
                                    'bg-muted text-foreground',
                                    folder.status === 'Released' ? 'border-emerald-500'
                                      : folder.status === 'In progress' ? 'border-blue-500'
                                      : 'border-primary',
                                  )
                                : 'border-transparent text-muted-foreground hover:bg-muted/50',
                              folderDropTarget === child.id && 'bg-primary/10',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggle(child.id)}
                              aria-expanded={childOpen}
                              className="hover:text-foreground shrink-0"
                            >
                              {childOpen ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                            <ChildIcon className="size-3.5 shrink-0" />
                            {editingFolderId === child.id ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => commitRename(child)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename(child);
                                  if (e.key === 'Escape') setEditingFolderId(null);
                                }}
                                autoFocus
                                className="bg-background min-w-0 flex-1 rounded border px-1 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <span
                                className="min-w-0 flex-1 truncate font-mono"
                                onDoubleClick={() => startRename(child)}
                              >
                                {child.name}
                              </span>
                            )}
                            <span className="shrink-0 font-mono text-[10px]">
                              {child.files.length}
                            </span>
                            <button
                              type="button"
                              title={`New design in ${child.name}`}
                              aria-label={`New design in ${child.name}`}
                              onClick={() => setNewDesignIn(child.id)}
                              className="hover:text-foreground shrink-0 opacity-0 group-hover/sub:opacity-100"
                            >
                              <FilePlus className="size-3" />
                            </button>
                            <button
                              type="button"
                              title={`Delete ${child.name}`}
                              aria-label={`Delete ${child.name}`}
                              onClick={() => deleteFolder(child)}
                              className="hover:text-destructive shrink-0 opacity-0 group-hover/sub:opacity-100"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>

                          {childOpen && (
                            <div className="border-muted ml-6 border-l">
                              {child.files.map((file) => {
                                const isOpen = file.id === openFileId;
                                return (
                                  <div
                                    key={file.id}
                                    className="group/file flex w-full items-center pr-1.5"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setOpenFileId(isOpen ? null : file.id)}
                                      className={cn(
                                        'flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-2 text-left text-xs',
                                        isOpen
                                          ? 'text-foreground font-medium'
                                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                                      )}
                                    >
                                      <Code2 className="size-3.5 shrink-0" />
                                      <span className="min-w-0 flex-1 truncate font-mono">
                                        {file.fileName}
                                      </span>
                                      <ChangeMark diff={changes[file.id]} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteFile(file)}
                                      title={`Delete ${file.fileName}`}
                                      className="hover:text-destructive text-muted-foreground shrink-0 opacity-0 group-hover/file:opacity-100"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                );
                              })}
                              {child.files.length === 0 && (
                                <p className="text-muted-foreground/60 py-1 pl-3.5 text-[11px] italic">
                                  {t('explorer.noDesigns')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Files after folders */}
                    {folder.files.map((file, fileIndex) => {
                      const isOpen = file.id === openFileId;
                      const isHtml = isPrototypeFile(file.id) || file.fileName.endsWith('.html');
                      const isDragging = dragFileId === file.id;
                      const isDropTarget = fileDropTarget === file.id;
                      return (
                        <div
                          key={file.id}
                          className="relative"
                          {...fileDropProps(file, fileIndex, folder)}
                        >
                          {isDropTarget && fileDropPos === 'above' && (
                            <div className="bg-primary absolute top-0 right-2 left-2 z-10 h-0.5 rounded-full" />
                          )}
                          <div
                            {...(!released ? fileDragProps(file) : {})}
                            className={cn(
                              'group/file flex w-full items-center pr-1.5 transition-opacity duration-200',
                              isOpen
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted/50',
                              !released && 'cursor-grab active:cursor-grabbing',
                              isDragging && 'opacity-30',
                            )}
                          >
                            {!released && (
                              <GripVertical className="text-muted-foreground/40 ml-1 size-3 shrink-0 opacity-0 transition-opacity group-hover/file:opacity-100" />
                            )}
                            <button
                              type="button"
                              onClick={() => setOpenFileId(isOpen ? null : file.id)}
                              className={cn(
                                'flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-xs',
                                !released ? 'pl-1' : 'pl-3.5',
                                isOpen ? 'font-medium' : 'hover:text-foreground',
                              )}
                            >
                              {isHtml ? (
                                <Code2 className="size-3.5 shrink-0" />
                              ) : (
                                <FileCode2 className="size-3.5 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate font-mono',
                                  released && 'opacity-60',
                                )}
                              >
                                {file.fileName}
                              </span>
                              <ChangeMark diff={changes[file.id]} />
                            </button>
                            {!released && (
                              <button
                                type="button"
                                onClick={() => deleteFile(file)}
                                title={`Delete ${file.fileName}`}
                                className="hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover/file:opacity-100 focus-visible:opacity-100"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                          {isDropTarget && fileDropPos === 'below' && (
                            <div className="bg-primary absolute bottom-0 right-2 left-2 z-10 h-0.5 rounded-full" />
                          )}
                        </div>
                      );
                    })}
                    {folder.files.length === 0 && (folder.children ?? []).length === 0 && (
                      <p className="text-muted-foreground/60 py-1 pl-3.5 text-[11px] italic">
                        {t('explorer.noDesigns')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {folders.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-[11px]">
              {t('explorer.noVersions')}
            </p>
          )}
        </div>

        {/* Done designing? This is the way back into Main. Released rounds take
            nothing, so the button says so rather than failing on the click. */}
        {round && (
          <div className="flex shrink-0 flex-col gap-1.5 border-t px-2 py-2">
            {/* Save means the same thing here as in Main: this workspace is what it
                should be, so nothing in it counts as changed. Released rounds are
                left alone, like everywhere else. */}
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              disabled={round.status === 'Released' || markedCount === 0}
              title={
                round.status === 'Released'
                  ? `${round.name} has been released — its files are read-only`
                  : markedCount === 0
                    ? 'Nothing is marked as added or modified'
                    : `Clear the A and M markers on ${member.name}'s ${markedCount} changed design${markedCount === 1 ? '' : 's'}`
              }
              onClick={saveWork}
            >
              <Save className="size-3.5" />
              Save{markedCount > 0 ? ` (${markedCount})` : ''}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              disabled={round.status === 'Released' || totalFiles === 0}
              title={
                round.status === 'Released'
                  ? `${round.name} has been released — nothing can be merged into it`
                  : `Merge ${member.name}'s designs into ${round.name} in Main`
              }
              onClick={() => setMergeOpen(true)}
            >
              <GitMerge className="size-3.5" />
              Merge into {round.name}
            </Button>
            {mergeNote && <p className="text-muted-foreground pt-0.5 text-[10px]">{mergeNote}</p>}
          </div>
        )}

        <p className="text-muted-foreground shrink-0 border-t px-3 py-2 text-[10px]">
          {totalFiles} design{totalFiles === 1 ? '' : 's'} across {folders.length} version
          {folders.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Naming a new design. Same three fields Main asks for, so a file made here
          is the same kind of thing as one made there. */}
      <UserNewDesignDialog
        open={newDesignIn !== null}
        target={newDesignIn}
        folders={folders}
        onClose={() => setNewDesignIn(null)}
        onCreate={createDesign}
      />

      {round && (
        <MergeToMainDialog
          open={mergeOpen}
          projectId={projectId}
          version={round.version}
          versionName={round.name}
          memberName={member.name}
          memberScreens={roundScreens}
          onClose={() => setMergeOpen(false)}
          onMerged={(result) => {
            setMergeOpen(false);
            setRevision((r) => r + 1);
            setMergeNote(
              `Merged into ${round.name} — ${result.added} added, ${result.revised} replaced.`,
            );
          }}
        />
      )}

      {/* Screen preview — same live preview as the Main tab */}
      {openFile ? (
        <UserPreviewPane file={openFile} project={project} onClose={() => setOpenFileId(null)} />
      ) : (
        <div className="text-muted-foreground hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center lg:flex">
          <FileCode2 className="size-5 opacity-40" />
          <p className="text-foreground text-sm font-medium">{t('user.selectFile')}</p>
          <p className="max-w-xs text-xs">
            Pick a file from {member.name}&rsquo;s tree to see its details or open it in the canvas.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function UserPage() {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const project = findProject(params.projectId);

  const [userMembers, setUserMembers] = useState<TeamMember[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * Files per member, filled in after mount. Null until then, so the first
   * client render matches the HTML the server sent — the counts come out of
   * localStorage, which the server cannot see.
   */
  const [fileCounts, setFileCounts] = useState<Record<string, number> | null>(null);

  /**
   * The member last open, restored once the team is known.
   *
   * Tried again as the team grows: seeded members are there on the first pass, but
   * one added by hand arrives with the localStorage read, and giving up before then
   * would quietly ignore exactly those.
   */
  const restoredMember = useRef(false);

  useEffect(() => {
    if (!project) return;
    setUserMembers(loadUserMembers(project.id));
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const counts: Record<string, number> = {};
    for (const member of [...(PROJECT_TEAMS[project.id] ?? []), ...userMembers]) {
      counts[member.id] = countMemberFiles(project.id, member.id);
    }
    setFileCounts(counts);
  }, [project, userMembers]);

  if (!project) {
    return (
      <p className="text-muted-foreground px-6 py-16 text-center text-sm">
        {t('user.projectNotFound')}
      </p>
    );
  }

  const seeded = PROJECT_TEAMS[project.id] ?? [];
  const allMembers = [...seeded, ...userMembers];

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = (fields: Omit<TeamMember, 'id'>) => {
    const member: TeamMember = { id: `tm-user-${Date.now().toString(36)}`, ...fields };
    const next = [...userMembers, member];
    setUserMembers(next);
    saveUserMembers(project.id, next);
    setFormOpen(false);
    flash(t('user.memberAdded', { name: member.name }));
  };

  const handleEdit = (fields: Omit<TeamMember, 'id'>) => {
    if (!editing) return;
    const updated: TeamMember = { ...editing, ...fields };
    const next = userMembers.map((m) => (m.id === updated.id ? updated : m));
    setUserMembers(next);
    saveUserMembers(project.id, next);
    setEditing(undefined);
    setFormOpen(false);
    flash(t('user.memberUpdated', { name: updated.name }));
  };

  const handleDelete = (id: string) => {
    const next = userMembers.filter((m) => m.id !== id);
    setUserMembers(next);
    saveUserMembers(project.id, next);
    if (selectedId === id) setSelectedId(null);
    flash(t('user.memberRemoved'));
  };

  useEffect(() => {
    if (!project || restoredMember.current || selectedId) return;
    const remembered = loadLastUserView(project.id).member;
    if (!remembered) {
      restoredMember.current = true;
      return;
    }
    if (allMembers.some((entry) => entry.id === remembered)) {
      restoredMember.current = true;
      setSelectedId(remembered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, allMembers, selectedId]);

  useEffect(() => {
    // Not before the restore above has had its turn. On mount `selectedId` is null,
    // and recording that would write null over the very member being restored —
    // which worked once and then forgot, because the memory had been wiped by the
    // time the tab was opened again.
    if (!project || !restoredMember.current) return;
    saveLastUserView(project.id, { member: selectedId });
  }, [project, selectedId]);

  const selected = selectedId ? (allMembers.find((m) => m.id === selectedId) ?? null) : null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Member list */}
      <div
        className={cn(
          'bg-background flex min-h-0 flex-col border-r lg:w-[16rem] lg:shrink-0',
          selected ? 'hidden lg:flex' : 'w-full',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
          <Users className="text-muted-foreground size-3.5" />
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
            {t('user.team')}
          </span>
          <span className="text-muted-foreground text-[10px]">{allMembers.length}</span>
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            title={t('user.addMember')}
            className="text-muted-foreground hover:text-foreground ml-auto rounded p-0.5"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {allMembers.map((member) => {
            const active = selectedId === member.id;
            return (
              <div
                key={member.id}
                className={cn(
                  'group/member flex items-center px-2 py-1.5',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(active ? null : member.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                    {initials(member.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-xs', active && 'font-medium')}>{member.name}</p>
                    <p className="text-[10px] opacity-60">
                      {member.role}
                      {fileCounts && ` · ${fileCounts[member.id] ?? 0} files`}
                    </p>
                  </div>
                </button>
                {isUserMember(member.id) && (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover/member:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(member);
                        setFormOpen(true);
                      }}
                      title={t('member.edit')}
                      className="hover:text-foreground rounded p-0.5"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id)}
                      title={t('member.remove')}
                      className="hover:text-destructive rounded p-0.5"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {allMembers.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-[11px]">
              {t('user.noMembers')}
            </p>
          )}
        </div>
      </div>

      {/* Workspace */}
      {selected ? (
        <UserWorkspace
          key={selected.id}
          member={selected}
          project={project}
          projectId={project.id}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <div className="text-muted-foreground hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center lg:flex">
          <Users className="size-5" />
          <p className="text-foreground text-sm font-medium">{t('user.selectMember')}</p>
          <p className="max-w-sm text-xs">{t('user.selectMemberHint')}</p>
        </div>
      )}

      <MemberFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSave={editing ? handleEdit : handleAdd}
      />

      {toast && (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-xs shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function BusinessUserPage() {
  const { t } = useLocale();
  return (
    <Suspense
      fallback={
        <p className="text-muted-foreground px-6 py-16 text-center text-sm">
          {t('user.loadingTeam')}
        </p>
      }
    >
      <UserPage />
    </Suspense>
  );
}
