/**
 * Shared bridge to the locally installed Claude Code CLI, used by the Sketcher
 * canvas editor and the Developer prompt console.
 *
 * Tools are always disabled: these routes only ever ask Claude for text or JSON,
 * so a browser button can never touch the filesystem. Requests are restricted to
 * loopback by default because this app has been exposed through a tunnel before.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type NextRequest } from 'next/server';

const MAX_OUTPUT_BYTES = 4_000_000;

export function isLoopbackRequest(request: NextRequest): boolean {
  if (process.env.SKETCHER_AI_ALLOW_REMOTE === '1') return true;
  const host = (request.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

/**
 * Every user brings their own Claude account: the browser sends the token from
 * `claude setup-token` on each request, and the CLI runs as that account.
 */
const TOKEN_HEADER = 'x-claude-token';
const TOKEN_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export function readClaudeToken(request: NextRequest): string | null {
  const token = (request.headers.get(TOKEN_HEADER) ?? '').trim();
  // Accept an explicit API key, or fall back to 'local' which means
  // use the CLI's own auth (claude.ai OAuth login).
  if (TOKEN_PATTERN.test(token)) return token;
  return 'local';
}

/** Host credentials that must never leak into a per-user CLI run. */
const HOST_CREDENTIAL_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_PROFILE',
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
  'ANTHROPIC_IDENTITY_TOKEN_FILE',
  'ANTHROPIC_BASE_URL',
];

let configDir: string | undefined;

/**
 * Child env that authenticates as the request's user only: their OAuth token,
 * host credentials stripped, and a config dir outside ~/.claude so the host
 * machine's login can never be picked up.
 */
export function buildClaudeEnv(token: string): NodeJS.ProcessEnv {
  // 'local' means use the host machine's own Claude CLI auth (OAuth login).
  if (token === 'local') {
    return { ...process.env };
  }
  if (!configDir) {
    configDir = join(tmpdir(), 'we-adk-claude-config');
    mkdirSync(configDir, { recursive: true });
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of HOST_CREDENTIAL_VARS) delete env[name];
  env.CLAUDE_CODE_OAUTH_TOKEN = token;
  env.CLAUDE_CONFIG_DIR = configDir;
  return env;
}

export interface ClaudeUsage {
  durationMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export type ClaudeOutcome =
  { ok: true; text: string; usage: ClaudeUsage } | { ok: false; status: number; error: string };

interface RunOptions {
  prompt: string;
  /** The requesting user's own Claude Code OAuth token. */
  token: string;
  systemPrompt?: string;
  timeoutMs?: number;
  model?: string;
}

interface RawOutcome {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

function spawnClaude(options: RunOptions): Promise<RawOutcome> {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format',
      'json',
      '--allowed-tools',
      '',
      '--max-turns',
      '1',
      '--no-session-persistence',
      '--model',
      options.model ?? process.env.SKETCHER_AI_MODEL ?? 'sonnet',
    ];
    if (options.systemPrompt) {
      args.push('--append-system-prompt', options.systemPrompt);
    }

    const child = spawn('claude', args, {
      // Run outside the repo so the CLI does not auto-load this project's CLAUDE.md.
      cwd: tmpdir(),
      env: buildClaudeEnv(options.token),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs ?? 90_000);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });

    child.stdin.end(options.prompt, 'utf8');
  });
}

function readUsage(envelope: unknown): ClaudeUsage {
  if (typeof envelope !== 'object' || envelope === null) return {};
  const record = envelope as Record<string, unknown>;
  const usage =
    typeof record.usage === 'object' && record.usage !== null
      ? (record.usage as Record<string, unknown>)
      : {};
  const numberOf = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  return {
    durationMs: numberOf(record.duration_ms),
    costUsd: numberOf(record.total_cost_usd),
    inputTokens: numberOf(usage.input_tokens),
    outputTokens: numberOf(usage.output_tokens),
    model: typeof record.model === 'string' ? record.model : undefined,
  };
}

/** Runs one headless Claude Code turn and returns its text plus usage metadata. */
export async function runClaude(options: RunOptions): Promise<ClaudeOutcome> {
  let raw: RawOutcome;
  try {
    raw = await spawnClaude(options);
  } catch (error) {
    const notFound = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    return {
      ok: false,
      status: 503,
      error: notFound
        ? 'The `claude` CLI was not found on this machine. Install Claude Code and make sure `claude` is on PATH.'
        : 'Could not start the local Claude Code CLI.',
    };
  }

  if (raw.timedOut) {
    const seconds = Math.round((options.timeoutMs ?? 90_000) / 1000);
    return { ok: false, status: 504, error: `Claude Code timed out after ${seconds}s.` };
  }
  if (raw.code !== 0) {
    const detail = raw.stderr.trim().split('\n').at(-1) ?? `exit code ${raw.code}`;
    return { ok: false, status: 502, error: `Claude Code failed: ${detail}` };
  }

  try {
    const envelope: unknown = JSON.parse(raw.stdout);
    const result =
      typeof envelope === 'object' && envelope !== null
        ? (envelope as { result?: unknown }).result
        : undefined;
    if (typeof result !== 'string') throw new Error('Missing result field');
    return { ok: true, text: result, usage: readUsage(envelope) };
  } catch {
    return { ok: false, status: 502, error: 'Could not read the Claude Code response envelope.' };
  }
}
