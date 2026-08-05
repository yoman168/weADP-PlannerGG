'use client';

/**
 * The Claude chat pane WE-ADK embeds under its documents — Research files,
 * meetings, anything with a context to pin the conversation to. One component:
 * markdown-rendered replies, attachments, dictation, read-aloud, stop, and the
 * caller decides where finished turns are persisted.
 */
import {
  ArrowUp,
  AudioLines,
  CircleStop,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { formatFileSize } from '@/lib/we-adk-mock/meeting-files';
import { type DesignProject } from '@/lib/we-adk-mock/projects';

/* Asking Claude about the open file                                   */
/* ------------------------------------------------------------------ */

const MODELS = [
  { id: 'opus', label: 'Opus 5' },
  { id: 'sonnet', label: 'Sonnet 5' },
  { id: 'haiku', label: 'Haiku' },
] as const;

type ModelId = (typeof MODELS)[number]['id'];

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  /** Names of the files sent with a user turn. */
  attachments?: { name: string }[];
}

/** The slice of the CLI stream this pane cares about. */
export function readChatEvent(
  line: string,
): { kind: 'delta' | 'full' | 'error'; text: string } | { kind: 'ignore' } {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return { kind: 'ignore' };
  }
  if (event.type === 'bridge_error' && typeof event.error === 'string') {
    return { kind: 'error', text: event.error };
  }
  if (event.type === 'stream_event') {
    const inner = (event.event ?? {}) as Record<string, unknown>;
    const delta = (inner.delta ?? {}) as Record<string, unknown>;
    if (inner.type === 'content_block_delta' && delta.type === 'text_delta') {
      return { kind: 'delta', text: String(delta.text ?? '') };
    }
    return { kind: 'ignore' };
  }
  // The CLI's closing envelope. A run that ended without answering — it hit the
  // turn limit, or errored — reports it here and nowhere else, so without this
  // the pane would fall back to a bare "(no reply)".
  if (event.type === 'result' && typeof event.subtype === 'string' && event.subtype !== 'success') {
    const detail = typeof event.result === 'string' ? event.result : '';
    return {
      kind: 'error',
      text:
        event.subtype === 'error_max_turns'
          ? 'Claude stopped before answering — it went looking for something instead of replying. Ask again, more specifically.'
          : detail || 'Claude Code ended without a reply.',
    };
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
  return { kind: 'ignore' };
}

/* ------------------------------------------------------------------ */
/* Attachments & voice                                                 */
/* ------------------------------------------------------------------ */

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 8_000;

interface ChatAttachment {
  name: string;
  kind: 'image' | 'text' | 'binary';
  mediaType?: string;
  dataBase64?: string;
  text?: string;
  sizeKb: number;
}

const READABLE_EXTENSIONS = /\.(txt|md|csv|json|xml|yaml|yml|log|ts|tsx|js|jsx|py|html|css)$/i;
function isReadableFileName(name: string): boolean {
  return READABLE_EXTENSIONS.test(name);
}

/** Images travel as base64 for the CLI to read; text files go in as text. */
async function toAttachment(file: File): Promise<ChatAttachment | null> {
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
  if (file.type.startsWith('text/') || isReadableFileName(file.name)) {
    const text = await file.text();
    return { name: file.name, kind: 'text', text: text.slice(0, MAX_TEXT_CHARS), sizeKb };
  }
  return { name: file.name, kind: 'binary', sizeKb };
}

/** The browser speech API, typed down to the sliver this composer uses. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createRecognition(): SpeechRecognitionLike | null {
  const scope = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

/* ------------------------------------------------------------------ */
/* Markdown-lite for chat replies                                      */
/* ------------------------------------------------------------------ */

/** Inline emphasis: `code` chips and **bold**, nothing fancier. */
function renderInline(text: string): React.ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="bg-muted rounded px-1.5 py-0.5 font-mono text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

type ChatBlock =
  | { type: 'heading'; depth: number; text: string }
  | { type: 'para'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'rule' };

/**
 * The model answers in Markdown; rendering it raw is what made replies look
 * broken. This covers what chat answers actually use — headings, lists, fenced
 * code, rules, emphasis — and treats an unclosed fence as code, so streaming
 * output renders sensibly mid-thought.
 */
function parseChatMarkdown(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let paragraph: string[] = [];
  let code: { lang: string; lines: string[] } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'para', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (code) {
      if (line.startsWith('```')) {
        blocks.push({ type: 'code', lang: code.lang, lines: code.lines });
        code = null;
      } else {
        code.lines.push(raw);
      }
      continue;
    }
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      flush();
      code = { lang: fence[1] ?? '', lines: [] };
      continue;
    }
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', depth: heading[1]?.length ?? 2, text: heading[2] ?? '' });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
      blocks.push({ type: 'rule' });
      continue;
    }
    const bullet = /^[-*\u00b7]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const last = blocks.at(-1);
      if (last?.type === 'list' && !last.ordered) last.items.push(bullet[1] ?? '');
      else blocks.push({ type: 'list', ordered: false, items: [bullet[1] ?? ''] });
      continue;
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flush();
      const last = blocks.at(-1);
      if (last?.type === 'list' && last.ordered) last.items.push(numbered[1] ?? '');
      else blocks.push({ type: 'list', ordered: true, items: [numbered[1] ?? ''] });
      continue;
    }
    paragraph.push(line);
  }
  if (code) blocks.push({ type: 'code', lang: code.lang, lines: code.lines });
  flush();
  return blocks;
}

export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {parseChatMarkdown(text).map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <p
                key={index}
                className={cn('font-semibold', block.depth <= 2 ? 'mt-1 text-base' : 'text-sm')}
              >
                {renderInline(block.text)}
              </p>
            );
          case 'list': {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ));
            return block.ordered ? (
              <ol
                key={index}
                className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed"
              >
                {items}
              </ol>
            ) : (
              <ul
                key={index}
                className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed"
              >
                {items}
              </ul>
            );
          }
          case 'code':
            return (
              <div key={index} className="bg-muted/40 overflow-hidden rounded-lg border">
                {block.lang && (
                  <p className="text-muted-foreground px-3.5 pt-2 text-[11px]">{block.lang}</p>
                )}
                <pre
                  className={cn(
                    'overflow-x-auto px-3.5 pb-3 font-mono text-xs leading-relaxed',
                    block.lang ? 'pt-1' : 'pt-3',
                  )}
                >
                  {block.lines.join('\n')}
                </pre>
              </div>
            );
          case 'rule':
            return <hr key={index} className="border-t" />;
          default:
            return (
              <p key={index} className="text-sm leading-relaxed">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

/**
 * A conversation with the local Claude Code bridge, optionally with a document
 * above it: the content scrolls, the composer stays pinned, and every finished
 * exchange is handed back up to be saved — so a chat survives reloads and shows
 * up in the sidebar, the way Claude chat keeps history.
 */
export function ChatPane({
  project,
  contextText,
  folderLabel,
  initialTurns,
  greeting,
  greetingHint,
  pendingPrompt,
  onPromptHandled,
  onPersist,
  children,
}: {
  project: DesignProject;
  contextText: string;
  folderLabel: string;
  initialTurns: ChatTurn[];
  /** Shown centred when there is no document and nothing has been said yet. */
  greeting?: string;
  /** The line under the greeting — say what this particular chat can see. */
  greetingHint?: string;
  /**
   * A message handed to the pane from outside it — how a button elsewhere on
   * the page asks Claude something. It is sent exactly as a typed one would be.
   */
  pendingPrompt?: string | null;
  /** Called as the prompt is taken, so the caller can clear it. */
  onPromptHandled?: () => void;
  onPersist: (turns: ChatTurn[]) => void;
  children?: React.ReactNode;
}) {
  const { t } = useLocale();
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [model, setModel] = useState<ModelId>('opus');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Which voice features this browser actually has — checked after mount.
  const [voiceOk, setVoiceOk] = useState({ dictation: false, playback: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setVoiceOk({
      dictation: createRecognition() !== null,
      playback: 'speechSynthesis' in window,
    });
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      abortRef.current?.abort();
    };
  }, []);

  // Saved turns arrive from localStorage after mount; adopt them as long as
  // nothing has been said in this pane yet.
  useEffect(() => {
    setTurns((current) =>
      current.length === 0 && initialTurns.length > 0 ? initialTurns : current,
    );
  }, [initialTurns]);

  // Follow the conversation the way a chat window does.
  useEffect(() => {
    const node = scrollRef.current;
    if (node && (turns.length > 0 || streamText)) node.scrollTop = node.scrollHeight;
  }, [turns, streamText]);

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    const room = MAX_ATTACHMENTS - attachments.length;
    const next: ChatAttachment[] = [];
    for (const file of picked.slice(0, room)) {
      const attachment = await toAttachment(file);
      if (attachment) next.push(attachment);
    }
    if (next.length > 0) {
      setAttachments((current) => [...current, ...next].slice(0, MAX_ATTACHMENTS));
    }
  };

  const toggleDictation = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = createRecognition();
    if (!recognition) return;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal) finalText += result[0].transcript;
      }
      if (finalText.trim()) {
        setInput((current) => `${current ? `${current} ` : ''}${finalText.trim()}`);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const lastReply = [...turns].reverse().find((turn) => turn.role === 'assistant' && !turn.error);

  const toggleReadAloud = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!lastReply) return;
    // Markdown marks read terribly, so strip them before speaking.
    const plain = lastReply.text.replace(/```[\s\S]*?```/g, ' code block. ').replace(/[`*#_]/g, '');
    const utterance = new SpeechSynthesisUtterance(plain.slice(0, 2_000));
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  /** `override` is a message pushed in from outside; otherwise the composer's. */
  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if ((!text && attachments.length === 0) || pending) return;
    if (listening) recognitionRef.current?.stop();
    const sent = attachments;
    const message = text || '(see attachments)';
    const history = turns
      .filter((turn) => !turn.error)
      .slice(-16)
      .map(({ role, text: turnText }) => ({ role, text: turnText }));
    const afterUser: ChatTurn[] = [
      ...turns,
      {
        role: 'user',
        text: message,
        ...(sent.length > 0 ? { attachments: sent.map((file) => ({ name: file.name })) } : {}),
      },
    ];
    setTurns(afterUser);
    setInput('');
    setAttachments([]);
    setPending(true);
    setStreamText('');

    const controller = new AbortController();
    abortRef.current = controller;

    let acc = '';
    let errorText: string | null = null;
    try {
      const response = await fetch('/api/sketcher/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          history,
          context: contextText,
          folderLabel,
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
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        errorText = 'Lost the connection to the local bridge.';
      }
    }

    const interrupted = controller.signal.aborted;
    abortRef.current = null;
    setPending(false);
    setStreamText('');
    const final: ChatTurn[] = [
      ...afterUser,
      errorText
        ? { role: 'assistant', text: errorText, error: true }
        : { role: 'assistant', text: acc || (interrupted ? '(stopped)' : '(no reply)') },
    ];
    setTurns(final);
    onPersist(final);
  };

  // A prompt pushed in from a button goes out on arrival — the conversation
  // shows it as a turn, so what was asked stays readable. Claiming it first
  // means a slow reply cannot queue the same question twice.
  useEffect(() => {
    if (!pendingPrompt || pending) return;
    onPromptHandled?.();
    void send(pendingPrompt);
    // `send` closes over state that changes on every keystroke; depending on it
    // would fire the prompt again mid-conversation. `pending` is a dependency
    // so a prompt pressed mid-reply goes out when that reply lands, rather than
    // being dropped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, pending]);

  const rows = Math.min(6, Math.max(1, input.split('\n').length));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {children}

        {!children && turns.length === 0 && !pending && greeting && (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageSquare className="size-5" />
            <p className="text-foreground text-sm font-medium">{greeting}</p>
            <p className="max-w-sm text-xs">
              {greetingHint ??
                'Every reference file in this project is in context — ask across all of them.'}
            </p>
          </div>
        )}

        {(turns.length > 0 || pending) && (
          <div
            className={cn(
              'mx-auto flex w-full max-w-3xl flex-col gap-5 px-8 pt-6 pb-8',
              children && 'border-t',
            )}
          >
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <div key={index} className="max-w-[85%] self-end">
                  <p className="bg-muted rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap">
                    {turn.text}
                  </p>
                  {turn.attachments && turn.attachments.length > 0 && (
                    <p className="text-muted-foreground mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[10px]">
                      {turn.attachments.map((file) => (
                        <span key={file.name} className="flex items-center gap-0.5">
                          <Paperclip className="size-2.5" />
                          {file.name}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              ) : turn.error ? (
                <p
                  key={index}
                  className="text-destructive text-sm leading-relaxed whitespace-pre-wrap"
                >
                  {turn.text}
                </p>
              ) : (
                <AssistantMarkdown key={index} text={turn.text} />
              ),
            )}
            {pending &&
              (streamText ? (
                <AssistantMarkdown text={streamText} />
              ) : (
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading the research…
                </p>
              ))}
          </div>
        )}
      </div>

      {/* Composer — the same card a chat app pins under its messages. */}
      <div className="shrink-0 px-6 pt-2 pb-2">
        <div className="bg-background mx-auto w-full max-w-3xl rounded-2xl border p-3 shadow-sm">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="bg-muted/60 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                >
                  <Paperclip className="size-3 shrink-0" />
                  <span className="max-w-[12rem] truncate font-mono">{file.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(file.sizeKb)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((current) => current.filter((_, at) => at !== index))
                    }
                    aria-label={`Remove ${file.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <label className="sr-only" htmlFor="research-message">
            Ask about this research
          </label>
          <textarea
            id="research-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={rows}
            placeholder={t('chat.placeholder')}
            disabled={pending}
            className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-1 pt-0.5 text-sm outline-none disabled:opacity-60"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void addFiles(event)}
              aria-hidden
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending || attachments.length >= MAX_ATTACHMENTS}
              title={
                attachments.length >= MAX_ATTACHMENTS
                  ? t('chat.maxAttachments', { max: MAX_ATTACHMENTS })
                  : t('chat.attachFilesHint')
              }
              aria-label={t('chat.attachFiles')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>

            <div className="ml-auto flex items-center gap-1">
              <Select value={model} onValueChange={(value) => setModel(value as ModelId)}>
                <SelectTrigger
                  size="sm"
                  aria-label={t('chat.model')}
                  className="text-muted-foreground h-7 gap-1 border-0 px-1.5 text-xs font-medium shadow-none"
                >
                  {/* Explicit label so the choice shows before hydration too. */}
                  <SelectValue>{MODELS.find((entry) => entry.id === model)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {MODELS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={toggleDictation}
                disabled={!voiceOk.dictation || pending}
                aria-pressed={listening}
                title={
                  !voiceOk.dictation
                    ? t('chat.dictateUnavailable')
                    : listening
                      ? t('chat.dictateStop')
                      : t('chat.dictateStart')
                }
                aria-label={listening ? t('chat.dictateStop') : t('chat.dictateStart')}
                className={cn(
                  'rounded-md p-1 disabled:opacity-40',
                  listening
                    ? 'text-destructive animate-pulse'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Mic className="size-4" />
              </button>
              {pending ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  title={t('chat.stopReply')}
                  aria-label={t('chat.stopReply')}
                  className="bg-foreground text-background rounded-md p-1"
                >
                  <CircleStop className="size-4" />
                </button>
              ) : input.trim() || attachments.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void send()}
                  aria-label={t('chat.send')}
                  className="bg-foreground text-background rounded-md p-1"
                >
                  <ArrowUp className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleReadAloud}
                  disabled={!voiceOk.playback || !lastReply}
                  aria-pressed={speaking}
                  title={
                    !voiceOk.playback
                      ? t('chat.readUnavailable')
                      : !lastReply
                        ? t('chat.nothingToRead')
                        : speaking
                          ? t('chat.stopReading')
                          : t('chat.readAloud')
                  }
                  aria-label={speaking ? t('chat.stopReading') : t('chat.readAloud')}
                  className={cn(
                    'rounded-md p-1 disabled:opacity-40',
                    speaking
                      ? 'text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <AudioLines className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-muted-foreground/80 pt-1.5 pb-0.5 text-center text-[11px]">
          {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
}
