'use client';

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  MessageSquare,
  Microscope,
  Paperclip,
  Search,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Input, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { loadUploadedFiles, sessionFiles } from '@/lib/we-adk-mock/meeting-files';
import { findProject, type DesignProject } from '@/lib/we-adk-mock/projects';

/* ------------------------------------------------------------------ */
/* Data types                                                          */
/* ------------------------------------------------------------------ */

interface ChatFolder {
  id: string;
  title: string;
}

interface StoredChat {
  id: string;
  title: string;
  folderId?: string;
  /** Pinned to a specific reference file from the meeting library. */
  fileId?: string;
  updatedAt: string;
  turns: ChatTurn[];
}

/* ------------------------------------------------------------------ */
/* localStorage helpers                                                */
/* ------------------------------------------------------------------ */

const CHAT_STORE = 'we-adk:research:chats';
const FOLDER_STORE = 'we-adk:research:chat-folders';

function loadChats(projectId: string): StoredChat[] {
  try {
    const raw = window.localStorage.getItem(`${CHAT_STORE}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredChat[]) : [];
  } catch {
    return [];
  }
}

function saveChats(projectId: string, chats: StoredChat[]): void {
  try {
    window.localStorage.setItem(`${CHAT_STORE}:${projectId}`, JSON.stringify(chats.slice(0, 30)));
  } catch {}
}

function loadChatFolders(projectId: string): ChatFolder[] {
  try {
    const raw = window.localStorage.getItem(`${FOLDER_STORE}:${projectId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatFolder[]) : [];
  } catch {
    return [];
  }
}

function saveChatFolders(projectId: string, folders: ChatFolder[]): void {
  try {
    window.localStorage.setItem(`${FOLDER_STORE}:${projectId}`, JSON.stringify(folders));
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Context builder (used for AI responses, not shown in sidebar)       */
/* ------------------------------------------------------------------ */

function projectResearchContext(
  project: DesignProject,
  filesBySession: Record<string, ReturnType<typeof sessionFiles>>,
): string {
  const parts = [
    `Project: ${project.name} — ${project.customer}. Owner ${project.owner}.`,
    'Research library — every reference file the meetings collected:',
  ];
  const ordered = [...project.sessions].sort((a, b) => a.metAt.localeCompare(b.metAt));
  for (const session of ordered) {
    parts.push('', `Meeting "${session.title}" (${session.metAt}):`);
    const attached = filesBySession[session.id] ?? [];
    if (attached.length === 0) parts.push('- no files attached');
    for (const file of attached) {
      parts.push(`- ${file.name}${file.note ? ` — ${file.note}` : ''}`);
      if (file.text) parts.push(file.text.slice(0, 1_500));
    }
  }
  return parts.join('\n').slice(0, 14_000);
}

/* ------------------------------------------------------------------ */
/* The browser                                                         */
/* ------------------------------------------------------------------ */

function ResearchBrowser() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const project = findProject(params.projectId);

  const { t } = useLocale();
  const urlChatId = searchParams.get('chat');
  // Drive the pane from local state so the ChatPane opens instantly on click,
  // without waiting for router.replace to propagate through useSearchParams.
  const [localChatId, setLocalChatId] = useState<string | null>(urlChatId);
  const chatId = localChatId ?? urlChatId;

  const [chats, setChats] = useState<StoredChat[]>([]);
  const [chatFolders, setChatFolders] = useState<ChatFolder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [needle, setNeedle] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  // Research files are loaded for AI context only — not shown in the sidebar.
  const [researchFiles, setResearchFiles] = useState<
    Record<string, ReturnType<typeof sessionFiles>>
  >({});

  useEffect(() => {
    if (!project) return;
    setChats(loadChats(project.id));
    setChatFolders(loadChatFolders(project.id));
    const loaded: typeof researchFiles = {};
    for (const session of project.sessions) {
      loaded[session.id] = sessionFiles(session.id, loadUploadedFiles(session.id));
    }
    setResearchFiles(loaded);
  }, [project]);

  if (!project) {
    return (
      <p className="text-muted-foreground px-6 py-16 text-center text-sm">
        That project does not exist.
      </p>
    );
  }

  const query = needle.trim().toLowerCase();
  const matches = (text: string) => !query || text.toLowerCase().includes(query);

  const base = `/we-adk/projects/${project.id}/sketcher/research`;
  const openChat = (id: string | null) => {
    setLocalChatId(id);
    router.replace(id ? `${base}?chat=${id}` : base, { scroll: false });
  };

  const startChat = (folderId?: string) => {
    const id = `chat-${Date.now().toString(36)}`;
    // Pre-create with folderId so it lands in the right folder immediately.
    if (folderId) {
      const entry: StoredChat = {
        id,
        title: 'New chat',
        folderId,
        updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        turns: [],
      };
      const next = [entry, ...chats];
      setChats(next);
      saveChats(project.id, next);
    }
    openChat(id);
  };

  const persistChat = (
    id: string,
    turns: ChatTurn[],
    fallback: { title: string; folderId?: string },
  ) => {
    const existing = chats.find((c) => c.id === id);
    const next: StoredChat[] = [
      {
        id,
        title:
          existing?.title && existing.title !== 'New chat'
            ? existing.title
            : (turns.find((t) => t.role === 'user')?.text.slice(0, 60) ?? fallback.title),
        folderId: existing?.folderId ?? fallback.folderId,
        updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        turns,
      },
      ...chats.filter((c) => c.id !== id),
    ];
    setChats(next);
    saveChats(project.id, next);
  };

  const removeChat = (id: string) => {
    const next = chats.filter((c) => c.id !== id);
    setChats(next);
    saveChats(project.id, next);
    if (localChatId === id || urlChatId === id) openChat(null);
  };

  const commitFolder = () => {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName('');
    if (!name) return;
    const folder: ChatFolder = { id: `cf-${Date.now().toString(36)}`, title: name };
    const next = [...chatFolders, folder];
    setChatFolders(next);
    saveChatFolders(project.id, next);
    setExpanded((prev) => new Set(prev).add(folder.id));
  };

  const deleteFolder = (folderId: string) => {
    // Move orphaned chats out of the deleted folder.
    const updatedChats = chats.map((c) =>
      c.folderId === folderId ? { ...c, folderId: undefined } : c,
    );
    setChats(updatedChats);
    saveChats(project.id, updatedChats);
    const next = chatFolders.filter((f) => f.id !== folderId);
    setChatFolders(next);
    saveChatFolders(project.id, next);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeChat = chatId ? (chats.find((c) => c.id === chatId) ?? null) : null;
  const contextText = projectResearchContext(project, researchFiles);

  // Categorise chats for the sidebar
  const uncategorised = chats.filter((c) => !c.folderId && matches(c.title));

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-background flex min-h-0 flex-col border-r lg:w-[19rem] lg:shrink-0',
          chatId ? 'hidden lg:flex' : 'w-full',
        )}
      >
        {/* Search */}
        <div className="shrink-0 border-b px-3 py-2.5">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <label className="sr-only" htmlFor="research-search">
              Search chats
            </label>
            <Input
              id="research-search"
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder={t('research.searchChats')}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {/* New chat */}
          <button
            type="button"
            onClick={() => startChat()}
            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium"
          >
            <SquarePen className="size-3.5 shrink-0" />
            New chat
          </button>

          {/* AI CHAT section header */}
          <div className="flex items-center justify-between px-2 pt-2 pb-1">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
              AI Chat
            </p>
            <button
              type="button"
              onClick={() => {
                setCreatingFolder(true);
                setNewFolderName('');
              }}
              title={t('research.newFolder')}
              aria-label={t('research.createFolder')}
              className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
            >
              <FolderPlus className="size-3.5" />
            </button>
          </div>

          {/* Inline folder name input */}
          {creatingFolder && (
            <div className="mb-1 flex items-center gap-1.5 px-2 py-1">
              <Folder className="text-muted-foreground size-3.5 shrink-0" />
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitFolder();
                  if (e.key === 'Escape') {
                    setCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
                onBlur={commitFolder}
                placeholder={t('research.folderName')}
                className="h-6 text-xs"
              />
            </div>
          )}

          {/* Chat folders */}
          {chatFolders
            .filter((f) => !query || f.title.toLowerCase().includes(query))
            .map((folder) => {
              const folderChats = chats.filter((c) => c.folderId === folder.id && matches(c.title));
              const open = expanded.has(folder.id);
              const FolderIcon = open ? FolderOpen : Folder;
              return (
                <div key={folder.id} className="mb-0.5">
                  <div className="group/folder flex w-full items-center">
                    <button
                      type="button"
                      onClick={() => toggle(folder.id)}
                      aria-expanded={open}
                      className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium"
                    >
                      {open ? (
                        <ChevronDown className="size-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0" />
                      )}
                      <FolderIcon className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{folder.title}</span>
                      <span className="shrink-0 font-mono text-[10px]">{folderChats.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startChat(folder.id)}
                      title={t('research.newChat')}
                      aria-label={`New chat in ${folder.title}`}
                      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 opacity-0 transition-opacity group-hover/folder:opacity-100 focus-visible:opacity-100"
                    >
                      <SquarePen className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFolder(folder.id)}
                      title={t('research.deleteFolder')}
                      aria-label={`Delete folder ${folder.title}`}
                      className="hover:text-destructive text-muted-foreground shrink-0 rounded p-1 opacity-0 transition-opacity group-hover/folder:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {open && (
                    <div className="ml-6 border-l">
                      {folderChats.map((chat) => {
                        const active = chat.id === chatId;
                        return (
                          <div
                            key={chat.id}
                            className={cn(
                              'group/chat flex w-full items-center rounded-r-md',
                              active
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted/60',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => openChat(chat.id)}
                              aria-pressed={active}
                              title={chat.title}
                              className={cn(
                                'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-3 text-left text-xs',
                                active ? 'font-medium' : 'hover:text-foreground',
                              )}
                            >
                              {chat.fileId ? (
                                <Paperclip className="size-3.5 shrink-0" />
                              ) : (
                                <MessageSquare className="size-3.5 shrink-0" />
                              )}
                              <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeChat(chat.id)}
                              title={t('research.deleteChat')}
                              aria-label={`Delete "${chat.title}"`}
                              className="hover:text-destructive shrink-0 px-2 opacity-0 transition-opacity group-hover/chat:opacity-100 focus-visible:opacity-100"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                      {folderChats.length === 0 && (
                        <p className="text-muted-foreground/60 py-1 pl-3 text-[11px] italic">
                          empty
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Uncategorised chats */}
          {uncategorised.length > 0 && (
            <>
              {chatFolders.length > 0 && (
                <p className="text-muted-foreground px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase">
                  Other
                </p>
              )}
              {uncategorised.map((chat) => {
                const active = chat.id === chatId;
                return (
                  <div
                    key={chat.id}
                    className={cn(
                      'group/chat flex w-full items-center rounded-md',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(chat.id)}
                      aria-pressed={active}
                      title={chat.title}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2 text-left text-xs',
                        active ? 'font-medium' : 'hover:text-foreground',
                      )}
                    >
                      {chat.fileId ? (
                        <Paperclip className="size-3.5 shrink-0" />
                      ) : (
                        <MessageSquare className="size-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChat(chat.id)}
                      title={t('research.deleteChat')}
                      aria-label={`Delete "${chat.title}"`}
                      className="hover:text-destructive shrink-0 px-2 opacity-0 transition-opacity group-hover/chat:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <p className="text-muted-foreground shrink-0 border-t px-3 py-2 text-[10px] leading-relaxed">
          Chat with Claude about this project's research.
        </p>
      </aside>

      {/* Chat pane */}
      <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col">
        {chatId ? (
          <ChatPane
            key={chatId}
            project={project}
            contextText={contextText}
            folderLabel="research"
            initialTurns={activeChat?.turns ?? []}
            greeting="What do you want to know about this research?"
            onPersist={(turns) =>
              persistChat(chatId, turns, {
                title: turns.find((t) => t.role === 'user')?.text.slice(0, 60) ?? 'New chat',
                folderId: activeChat?.folderId,
              })
            }
          />
        ) : (
          <div className="text-muted-foreground hidden min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center lg:flex">
            <Microscope className="size-5" />
            <p className="text-foreground text-sm font-medium">Start a chat.</p>
            <p className="max-w-sm text-xs">
              Ask Claude about the project's research, meetings, or customer feedback. Organise
              conversations into folders to keep topics separate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BusinessResearchPage() {
  return (
    <Suspense
      fallback={
        <p className="text-muted-foreground px-6 py-16 text-center text-sm">Loading research…</p>
      }
    >
      <ResearchBrowser />
    </Suspense>
  );
}
