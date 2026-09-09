'use client';

/**
 * "Connect your Claude account" dialog.
 *
 * Two ways for the AI features to have a credential, and this is the second one: the API
 * normally holds one key for the whole deployment (`ANTHROPIC_API_KEY`), and anything
 * pasted here overrides it for this browser only, so someone can spend their own quota
 * instead of the organisation's.
 *
 * An API key is what to paste. This used to ask for a `claude setup-token` token, from when
 * the AI ran by shelling out to the local CLI — a server-side SDK cannot use a subscription
 * that way. Such tokens are still accepted and sent as a bearer token, but an API key is the
 * supported path, and the instructions below now say so.
 *
 * Whatever is pasted is verified with one tiny Haiku call before being saved, and it is
 * saved to this browser only — the API never stores it, and refuses to.
 */
import { CheckCircle2, Loader2, Plug, Unplug } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from '@/components/ui';
import { CLAUDE_TOKEN_HEADER, useClaudeAccount } from '@/lib/we-adk/claude-account';

function maskToken(token: string): string {
  return token.length > 14 ? `${token.slice(0, 10)}…${token.slice(-4)}` : '••••';
}

export function ClaudeConnectDialog({ trigger }: { trigger: ReactNode }) {
  const { token, connected, save, disconnect } = useClaudeAccount();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyAndSave = async () => {
    const candidate = draft.trim();
    if (!candidate) return;
    setVerifying(true);
    setError(null);
    try {
      const response = await fetch('/api/claude-auth/verify', {
        method: 'POST',
        headers: { [CLAUDE_TOKEN_HEADER]: candidate },
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'That token did not work.');
        return;
      }
      save(candidate);
      setDraft('');
      setOpen(false);
    } catch {
      setError('Could not reach the server to verify the token.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDraft('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {connected ? 'Claude account connected' : 'Connect your Claude account'}
          </DialogTitle>
          <DialogDescription>
            The API has its own key for everyone; a key here overrides it for this browser only, so
            you spend your own quota. It is stored in this browser and sent with your requests — the
            server never keeps it.
          </DialogDescription>
        </DialogHeader>

        {connected && token ? (
          <div className="flex items-center gap-2 rounded-md border bg-emerald-500/5 px-3 py-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="font-mono text-xs">{maskToken(token)}</span>
          </div>
        ) : (
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            <li>
              Create a key at{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                console.anthropic.com
              </a>
              .
            </li>
            <li>
              Paste it below. It starts with{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">sk-ant-api</code>.
            </li>
            <li className="text-muted-foreground/80">
              A{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                claude setup-token
              </code>{' '}
              token also works, but an API key is the supported path.
            </li>
          </ol>
        )}

        <div className="space-y-2">
          <Input
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void verifyAndSave();
            }}
            placeholder={connected ? 'Paste a new key to replace it' : 'sk-ant-api03-…'}
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>

        <DialogFooter>
          {connected && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              <Unplug className="size-4" /> Disconnect
            </Button>
          )}
          <Button
            type="button"
            onClick={() => void verifyAndSave()}
            disabled={verifying || !draft.trim()}
          >
            {verifying ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
            {verifying ? 'Verifying…' : 'Verify & save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline nudge for AI panels when no account is connected yet. */
export function ClaudeConnectNotice({ message }: { message?: string }) {
  return (
    <ClaudeConnectDialog
      trigger={
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs"
        >
          <Plug className="size-3.5" />
          {message ?? 'Connect your Claude account to use AI features'}
        </button>
      }
    />
  );
}
