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
  Check,
  CircleStop,
  Code2,
  FileCode2,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { claudeHeaders, useClaudeAccount } from '@/lib/we-adk/claude-account';
import { ClaudeConnectNotice } from '@/components/we-adk/claude-connect';
import {
  ChatComposerMenu,
  type ChatMenuView,
  type EffortLevel,
  type MentionFile,
  type SessionUsage,
} from '@/components/we-adk/chat-menu';
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

export interface ChatUsage {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

/** The slice of the CLI stream this pane cares about. */
export function readChatEvent(
  line: string,
):
  | { kind: 'delta' | 'full' | 'error'; text: string }
  | { kind: 'usage'; usage: ChatUsage }
  | { kind: 'ignore' } {
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
  if (event.type === 'result' && event.subtype === 'success') {
    const usage =
      typeof event.usage === 'object' && event.usage !== null
        ? (event.usage as Record<string, unknown>)
        : {};
    const numberOf = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    return {
      kind: 'usage',
      usage: {
        costUsd: numberOf(event.total_cost_usd),
        inputTokens: numberOf(usage.input_tokens),
        outputTokens: numberOf(usage.output_tokens),
        durationMs: numberOf(event.duration_ms),
      },
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

/** Claude Code-style slash commands available in the composer. */
const SLASH_COMMANDS = [
  { id: 'attach', hint: 'Attach a file' },
  { id: 'mention', hint: 'Mention a file from this project' },
  { id: 'clear', hint: 'Clear conversation' },
  { id: 'rewind', hint: 'Rewind to an earlier message' },
  { id: 'model', hint: 'Switch model — /model opus·sonnet·haiku' },
  { id: 'effort', hint: 'Set effort — /effort low·medium·high' },
  { id: 'thinking', hint: 'Toggle thinking — /thinking on·off' },
  { id: 'usage', hint: 'Account & usage' },
] as const;

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
  | { type: 'code'; lang: string; meta: string; lines: string[] }
  | { type: 'rule' };

/**
 * Where a code block in a reply can be written to.
 *
 * Provided by hosts that own a real working tree (the Editor's workspace);
 * everywhere else it is null and replies render as plain reading. The hint is
 * the file path the block seems to be for, when the reply names one.
 */
export const ApplyCodeContext = createContext<
  ((code: string, pathHint: string | null) => void) | null
>(null);

/** `js src/lib/x.ts` fence meta, or a `// src/lib/x.ts` first line. */
function pathHintFor(meta: string, lines: string[]): string | null {
  const looksLikePath = (value: string) => /^[\w.@-]+(\/[\w.\[\]@-]+)+\.\w+$/.test(value);
  if (looksLikePath(meta.trim())) return meta.trim();
  const first = (lines[0] ?? '')
    .replace(/^(\/\/|#|\/\*|<!--)\s*/, '')
    .replace(/\s*(\*\/|-->)\s*$/, '')
    .trim();
  return looksLikePath(first) ? first : null;
}

/**
 * The model answers in Markdown; rendering it raw is what made replies look
 * broken. This covers what chat answers actually use — headings, lists, fenced
 * code, rules, emphasis — and treats an unclosed fence as code, so streaming
 * output renders sensibly mid-thought.
 */
function parseChatMarkdown(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let paragraph: string[] = [];
  let code: { lang: string; meta: string; lines: string[] } | null = null;

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
        blocks.push({ type: 'code', lang: code.lang, meta: code.meta, lines: code.lines });
        code = null;
      } else {
        code.lines.push(raw);
      }
      continue;
    }
    const fence = /^```(\w*)[ \t]*(.*)$/.exec(line);
    if (fence) {
      flush();
      code = { lang: fence[1] ?? '', meta: fence[2] ?? '', lines: [] };
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
  if (code) blocks.push({ type: 'code', lang: code.lang, meta: code.meta, lines: code.lines });
  flush();
  return blocks;
}

/**
 * A fenced block in a reply.
 *
 * A built screen is a few hundred lines of html, and printing it into the
 * conversation buries the sentence that says what was built — you scroll past
 * a wall of CSS to find out whether anything happened. A page is therefore
 * summarised: what it is, how big it is, and the actions that matter. The code
 * is one click away rather than gone, because the block is still the answer
 * and someone occasionally needs to read it.
 *
 * Short snippets stay open. A three-line command is the message, not an
 * attachment to it.
 */
function ChatCodeBlock({ block }: { block: Extract<ChatBlock, { type: 'code' }> }) {
  const applyCode = useContext(ApplyCodeContext);
  const [shown, setShown] = useState(false);
  const hint = pathHintFor(block.meta, block.lines);
  const lang = block.lang.toLowerCase();
  const isPage = lang === 'html' || lang === 'htm';
  /*
   * Judged on each render rather than latched into state: a block streaming in
   * grows past the threshold while it is on screen, and a summary that only
   * appeared for blocks that were already long would miss exactly the ones
   * being written now.
   */
  const summarise = isPage || block.lines.length > 20;
  const open = shown || !summarise;
  const label = hint ?? (isPage ? 'Page' : block.lang || 'Code');

  return (
    <div className="bg-muted/40 overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 px-3.5 py-2">
        {isPage ? (
          <FileCode2 className="text-muted-foreground size-3.5 shrink-0" />
        ) : (
          <Code2 className="text-muted-foreground size-3.5 shrink-0" />
        )}
        <p className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
          {label}
          {summarise && (
            <span className="ml-1.5 font-mono">
              {block.lines.length} line{block.lines.length === 1 ? '' : 's'}
            </span>
          )}
        </p>
        {summarise && (
          <button
            type="button"
            onClick={() => setShown((current) => !current)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-[11px] font-medium hover:underline"
          >
            {open ? 'Hide code' : 'Show code'}
          </button>
        )}
        {applyCode && (
          <button
            type="button"
            onClick={() => applyCode(block.lines.join('\n'), hint)}
            title={hint ? `Write to ${hint}` : 'Write to a file in the workspace'}
            className="text-key-accent shrink-0 text-[11px] font-medium hover:underline"
          >
            Apply to workspace
          </button>
        )}
      </div>
      {open && (
        <pre className="overflow-x-auto px-3.5 pt-1 pb-3 font-mono text-xs leading-relaxed">
          {block.lines.join('\n')}
        </pre>
      )}
    </div>
  );
}

export function AssistantMarkdown({ text }: { text: string }) {
  const applyCode = useContext(ApplyCodeContext);
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
            return <ChatCodeBlock key={index} block={block} />;
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

function ApplyNotesButton({ content, onApply }: { content: string; onApply: (notes: string) => void }) {
  const [applied, setApplied] = useState(false);
  return (
    <button
      type="button"
      disabled={applied}
      onClick={() => { onApply(content); setApplied(true); }}
      className={cn(
        'mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors',
        applied
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
          : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {applied ? <Check className="size-3.5" /> : <FileText className="size-3.5" />}
      {applied ? 'Applied to Notes' : 'Apply to Notes'}
    </button>
  );
}

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
  mentionFiles = [],
  onGenerate,
  onResponse,
  onApplyNotes,
  composerClassName,
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
  /** Project files the user can @-mention; their text rides along as an attachment. */
  mentionFiles?: MentionFile[];
  /** Called when the user wants to generate screens from the conversation. */
  onGenerate?: (notes: string) => void;
  /** Called after each assistant response completes — parent can auto-detect HTML. */
  onResponse?: (responseText: string, userMessage: string) => void;
  /** Called when the user clicks "Apply to Notes" on a suggested notes block. */
  onApplyNotes?: (notes: string) => void;
  /** Override the composer box className (default has bg/border/shadow). */
  composerClassName?: string;
  children?: React.ReactNode;
}) {
  const { t } = useLocale();
  const { connected: claudeConnected } = useClaudeAccount();
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [model, setModel] = useState<ModelId>('opus');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [effort, setEffort] = useState<EffortLevel>('medium');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<ChatMenuView>('root');
  const [slashIndex, setSlashIndex] = useState(0);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>({ turns: 0 });
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

  // Saved turns arrive from workspace state after mount; adopt them as long as
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
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          history,
          context: contextText,
          folderLabel,
          projectName: project.name,
          model,
          thinking,
          effort,
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
            } else if (event.kind === 'usage') {
              const turn = event.usage;
              setSessionUsage((current) => ({
                turns: current.turns + 1,
                costUsd: (current.costUsd ?? 0) + (turn.costUsd ?? 0),
                inputTokens: (current.inputTokens ?? 0) + (turn.inputTokens ?? 0),
                outputTokens: (current.outputTokens ?? 0) + (turn.outputTokens ?? 0),
              }));
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
    let responseText = acc || (interrupted ? '(stopped)' : '(no reply)');

    // Always strip HTML code blocks from responses — show clean summary instead
    let autoGenerated = false;
    if (!errorText && !interrupted && responseText) {
      const hasHtml = /```html\s*\n[\s\S]*?```/.test(responseText);

      if (hasHtml) {
        if (onResponse) onResponse(responseText, message);

        const lineCount = (responseText.match(/```html\s*\n([\s\S]*?)```/)?.[1]?.match(/\n/g) || []).length;
        const cleanText = responseText.replace(/```html\s*\n[\s\S]*?```/g, '').trim();
        const summary = ['```', `✓ Generated HTML (${lineCount} lines)`, ...(onResponse ? ['✓ Preview updated'] : []), '```'].join('\n');
        responseText = cleanText ? `${cleanText}\n\n${summary}` : summary;
        autoGenerated = true;
      }
    }

    const final: ChatTurn[] = [
      ...afterUser,
      errorText
        ? { role: 'assistant', text: errorText, error: true }
        : { role: 'assistant', text: responseText },
    ];
    setTurns(final);
    if (!autoGenerated) onPersist(final);
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

  /* ----- Claude Code-style composer actions (menu + "/" commands) ----- */

  const clearConversation = () => {
    abortRef.current?.abort();
    setTurns([]);
    onPersist([]);
  };

  /** Drops everything from the picked user turn on, putting its text back. */
  const rewindTo = (index: number) => {
    const restored = turns[index];
    const before = turns.slice(0, index);
    setTurns(before);
    onPersist(before);
    if (restored) setInput(restored.text);
  };

  const mentionFile = (file: MentionFile) => {
    setInput((current) => {
      const base = current.startsWith('/') ? '' : current;
      return `${base ? `${base.trimEnd()} ` : ''}@${file.name} `;
    });
    if (file.text) {
      setAttachments((current) => {
        if (current.length >= MAX_ATTACHMENTS || current.some((a) => a.name === file.name)) {
          return current;
        }
        return [
          ...current,
          {
            name: file.name,
            kind: 'text',
            text: file.text?.slice(0, MAX_TEXT_CHARS),
            sizeKb: Math.max(1, Math.round((file.text?.length ?? 0) / 1024)),
          },
        ];
      });
    }
  };

  const rewindTargets = turns
    .map((turn, index) => ({ turn, index }))
    .filter((entry) => entry.turn.role === 'user')
    .slice(-8)
    .map((entry) => ({ index: entry.index, text: entry.turn.text }));

  const openMenu = (view: ChatMenuView) => {
    setMenuView(view);
    setMenuOpen(true);
  };

  const slashActive = input.startsWith('/') && !input.includes('\n') && !pending;
  const slashWord = slashActive ? (input.slice(1).split(/\s+/)[0] ?? '') : '';
  const slashMatches = slashActive
    ? SLASH_COMMANDS.filter((command) => command.id.startsWith(slashWord.toLowerCase()))
    : [];

  const runSlashCommand = (id: string, arg?: string): void => {
    switch (id) {
      case 'attach':
        fileInputRef.current?.click();
        break;
      case 'mention':
        openMenu('mention');
        break;
      case 'clear':
        clearConversation();
        break;
      case 'rewind':
        openMenu('rewind');
        break;
      case 'model': {
        const picked = MODELS.find((entry) => entry.id === arg);
        if (picked) setModel(picked.id);
        else openMenu('root');
        break;
      }
      case 'effort':
        if (arg === 'low' || arg === 'medium' || arg === 'high') setEffort(arg);
        else openMenu('root');
        break;
      case 'thinking':
        setThinking(arg ? arg === 'on' : !thinking);
        break;
      case 'usage':
        openMenu('root');
        break;
    }
    setInput('');
    setSlashIndex(0);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Empty state */}
      {turns.length === 0 && !pending && greeting && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm font-medium">{greeting}</p>
            {greetingHint && (
              <p className="text-muted-foreground/70 mt-1 text-xs">{greetingHint}</p>
            )}
          </div>
        </div>
      )}

      {/* Chat messages */}
      {(turns.length > 0 || pending) && (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4 pb-3">
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <div key={index} className="max-w-[85%] self-end">
                  <p className="bg-muted rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap">{turn.text}</p>
                </div>
              ) : turn.error ? (
                <p key={index} className="text-destructive text-sm whitespace-pre-wrap">{turn.text}</p>
              ) : (
                <div key={index}>
                  <AssistantMarkdown text={turn.text} />
                  {onApplyNotes && /```notes\s*\n[\s\S]*?```/.test(turn.text) && (() => {
                    const notesContent = turn.text.match(/```notes\s*\n([\s\S]*?)```/)?.[1]?.trim();
                    if (!notesContent) return null;
                    return <ApplyNotesButton content={notesContent} onApply={onApplyNotes} />;
                  })()}
                </div>
              ),
            )}
            {pending && (
              streamText
                ? <AssistantMarkdown text={streamText} />
                : <p className="text-muted-foreground flex items-center gap-1.5 text-sm"><Loader2 className="size-3.5 animate-spin" />Thinking…</p>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="mt-auto shrink-0 px-4 pt-2 pb-2">
          <div className={composerClassName ?? "bg-background mx-auto w-full max-w-3xl rounded-xl border p-2.5 shadow-sm"}>
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
            {slashActive && slashMatches.length > 0 && (
              <div className="bg-popover mb-2 overflow-hidden rounded-md border">
                {slashMatches.map((command, index) => (
                  <button
                    key={command.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      runSlashCommand(command.id, input.slice(1).trim().split(/\s+/)[1]);
                    }}
                    className={cn(
                      'flex w-full items-baseline gap-3 px-3 py-1.5 text-left text-xs',
                      index === slashIndex ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className="font-mono font-medium">/{command.id}</span>
                    <span className="text-muted-foreground text-[11px]">{command.hint}</span>
                  </button>
                ))}
              </div>
            )}
            <label className="sr-only" htmlFor="research-message">
              Ask about this research
            </label>
            <textarea
              id="research-message"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setSlashIndex(0);
              }}
              onKeyDown={(event) => {
                if (slashActive && slashMatches.length > 0) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSlashIndex((current) => (current + 1) % slashMatches.length);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSlashIndex(
                      (current) => (current - 1 + slashMatches.length) % slashMatches.length,
                    );
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setInput('');
                    return;
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    const selected = slashMatches[slashIndex] ?? slashMatches[0];
                    if (selected) {
                      runSlashCommand(selected.id, input.slice(1).trim().split(/\s+/)[1]);
                    }
                    return;
                  }
                }
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
            <div className="mt-1.5 flex items-center gap-1">
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
                title={t('chat.attachFilesHint')}
                aria-label={t('chat.attachFiles')}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>

              <div className="ml-auto flex items-center gap-1">
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
                ) : (
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!input.trim() && attachments.length === 0}
                    aria-label={t('chat.send')}
                    className="bg-foreground text-background rounded-md p-1 disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
