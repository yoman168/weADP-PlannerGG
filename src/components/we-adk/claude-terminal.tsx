'use client';

import {
  ArrowUp,
  CircleStop,
  ImagePlus,
  Loader2,
  Paperclip,
  Plus,
  SquareTerminal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { claudeHeaders } from '@/lib/we-adk/claude-account';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { isReadableFileName } from '@/lib/we-adk-mock/meeting-files';
import { type DesignFolder, type DesignProject } from '@/lib/we-adk-mock/projects';
import { buildFolderChatContext } from '@/lib/we-adk/folder-chat';

/**
 * A Claude Code session pinned to one folder — styled like the rest of WE-ADK
 * rather than a raw terminal, but still backed by the actual Claude Code CLI on
 * this machine via the streaming bridge. Supports switching model and attaching
 * images (read by the CLI's Read tool) or files (text goes into the prompt).
 */

const MODELS = [
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
  { id: 'haiku', label: 'Haiku' },
] as const;

type ModelId = (typeof MODELS)[number]['id'];

const MODEL_KEY = 'we-adk:sketcher:chat-model';
const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 8_000;

interface Attachment {
  name: string;
  kind: 'image' | 'text' | 'binary';
  mediaType?: string;
  dataBase64?: string;
  text?: string;
  sizeKb: number;
}

interface TurnMeta {
  durationMs?: number;
  costUsd?: number;
  outputTokens?: number;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  meta?: TurnMeta;
  interrupted?: boolean;
  attachments?: { name: string; kind: Attachment['kind'] }[];
}

function storageKey(projectId: string, folderId: string): string {
  return `we-adk:sketcher:chat:${projectId}:${folderId}`;
}

function loadTurns(projectId: string, folderId: string): Turn[] {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId, folderId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Turn[]) : [];
  } catch {
    return [];
  }
}

function saveTurns(projectId: string, folderId: string, turns: Turn[]): void {
  try {
    window.localStorage.setItem(storageKey(projectId, folderId), JSON.stringify(turns.slice(-40)));
  } catch {
    // Storage unavailable — the session just won't survive a reload.
  }
}

function metaLine(meta: TurnMeta): string {
  const parts: string[] = [];
  if (meta.durationMs !== undefined) parts.push(`${(meta.durationMs / 1000).toFixed(1)}s`);
  if (meta.costUsd !== undefined) parts.push(`$${meta.costUsd.toFixed(4)}`);
  if (meta.outputTokens !== undefined) parts.push(`${meta.outputTokens} tok`);
  return parts.join(' · ');
}

/** Pulls the useful part out of one CLI stream event. */
function readEvent(
  line: string,
):
  | { kind: 'model'; model: string }
  | { kind: 'delta'; text: string }
  | { kind: 'full'; text: string }
  | { kind: 'result'; meta: TurnMeta }
  | { kind: 'error'; error: string }
  | { kind: 'ignore' } {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return { kind: 'ignore' };
  }

  if (event.type === 'bridge_error' && typeof event.error === 'string') {
    return { kind: 'error', error: event.error };
  }
  if (event.type === 'system' && event.subtype === 'init' && typeof event.model === 'string') {
    return { kind: 'model', model: event.model };
  }
  if (event.type === 'stream_event') {
    const inner = (event.event ?? {}) as Record<string, unknown>;
    const delta = (inner.delta ?? {}) as Record<string, unknown>;
    if (inner.type === 'content_block_delta' && delta.type === 'text_delta') {
      return { kind: 'delta', text: String(delta.text ?? '') };
    }
    return { kind: 'ignore' };
  }
  if (event.type === 'assistant') {
    const message = (event.message ?? {}) as { content?: unknown };
    const blocks = Array.isArray(message.content) ? message.content : [];
    const text = blocks
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === 'object' &&
          block !== null &&
          (block as { type?: unknown }).type === 'text',
      )
      .map((block) => block.text)
      .join('');
    return text ? { kind: 'full', text } : { kind: 'ignore' };
  }
  if (event.type === 'result') {
    const usage = (event.usage ?? {}) as Record<string, unknown>;
    const numberOf = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    return {
      kind: 'result',
      meta: {
        durationMs: numberOf(event.duration_ms),
        costUsd: numberOf(event.total_cost_usd),
        outputTokens: numberOf(usage.output_tokens),
      },
    };
  }
  return { kind: 'ignore' };
}

async function toAttachment(file: File): Promise<Attachment | null> {
  const sizeKb = Math.round(file.size / 1024);
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
    return {
      name: file.name,
      kind: 'image',
      mediaType: file.type,
      dataBase64: dataUrl.split(',')[1] ?? '',
      sizeKb,
    };
  }
  if (isReadableFileName(file.name)) {
    const text = (await file.text().catch(() => '')).slice(0, MAX_TEXT_CHARS);
    return { name: file.name, kind: 'text', text, sizeKb };
  }
  return { name: file.name, kind: 'binary', sizeKb };
}

export function ClaudeTerminal({
  project,
  folder,
}: {
  project: DesignProject;
  folder: DesignFolder;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [model, setModel] = useState<ModelId>('sonnet');
  const [liveModel, setLiveModel] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const { t } = useLocale();

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const context = useMemo(() => buildFolderChatContext(project, folder), [project, folder]);

  // Each folder keeps its own transcript; the model choice is shared.
  useEffect(() => {
    setTurns(loadTurns(project.id, folder.id));
    setStreamText('');
    setPending(false);
    try {
      const saved = window.localStorage.getItem(MODEL_KEY);
      if (saved && MODELS.some((entry) => entry.id === saved)) setModel(saved as ModelId);
    } catch {
      // keep default
    }
  }, [project.id, folder.id]);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  // Escape interrupts, exactly like the real thing.
  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') abortRef.current?.abort();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, streamText, pending]);

  const commit = (next: Turn[]) => {
    setTurns(next);
    saveTurns(project.id, folder.id, next);
  };

  const pickModel = (value: string) => {
    setModel(value as ModelId);
    try {
      window.localStorage.setItem(MODEL_KEY, value);
    } catch {
      // fine
    }
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    const converted = await Promise.all(picked.slice(0, room).map(toAttachment));
    const ok = converted.filter((entry): entry is Attachment => entry !== null);
    if (converted.some((entry) => entry === null)) {
      setNotice(`Images over ${MAX_IMAGE_BYTES / 1024 / 1024} MB were skipped.`);
      window.setTimeout(() => setNotice(null), 4000);
    }
    setAttachments((current) => [...current, ...ok]);
  };

  const send = async () => {
    const message = input.trim();
    if ((!message && attachments.length === 0) || pending) return;

    if (message === '/clear') {
      commit([]);
      setInput('');
      return;
    }

    const sent = attachments;
    const text = message || '(see attachments)';
    const history = turns.slice(-24).map((turn) => ({ role: turn.role, text: turn.text }));
    const afterUser: Turn[] = [
      ...turns,
      {
        role: 'user',
        text,
        attachments: sent.map((entry) => ({ name: entry.name, kind: entry.kind })),
      },
    ];
    commit(afterUser);
    setInput('');
    setAttachments([]);
    setPending(true);
    setStreamText('');

    const controller = new AbortController();
    abortRef.current = controller;

    let acc = '';
    let meta: TurnMeta | undefined;
    let errorText: string | null = null;

    try {
      const response = await fetch('/api/sketcher/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history,
          context,
          folderLabel: `${folder.name}/ (${folder.label})`,
          projectName: project.name,
          model,
          attachments: sent.map(({ sizeKb: _sizeKb, ...rest }) => rest),
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
            const event = readEvent(line);
            if (event.kind === 'model') setLiveModel(event.model);
            else if (event.kind === 'delta') {
              acc += event.text;
              setStreamText(acc);
            } else if (event.kind === 'full') {
              acc = event.text;
              setStreamText(acc);
            } else if (event.kind === 'result') meta = event.meta;
            else if (event.kind === 'error') errorText = event.error;
          }
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        errorText = 'Lost the connection to the local bridge.';
      }
    }

    const interrupted = controller.signal.aborted;
    abortRef.current = null;
    setPending(false);
    setStreamText('');

    const assistantText =
      acc.trim().length > 0
        ? acc.trim()
        : interrupted
          ? '(interrupted before any output)'
          : (errorText ?? '(no output)');
    commit([
      ...afterUser,
      {
        role: 'assistant',
        text: assistantText,
        meta,
        interrupted: interrupted || errorText !== null,
      },
    ]);
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">

      {/* Conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {turns.length === 0 && !pending && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            This session knows everything in <span className="font-mono">{folder.name}/</span> — ask
            about the notes, the decisions, what to sketch next. Attach a screenshot or a file to
            bring it into the conversation. <span className="opacity-70">/clear resets.</span>
          </p>
        )}

        <div className="flex flex-col gap-3">
          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <div key={index} className="flex justify-end">
                <div className="bg-muted max-w-[85%] rounded-lg px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                  {(turn.attachments?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {turn.attachments?.map((file) => (
                        <Badge key={file.name} variant="outline" className="gap-1 text-[10px]">
                          {file.kind === 'image' ? (
                            <ImagePlus className="size-2.5" />
                          ) : (
                            <Paperclip className="size-2.5" />
                          )}
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={index} className="flex gap-2">
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    turn.interrupted ? 'bg-destructive' : 'bg-primary',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                  {turn.meta && metaLine(turn.meta) && (
                    <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                      {metaLine(turn.meta)}
                    </p>
                  )}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex gap-2">
              <span className="bg-primary mt-1.5 size-2 shrink-0 animate-pulse rounded-full" />
              <div className="min-w-0">
                {streamText ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {streamText}
                    <span className="text-primary animate-pulse">▌</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <Loader2 className="size-3.5 animate-spin" />
                    Thinking… <span className="text-xs">esc to interrupt · {elapsed}s</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t px-3 py-2.5">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((file, index) => (
              <Badge
                key={`${file.name}-${index}`}
                variant="secondary"
                className="gap-1 pr-1 text-[10px]"
              >
                {file.kind === 'image' ? (
                  <ImagePlus className="size-2.5" />
                ) : (
                  <Paperclip className="size-2.5" />
                )}
                <span className="max-w-[10rem] truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setAttachments((current) => current.filter((_, at) => at !== index))
                  }
                  className="hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="border-input focus-within:border-ring flex items-end gap-1.5 rounded-md border px-2 py-1.5">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={Math.min(3, Math.max(1, input.split('\n').length))}
            disabled={pending}
            placeholder={t('terminal.promptPlaceholder')}
            aria-label={`Claude Code chat for ${folder.label}`}
            className="placeholder:text-muted-foreground min-w-0 flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-60"
          />
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            title={t('terminal.attachFile')}
            aria-label={t('terminal.attachFile')}
            disabled={pending || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="size-3.5" />
          </Button>
          {pending ? (
            <Button
              size="sm"
              variant="outline"
              className="size-7 p-0"
              title={t('terminal.stop')}
              aria-label={t('terminal.stopResponse')}
              onClick={() => abortRef.current?.abort()}
            >
              <CircleStop className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="size-7 p-0"
              title={t('terminal.send')}
              aria-label={t('terminal.sendMessage')}
              disabled={!input.trim() && attachments.length === 0}
              onClick={() => void send()}
            >
              <ArrowUp className="size-3.5" />
            </Button>
          )}
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label={t('terminal.attachImages')}
          onChange={(event) => void addFiles(event)}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label={t('terminal.attachFiles')}
          onChange={(event) => void addFiles(event)}
        />

        <p className="text-muted-foreground mt-1.5 text-[10px]">
          {notice ?? 'Runs on the Claude Code CLI installed on this machine · /clear resets'}
        </p>
      </div>
    </div>
  );
}
