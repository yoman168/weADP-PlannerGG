'use client';

import { Check, FileCode2, Folder, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge, Button, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { useBusinessWorkspace } from '@/components/we-adk/business-workspace';
import { ChangeMark } from '@/components/we-adk/change-mark';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { CollapsibleChatAside } from '@/components/we-adk/collapsible-chat-aside';
import { businessPreviewHref } from '@/components/we-adk/mockup-board';
import { saveHtmlAndBlocks } from '@/lib/we-adk/html-to-blocks';
import { addBlankDesign } from '@/lib/we-adk-mock/sketches';
import { versionFolderKey } from '@/lib/we-adk-mock/versions';
import { MiniMockupView } from '@/components/we-adk/mini-mockup-view';
import { loadLastView, saveLastView } from '@/lib/we-adk/last-view';
import {
  folderFiles,
  type DesignFile,
  type DesignFolder,
  type DesignProject,
} from '@/lib/we-adk-mock/projects';
import { CHIP_CLASSES, type VersionStatus } from '@/lib/we-adk-mock/types';
import { type FileDiff } from '@/lib/we-adk/version-diff';
import { workspaceStore } from '@/lib/api/workspace-store';

/* ------------------------------------------------------------------ */
/* Chat persistence                                                    */
/* ------------------------------------------------------------------ */

const FOLDER_CHAT_KEY = 'we-adk:folder-chat';

function loadFolderTurns(projectId: string, folderId: string): ChatTurn[] {
  try {
    const raw = workspaceStore.getItem(`${FOLDER_CHAT_KEY}:${projectId}:${folderId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

function saveFolderTurns(projectId: string, folderId: string, turns: ChatTurn[]): void {
  try {
    workspaceStore.setItem(
      `${FOLDER_CHAT_KEY}:${projectId}:${folderId}`,
      JSON.stringify(turns.slice(-40)),
    );
  } catch {}
}

/* ------------------------------------------------------------------ */
/* What the chat can see                                               */
/* ------------------------------------------------------------------ */

function describeFile(file: DesignFile): string {
  const parts = [file.fileName, file.name];
  if (file.route) parts.push(file.route);
  // A file saved by an older build can be missing its chip; say what is known
  // rather than dropping the whole folder.
  const note = [file.status?.label, `updated ${file.updatedAt}`].filter(Boolean).join(', ');
  return `- ${parts.join(' · ')} (${note})`;
}

/**
 * The whole folder in text: what round it is, where it stands, and every file
 * in it — including the ones in folders someone made inside it. This is what
 * separates a folder chat from the per-file one: it can answer across the round.
 */
function folderChatContext(
  project: DesignProject,
  folder: DesignFolder,
  status: string | undefined,
): string {
  const children = folder.children ?? [];
  const round =
    folder.versionNumber === undefined
      ? folder.label
      : folder.kind === 'group'
        ? `A folder inside version ${folder.versionNumber}${status ? ` (${status})` : ''}`
        : `Version ${folder.versionNumber}${status ? ` — ${status}` : ''}`;
  const lines: string[] = [
    `Project: ${project.name}`,
    `Folder: ${folder.label}`,
    round,
    '',
    folder.files.length > 0
      ? `Design files in this folder (${folder.files.length}):`
      : 'This folder has no design files of its own yet.',
    ...folder.files.map(describeFile),
  ];

  for (const child of children) {
    lines.push(
      '',
      child.files.length > 0
        ? `Folder "${child.name}" (${child.files.length} file${child.files.length === 1 ? '' : 's'}):`
        : `Folder "${child.name}" — empty.`,
      ...child.files.map(describeFile),
    );
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* One file, as a card                                                 */
/* ------------------------------------------------------------------ */

function FileCard({
  file,
  folder,
  projectId,
  change,
}: {
  file: DesignFile;
  folder: DesignFolder;
  projectId: string;
  /** How this file differs from the round it was cut from. */
  change?: FileDiff;
}) {
  // Same rule the explorer follows: every version opens preview-first, version 2
  // included. The canvas is a click away in the preview's Preview/Edit tabs.
  const href = businessPreviewHref(projectId, file.id, folder.id);

  return (
    <Link
      href={href}
      className="bg-background hover:border-primary/40 hover:bg-muted/40 flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors"
    >
      <FileCode2 className="text-muted-foreground size-4 shrink-0" />
      <span className="truncate font-mono text-xs font-medium">{file.fileName}</span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{file.name}</span>
      {file.route && (
        <span className="text-muted-foreground/70 hidden shrink-0 font-mono text-[10px] sm:inline">
          {file.route}
        </span>
      )}
      {/* A / M, the same mark the explorer shows. */}
      <ChangeMark diff={change} />
      {file.status && (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            CHIP_CLASSES[file.status.tone],
          )}
        >
          {file.status.label}
        </span>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* The folder itself                                                   */
/* ------------------------------------------------------------------ */

/**
 * A version folder opened on its own: the round's files on the left, Claude on
 * the right. The per-file chat can only see the screen it sits beside — this one
 * has the whole round in context, which is what you want when the question is
 * about the version rather than about one page of it.
 */
function FolderView({
  project,
  folder,
  status,
  changes,
}: {
  project: DesignProject;
  folder: DesignFolder;
  /** The round's status — a folder inside a version carries its parent's. */
  status: VersionStatus | undefined;
  changes: Record<string, FileDiff>;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const { saveRound, isReleased } = useBusinessWorkspace();
  const children = folder.children ?? [];
  const total = folder.files.length + children.reduce((sum, child) => sum + child.files.length, 0);

  // Saved turns come out of workspace state, so read them after mount and keep one
  // conversation per folder.
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => {
    setTurns(loadFolderTurns(project.id, folder.id));
  }, [project.id, folder.id]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="bg-background flex shrink-0 border-b">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-4 py-2">
          <FolderOpen className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate font-mono text-xs font-medium">{folder.name}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {total} file{total === 1 ? '' : 's'}
          </Badge>
          {status && (
            <Badge
              variant={status === 'Released' ? 'success' : 'info'}
              className="shrink-0 text-[10px]"
            >
              {status}
            </Badge>
          )}
          {folder.versionNumber !== undefined && !isReleased && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => saveRound(folder.versionNumber as number)}
            >
              <Check className="size-3" />
              Complete
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto bg-[#f4f5f7] p-5 dark:bg-[#0b0e14]">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {folder.files.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {folder.files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    folder={folder}
                    projectId={project.id}
                    change={changes[file.id]}
                  />
                ))}
              </div>
            )}

            {children.map((child) => (
              <div key={child.id} className="flex flex-col gap-1.5">
                <p className="text-muted-foreground flex items-center gap-1.5 px-0.5 text-xs font-medium">
                  <Folder className="size-3.5" />
                  {child.name}
                  <span className="font-mono text-[10px]">{child.files.length}</span>
                </p>
                {child.files.length > 0 ? (
                  child.files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      folder={child}
                      projectId={project.id}
                      change={changes[file.id]}
                    />
                  ))
                ) : (
                  <p className="text-muted-foreground/70 px-0.5 text-xs italic">
                    Empty — add a file to it from the explorer.
                  </p>
                )}
              </div>
            ))}

            {total === 0 && (
              <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
                <p>{t('workspace.nothingInFolder', { name: folder.name })}</p>
                <p className="mt-1 text-xs">
                  Add a design file or a folder from the explorer — or ask Claude on the right what
                  this round should cover.
                </p>
              </div>
            )}
          </div>
        </div>

        <CollapsibleChatAside open={chatOpen} onToggle={() => setChatOpen((v) => !v)}>
          <ChatPane
            project={project}
            contextText={folderChatContext(project, folder, status)}
            folderLabel={folder.label}
            greeting={`Ask about ${folder.name}`}
            greetingHint="Ask to build any page — Claude will generate HTML preview and canvas blocks automatically."
            initialTurns={turns}
            onPersist={(next) => saveFolderTurns(project.id, folder.id, next)}
            onResponse={(responseText, userMessage) => {
              const match = responseText.match(/```html\s*\n([\s\S]*?)```/);
              if (!match?.[1]) return;
              const html = match[1].trim();
              // Extract page name from user message
              const nameMatch = userMessage.match(
                /(?:build|create|make|design|generate)\s+(?:me\s+)?(?:a\s+)?(.+?)(?:\s+page|\s+screen)?$/i,
              );
              const pageName = nameMatch?.[1]?.trim() ?? 'Generated Page';
              const fileName = pageName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
              const folderKey = versionFolderKey(project.id, folder.versionNumber ?? 1);
              const today = new Date().toISOString().slice(0, 10);
              const screen = addBlankDesign(
                folderKey,
                { name: pageName, route: `/${fileName}`, seedPattern: 'listPage' },
                today,
              );
              saveHtmlAndBlocks(screen.id, html);
              router.push(businessPreviewHref(project.id, screen.id, folder.id));
            }}
          />
        </CollapsibleChatAside>
      </div>
    </div>
  );
}

/**
 * The Main tab with no file open. Pick a folder in the explorer and you land
 * here — the round's contents, and a chat that can see all of them. Arriving
 * without a folder still jumps to the first file, so opening the project puts
 * you on something you can work with.
 */
export default function ProjectFilesPage() {
  const { project, folders, activeFolder, changes } = useBusinessWorkspace();
  const router = useRouter();

  // Archived (mini mockup) projects use their own meeting-based layout
  if (project.archived) {
    return <MiniMockupView projectId={project.id} projectName={project.name} />;
  }
  // The URL is the authority on whether a folder was chosen: rounds after the
  // first are workspace state, so `?folder=version-2` resolves a beat after
  // mount — redirecting on the empty first render would bounce a reload of this
  // page straight to some other file's preview.
  const chosen = useSearchParams().get('folder');
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);

  /**
   * Long enough for the tree to arrive.
   *
   * Rounds after the first are built from workspace state in an effect, so the first
   * pass here sees only the baseline. Deciding then meant a remembered `version-2`
   * looked as though it had been deleted: the memory was cleared and the page
   * redirected to version 1 — the very bug this is meant to fix.
   */
  const [treeReady, setTreeReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTreeReady(true), 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (chosen) return;

    // Where you were last. Without this, coming back from Task or User landed on
    // the first file of the first round, so a session spent in version 2 kept
    // being pulled back to version 1.
    const { folder: remembered, screen: rememberedScreen } = loadLastView(project.id);
    if (remembered) {
      const files = folderFiles(folders, remembered);
      // The file that was open, if it is still in there — otherwise the folder's
      // first, which is what "open the folder" means when nothing was open.
      const target = files.find((file) => file.id === rememberedScreen) ?? files[0];
      if (target) {
        router.replace(businessPreviewHref(project.id, target.id, target.folderId));
        return;
      }
      // Not there — but possibly not loaded yet. Wait; only once the tree has had
      // its chance is a missing folder really gone.
      if (!treeReady) return;
      // An empty folder is still a folder: select it and show its (empty) listing
      // rather than throwing the memory away and jumping to another round.
      const exists = folders.some(
        (folder) =>
          folder.id === remembered ||
          (folder.children ?? []).some((child) => child.id === remembered),
      );
      if (exists) {
        router.replace(`/we-adk/projects/${project.id}/sketcher?folder=${remembered}`, {
          scroll: false,
        });
        return;
      }
      saveLastView(project.id, { folder: null, screen: null });
    }

    const first = folderFiles(folders, null)[0];
    if (first) router.replace(businessPreviewHref(project.id, first.id, first.folderId));
  }, [project.id, folders, chosen, router, treeReady]);

  if (!activeFolder) {
    // Still hydrating the tree — say nothing rather than flashing a message.
    if (chosen && !settled) return <div className="min-w-0 flex-1" />;
    return (
      <div className="text-muted-foreground flex min-w-0 flex-1 items-center justify-center text-sm">
        Pick a design file in the explorer to preview it.
      </div>
    );
  }

  // A folder inside a round inherits the round's status.
  const parent =
    activeFolder.kind === 'group'
      ? folders.find(
          (entry) => entry.kind === 'version' && entry.versionNumber === activeFolder.versionNumber,
        )
      : activeFolder;
  const status = parent?.versionStatus;

  return (
    <FolderView
      key={activeFolder.id}
      project={project}
      folder={activeFolder}
      status={status}
      changes={changes}
    />
  );
}
