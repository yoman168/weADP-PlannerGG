/**
 * Streaming bridge for the per-folder Claude Code terminal.
 *
 * Unlike the generate/consolidate routes (which buffer one JSON envelope), this
 * spawns the local `claude` CLI in stream-json mode and forwards its NDJSON
 * lines to the browser as they arrive, so the panel renders text the moment the
 * model produces it — the same events the real Claude Code UI is drawn from.
 *
 * Tools stay disabled: the terminal talks about the folder, it cannot touch the
 * filesystem. Loopback-only, like the rest of the bridge.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isLoopbackRequest } from '@/lib/we-adk/claude-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 300_000;

const turnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(6_000),
});

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['image', 'text', 'binary']),
  /** Images only — base64 without the data: prefix. ~2 MB cap. */
  dataBase64: z.string().max(2_800_000).optional(),
  mediaType: z.string().max(80).optional(),
  /** Text files only — their content, read in the browser. */
  text: z.string().max(8_000).optional(),
});

const requestSchema = z.object({
  message: z.string().min(1).max(6_000),
  /** Prior turns in this folder's chat, oldest first. */
  history: z.array(turnSchema).max(30).default([]),
  /** Everything the folder knows — notes, decisions, files, sketches. */
  context: z.string().max(16_000).default(''),
  folderLabel: z.string().max(200).default(''),
  projectName: z.string().max(160).default(''),
  /** Which Claude model the CLI should run. */
  model: z.enum(['sonnet', 'opus', 'haiku']).default('sonnet'),
  attachments: z.array(attachmentSchema).max(4).default([]),
});

function systemPrompt(input: z.infer<typeof requestSchema>): string {
  return [
    'You are Claude Code, running headless inside WE-ADK Sketcher. This chat is pinned to one',
    `folder of the project "${input.projectName}": ${input.folderLabel}.`,
    '',
    'You answer like a terminal assistant: direct, concrete, no pleasantries, markdown-light.',
    'Short answers for short questions. You know only what is in the folder context below plus',
    'the conversation. If the folder does not answer something, say so rather than inventing.',
    'You cannot modify files or run commands from here — if asked to, say what the user should',
    'do in Sketcher instead (generate screens from the notes, consolidate in the design phase).',
    'When the message lists attached images, read them with the Read tool before answering.',
    '',
    'FOLDER CONTEXT:',
    input.context || '(empty folder — nothing captured yet)',
  ].join('\n');
}

function buildPrompt(
  input: z.infer<typeof requestSchema>,
  imagePaths: { path: string; name: string }[],
): string {
  const transcript = input.history
    .map((turn) => (turn.role === 'user' ? `User: ${turn.text}` : `You replied: ${turn.text}`))
    .join('\n\n');

  const attachmentParts: string[] = [];
  for (const file of input.attachments) {
    if (file.kind === 'text' && file.text) {
      attachmentParts.push(`--- attached file: ${file.name} ---\n${file.text}`);
    } else if (file.kind === 'binary') {
      attachmentParts.push(`--- attached file (no extractable text): ${file.name} ---`);
    }
  }
  for (const image of imagePaths) {
    attachmentParts.push(
      `--- attached image: ${image.name} — read it with the Read tool at ${image.path} before answering ---`,
    );
  }

  const attachmentBlock =
    attachmentParts.length > 0 ? `\n\n[ATTACHMENTS]\n${attachmentParts.join('\n\n')}` : '';
  const userTurn = `${input.message}${attachmentBlock}`;
  return transcript ? `${transcript}\n\nUser: ${userTurn}` : userTurn;
}

interface SpawnOptions {
  model: string;
  /** Set when images were written to disk: lets the CLI read just that folder. */
  imageDir?: string;
}

function spawnStream(
  prompt: string,
  system: string,
  partialMessages: boolean,
  options: SpawnOptions,
): ChildProcess {
  const args = [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    ...(partialMessages ? ['--include-partial-messages'] : []),
    // No attachments: no tools at all. `--tools ""` is what actually empties the
    // set — `--allowed-tools ""` leaves every tool in place, and the model then
    // answers "look at this screen" by reaching for Glob, spending its one turn
    // on a tool call and returning no text at all.
    // With images: Read, scoped to their temp folder only ("//" makes the
    // pattern absolute), and enough turns to look.
    ...(options.imageDir ? ['--allowed-tools', `Read(/${options.imageDir}/**)`] : ['--tools', '']),
    '--max-turns',
    options.imageDir ? '4' : '1',
    '--no-session-persistence',
    '--model',
    options.model,
    '--append-system-prompt',
    system,
  ];
  const child = spawn('claude', args, {
    // Outside the repo so the CLI does not auto-load a project CLAUDE.md.
    cwd: options.imageDir ?? tmpdir(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin?.end(prompt, 'utf8');
  return child;
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json(
      { error: 'The folder terminal only accepts local requests.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Could not read that message.' }, { status: 400 });
  }

  // Images land in a fresh temp folder the CLI is allowed to Read.
  const images = parsed.data.attachments.filter((file) => file.kind === 'image' && file.dataBase64);
  let imageDir: string | undefined;
  const imagePaths: { path: string; name: string }[] = [];
  if (images.length > 0) {
    imageDir = await mkdtemp(join(tmpdir(), 'we-adk-chat-'));
    for (const [index, image] of images.entries()) {
      const ext = (image.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = join(imageDir, `image-${index + 1}.${ext || 'png'}`);
      await writeFile(path, Buffer.from(image.dataBase64 ?? '', 'base64'));
      imagePaths.push({ path, name: image.name });
    }
  }
  const cleanup = () => {
    if (imageDir) void rm(imageDir, { recursive: true, force: true });
  };

  const prompt = buildPrompt(parsed.data, imagePaths);
  const system = systemPrompt(parsed.data);
  const model = parsed.data.model;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let child: ChildProcess;
      let sawLine = false;
      let retried = false;
      let closed = false;

      const send = (line: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${line}\n`));
        } catch {
          closed = true;
        }
      };
      const sendEvent = (event: Record<string, unknown>) => send(JSON.stringify(event));
      const finish = () => {
        cleanup();
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by cancel().
        }
      };

      const timer = setTimeout(() => {
        sendEvent({ type: 'bridge_error', error: `Timed out after ${TIMEOUT_MS / 1000}s.` });
        child.kill('SIGKILL');
      }, TIMEOUT_MS);

      const attach = (proc: ChildProcess) => {
        let stdoutBuffer = '';
        let stderrTail = '';

        proc.stdout?.on('data', (chunk: Buffer) => {
          stdoutBuffer += chunk.toString('utf8');
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.trim().length === 0) continue;
            sawLine = true;
            send(line);
          }
        });
        proc.stderr?.on('data', (chunk: Buffer) => {
          stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2_000);
        });
        proc.on('error', (error) => {
          clearTimeout(timer);
          const notFound = 'code' in error && (error as { code?: string }).code === 'ENOENT';
          sendEvent({
            type: 'bridge_error',
            error: notFound
              ? 'The `claude` CLI was not found on this machine. Install Claude Code and make sure `claude` is on PATH.'
              : 'Could not start the local Claude Code CLI.',
          });
          finish();
        });
        proc.on('close', (code) => {
          // Older CLIs reject --include-partial-messages; fall back once, silently.
          if (
            code !== 0 &&
            !sawLine &&
            !retried &&
            /include-partial|unknown option/i.test(stderrTail)
          ) {
            retried = true;
            child = spawnStream(prompt, system, false, { model, imageDir });
            attach(child);
            return;
          }
          clearTimeout(timer);
          if (code !== 0 && !sawLine) {
            const detail = stderrTail.trim().split('\n').at(-1) ?? `exit code ${code}`;
            sendEvent({ type: 'bridge_error', error: `Claude Code failed: ${detail}` });
          }
          finish();
        });
      };

      child = spawnStream(prompt, system, true, { model, imageDir });
      attach(child);

      // The user pressed escape (or closed the tab): kill the CLI immediately.
      request.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        closed = true;
        child.kill('SIGKILL');
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
