'use client';

/**
 * The composer settings menu, shaped after Claude Code's: a Context group
 * (attach, mention project file, clear, rewind), a Model group (model, effort,
 * thinking) and Account & usage. Fully controlled by the chat pane so the "/"
 * command palette can drive the same actions.
 */
import { Check, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Switch } from '@/components/ui';
import { ClaudeConnectDialog } from '@/components/we-adk/claude-connect';
import { useClaudeAccount } from '@/lib/we-adk/claude-account';
import { type ChatUsage } from '@/components/we-adk/claude-chat';

export type EffortLevel = 'low' | 'medium' | 'high';
export type ChatMenuView = 'root' | 'mention' | 'rewind';

export interface MentionFile {
  name: string;
  text?: string;
}

export interface SessionUsage extends ChatUsage {
  turns: number;
}

function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground px-3 pt-2 pb-1 text-[11px] font-medium">{children}</p>
  );
}

function MenuItem({
  onClick,
  disabled,
  children,
  right,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover:bg-accent flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-xs disabled:opacity-40"
    >
      <span>{children}</span>
      {right && <span className="text-muted-foreground flex items-center">{right}</span>}
    </button>
  );
}

export function ChatComposerMenu({
  open,
  view,
  onOpenChange,
  onViewChange,
  trigger,
  model,
  models,
  onModelChange,
  effort,
  onEffortChange,
  thinking,
  onThinkingChange,
  onAttach,
  attachDisabled,
  mentionFiles,
  onMention,
  onClear,
  clearDisabled,
  rewindTargets,
  onRewind,
  usage,
}: {
  open: boolean;
  view: ChatMenuView;
  onOpenChange: (open: boolean) => void;
  onViewChange: (view: ChatMenuView) => void;
  trigger: ReactNode;
  model: string;
  models: readonly { id: string; label: string }[];
  onModelChange: (model: string) => void;
  effort: EffortLevel;
  onEffortChange: (effort: EffortLevel) => void;
  thinking: boolean;
  onThinkingChange: (thinking: boolean) => void;
  onAttach: () => void;
  attachDisabled?: boolean;
  mentionFiles: MentionFile[];
  onMention: (file: MentionFile) => void;
  onClear: () => void;
  clearDisabled?: boolean;
  /** Prior user turns, newest last; picking one rewinds the chat to before it. */
  rewindTargets: { index: number; text: string }[];
  onRewind: (index: number) => void;
  usage: SessionUsage;
}) {
  const { connected } = useClaudeAccount();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') onOpenChange(false);
      if (
        event instanceof MouseEvent &&
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [open, onOpenChange]);

  const close = () => onOpenChange(false);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="bg-popover text-popover-foreground absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border py-1 shadow-lg">
          {view === 'root' && (
            <>
              <MenuHeading>Context</MenuHeading>
              <MenuItem
                disabled={attachDisabled}
                onClick={() => {
                  close();
                  onAttach();
                }}
              >
                Attach file…
              </MenuItem>
              <MenuItem
                disabled={mentionFiles.length === 0}
                onClick={() => onViewChange('mention')}
              >
                Mention file from this project…
              </MenuItem>
              <MenuItem
                disabled={clearDisabled}
                onClick={() => {
                  close();
                  onClear();
                }}
              >
                Clear conversation
              </MenuItem>
              <MenuItem
                disabled={rewindTargets.length === 0}
                onClick={() => onViewChange('rewind')}
              >
                Rewind
              </MenuItem>

              <div className="bg-border my-1 h-px" />
              <MenuHeading>Model</MenuHeading>
              {models.map((entry) => (
                <MenuItem
                  key={entry.id}
                  onClick={() => onModelChange(entry.id)}
                  right={entry.id === model ? <Check className="size-3.5" /> : undefined}
                >
                  {entry.label}
                </MenuItem>
              ))}
              <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span>Effort</span>
                <span className="flex overflow-hidden rounded-md border">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onEffortChange(level)}
                      className={`px-2 py-0.5 text-[11px] capitalize ${
                        level === effort ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span>Thinking</span>
                <Switch checked={thinking} onCheckedChange={onThinkingChange} />
              </div>

              <div className="bg-border my-1 h-px" />
              <div className="px-3 py-1.5 text-xs">
                <div className="text-muted-foreground flex justify-between text-[11px]">
                  <span>This session</span>
                  <span>
                    {usage.turns} turns · {(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}{' '}
                    tok
                    {typeof usage.costUsd === 'number' ? ` · $${usage.costUsd.toFixed(4)}` : ''}
                  </span>
                </div>
              </div>
              <ClaudeConnectDialog
                trigger={
                  <button
                    type="button"
                    className="hover:bg-accent flex w-full items-center justify-between px-3 py-1.5 text-left text-xs"
                  >
                    <span>Account &amp; usage…</span>
                    <span
                      className={`size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-400'}`}
                    />
                  </button>
                }
              />
            </>
          )}

          {view === 'mention' && (
            <>
              <button
                type="button"
                onClick={() => onViewChange('root')}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 text-[11px]"
              >
                <ChevronLeft className="size-3" /> Back
              </button>
              <MenuHeading>Files in this project</MenuHeading>
              <div className="max-h-56 overflow-y-auto">
                {mentionFiles.map((file) => (
                  <MenuItem
                    key={file.name}
                    onClick={() => {
                      close();
                      onMention(file);
                    }}
                  >
                    <span className="font-mono text-[11px]">{file.name}</span>
                  </MenuItem>
                ))}
              </div>
            </>
          )}

          {view === 'rewind' && (
            <>
              <button
                type="button"
                onClick={() => onViewChange('root')}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 text-[11px]"
              >
                <ChevronLeft className="size-3" /> Back
              </button>
              <MenuHeading>Rewind to before…</MenuHeading>
              <div className="max-h-56 overflow-y-auto">
                {[...rewindTargets].reverse().map((target) => (
                  <MenuItem
                    key={target.index}
                    onClick={() => {
                      close();
                      onRewind(target.index);
                    }}
                  >
                    <span className="line-clamp-2">{target.text}</span>
                  </MenuItem>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
