'use client';

import { Check, Copy, CornerDownLeft, Loader2, Send, Terminal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import {
  type DevSession,
  type Harness,
  type InboundRequirement,
} from '@/lib/we-adk-mock/developer';

interface Turn {
  from: 'me' | 'claude';
  text: string;
  usage?: {
    durationMs?: number;
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  failed?: boolean;
}

/** Ordered like the harness workflow: analyse → design → build → test → review. */
const PRESETS = [
  {
    label: '1 · Analyse',
    prompt:
      'Analyse this requirement. Restate what is actually being asked, list the acceptance criteria as verifiable checks, and flag anything under-specified or in tension with the harness before any code is written.',
  },
  {
    label: '2 · Propose a design',
    prompt:
      'Propose a design for this requirement: the files to change, the data flow, and the edge cases implied by the domain context. Explain the trade-offs and pick one approach.',
  },
  {
    label: '3 · Implement',
    prompt:
      'Implement this requirement. Give the code file by file, complete enough to paste in, and state which harness rule or domain fact drove each non-obvious decision.',
  },
  {
    label: '4 · Write tests',
    prompt:
      'Write the tests this requirement needs, covering every acceptance criterion plus the edge cases the harness validation standards demand.',
  },
  {
    label: '5 · Review',
    prompt:
      'Review the work so far against this harness — development rules, domain context, access limits and validation standards. Report findings by severity and say whether the Definition of Done is met.',
  },
];

/* ------------------------------------------------------------------ */
/* Minimal markdown: fenced code blocks + text. Keeps deps at zero.    */
/* ------------------------------------------------------------------ */

interface Segment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function splitSegments(markdown: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(markdown)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: 'text', content: markdown.slice(cursor, match.index) });
    }
    segments.push({ type: 'code', language: match[1] || undefined, content: match[2] ?? '' });
    cursor = match.index + match[0].length;
  }
  if (cursor < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(cursor) });
  }
  return segments.filter((segment) => segment.content.trim().length > 0);
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="group relative overflow-hidden rounded-md border bg-[#0b1220]">
      <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1">
        <span className="font-mono text-[10px] text-slate-400">{language ?? 'code'}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={t('misc.copyCode')}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-slate-100">
        <code>{code.replace(/\n$/, '')}</code>
      </pre>
    </div>
  );
}

function Rendered({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {splitSegments(text).map((segment, index) =>
        segment.type === 'code' ? (
          <CodeBlock key={index} code={segment.content} language={segment.language} />
        ) : (
          <p key={index} className="text-xs leading-relaxed whitespace-pre-wrap">
            {segment.content.trim()}
          </p>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function formatUsage(usage: Turn['usage']): string | null {
  if (!usage) return null;
  const parts: string[] = [];
  if (usage.durationMs !== undefined) parts.push(`${(usage.durationMs / 1000).toFixed(1)}s`);
  if (usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
    parts.push(`${usage.inputTokens} in / ${usage.outputTokens} out`);
  }
  if (usage.costUsd !== undefined) parts.push(`$${usage.costUsd.toFixed(4)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function PromptConsole({
  requirement,
  session,
  harness,
}: {
  requirement: InboundRequirement;
  session?: DevSession;
  harness: Harness;
}) {
  const { t } = useLocale();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset the transcript when the developer switches requirement.
  useEffect(() => {
    setTurns([]);
  }, [requirement.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, pending]);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setTurns((current) => [...current, { from: 'me', text: trimmed }]);
    setPrompt('');
    setPending(true);

    try {
      const response = await fetch('/api/developer/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          harnessId: harness.id,
          requirementId: requirement.id,
          sessionId: session?.id,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : `Request failed (${response.status}).`;
        setTurns((current) => [...current, { from: 'claude', text: detail, failed: true }]);
        return;
      }

      const data = payload as { text?: unknown; usage?: Turn['usage'] } | null;
      setTurns((current) => [
        ...current,
        {
          from: 'claude',
          text: typeof data?.text === 'string' ? data.text : 'Empty response.',
          usage: data?.usage,
        },
      ]);
    } catch {
      setTurns((current) => [
        ...current,
        {
          from: 'claude',
          text: 'Could not reach the local Claude Code bridge (/api/developer/prompt).',
          failed: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="flex min-h-0 flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Header: what context this prompt runs inside */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="size-4 shrink-0" />
            <p className="truncate text-sm font-semibold">
              Solve with Claude Code
              <span className="text-muted-foreground font-normal"> — {requirement.title}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {harness.name} {harness.version}
            </Badge>
            <Badge variant="muted">advisory · no tools</Badge>
            {turns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px]"
                onClick={() => setTurns([])}
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Claude Code already knows this requirement, its acceptance criteria and the harness rules
          — ask it to analyse, design, build, test or review, and it answers within those
          constraints. It hands you the code to apply; it does not touch your files.
        </p>

        {/* Transcript */}
        <div className="bg-muted/30 min-h-64 flex-1 overflow-y-auto rounded-md border p-3">
          {turns.length === 0 && !pending ? (
            <div className="flex flex-col gap-3 py-6">
              <p className="text-muted-foreground text-center text-xs">
                Work through the requirement in order, or ask anything about it.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void send(preset.prompt)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {turns.map((turn, index) => (
                <div
                  key={index}
                  className={cn(
                    'rounded-lg px-3 py-2',
                    turn.from === 'me'
                      ? 'bg-primary/10 ml-8'
                      : turn.failed
                        ? 'border border-red-300 bg-red-50 mr-8 dark:border-red-500/40 dark:bg-red-950/40'
                        : 'bg-background mr-8 border',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[10px] font-medium">
                      {turn.from === 'me' ? 'Developer' : 'Claude Code'}
                    </span>
                    {formatUsage(turn.usage) && (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {formatUsage(turn.usage)}
                      </span>
                    )}
                  </div>
                  {turn.from === 'me' ? (
                    <p className="text-xs whitespace-pre-wrap">{turn.text}</p>
                  ) : (
                    <Rendered text={turn.text} />
                  )}
                </div>
              ))}
              {pending && (
                <div className="bg-background text-muted-foreground mr-8 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  Claude Code is working inside the harness… {elapsed}s
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="flex flex-col gap-2">
          {turns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="h-6 px-2 text-[10px]"
                  onClick={() => void send(preset.prompt)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void send(prompt);
              }
            }}
            rows={3}
            disabled={pending}
            placeholder={t('terminal.promptPlaceholder')}
            className="border-input bg-background w-full resize-none rounded-md border px-3 py-2 text-xs disabled:opacity-50"
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <CornerDownLeft className="size-3" />
              ⌘/Ctrl + Enter to run
            </span>
            <Button
              size="sm"
              disabled={pending || prompt.trim().length === 0}
              onClick={() => void send(prompt)}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Run
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
