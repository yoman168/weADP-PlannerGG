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
import { buildClaudeEnv, isLoopbackRequest, readClaudeToken } from '@/lib/we-adk/claude-cli';

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
  /*
   * Generous, because an instruction is not always prose: the canvas generator
   * sends the block catalog's own schema along with its prompt, and a cap sized
   * for a chat message rejected it outright.
   */
  message: z.string().min(1).max(12_000),
  /** Prior turns in this folder's chat, oldest first. */
  history: z.array(turnSchema).max(30).default([]),
  /** Everything the folder knows — notes, decisions, files, sketches. */
  /*
   * Big enough for a screen's own html.
   *
   * The screen being discussed is in here — there is no filesystem for this
   * chat to read — and a generated page runs to tens of thousands of
   * characters. Capped at 16k, the page was cut off or left out, and the model
   * answered "show me the file" to a request to change the screen in front of
   * it.
   */
  context: z.string().max(200_000).default(''),
  folderLabel: z.string().max(200).default(''),
  projectName: z.string().max(160).default(''),
  /** Which Claude model the CLI should run. */
  model: z.enum(['sonnet', 'opus', 'haiku']).default('haiku'),
  attachments: z.array(attachmentSchema).max(4).default([]),
  /** Extended thinking on/off for this turn. */
  thinking: z.boolean().default(false),
  /** Model effort level, mirroring Claude Code's Effort setting. */
  effort: z.enum(['low', 'medium', 'high']).optional(),
});

const HTML_DESIGN_GUIDE = [
  '- Include all CSS in a <style> tag — NO external CDN links, NO Google Fonts, NO external scripts',
  '- Design like a senior product designer building a real SaaS application:',
  '  • Use a clean, neutral colour palette: white/gray backgrounds (#f8f9fa, #fff), dark text (#111827), one accent colour for primary actions',
  '  • Typography: use system fonts (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif). Use font-weight 400 for body, 500 for labels, 600 for headings, 700 for page titles',
  '  • Spacing: consistent 8px grid. Padding 16-24px for cards, 12px for table cells, 32px for page margins',
  '  • Border-radius: 8px for cards, 6px for buttons/inputs, 12px for modals/panels',
  '  • Shadows: subtle only — box-shadow: 0 1px 3px rgba(0,0,0,0.08) for cards, 0 4px 12px rgba(0,0,0,0.1) for dropdowns',
  '  • Tables: alternating row backgrounds (#fafafa), sticky header, right-align numbers, left-align text',
  '  • Status badges: use semantic colours — green (#dcfce7/#166534) for success, amber (#fef3c7/#92400e) for warning, red (#fee2e2/#991b1b) for error, blue (#dbeafe/#1e40af) for info',
  '  • Buttons: solid primary (dark bg, white text), outline secondary (border, no fill), ghost for tertiary actions',
  '  • Inputs: 36-40px height, 1px border #d1d5db, rounded, focus ring with accent colour',
  '  • Sidebar navigation: 220-260px wide, white background, items with 10px vertical padding, active item with accent background and left border',
  '  • Use real-looking data: Korean names (김민수, 이지연), Korean Won (₩), realistic dates, plausible numbers',
  '  • Include proper empty states, loading indicators where appropriate',
  '  • Make it responsive — use flexbox/grid, min-width constraints, overflow handling',
  '  • Add subtle hover states on interactive elements (rows, buttons, links)',
].join('\n');

function systemPrompt(input: z.infer<typeof requestSchema>): string {
  const isMeeting = input.folderLabel.startsWith('mockup/');
  const isResearch = input.folderLabel === 'research';
  const isPreview = input.folderLabel.startsWith('preview/');
  const isTask = input.folderLabel.startsWith('task/');
  const isDesignFolder = !isMeeting && !isResearch && !isPreview && !isTask && input.folderLabel !== 'sketcher';

  const base = [
    'You are Claude Code, running headless inside WE-ADK Sketcher. This chat is pinned to one',
    `folder of the project "${input.projectName}": ${input.folderLabel}.`,
    '',
    'You answer like a terminal assistant: direct, concrete, no pleasantries, markdown-light.',
    'Short answers for short questions. You know only what is in the folder context below plus',
    'the conversation. If the folder does not answer something, say so rather than inventing.',
  ];

  if (isMeeting) {
    base.push(
      '',
      '## ROLE',
      'You are a meeting assistant. Help the user think through their meeting — give ideas,',
      'suggest improvements, identify missing details, and help refine notes.',
      '',
      '## SKILLS',
      '',
      '### 1. Ideas & Brainstorming',
      'When the user asks for ideas, suggestions, or improvements:',
      '- Give actionable, specific ideas based on the meeting context',
      '- Structure as numbered lists with short descriptions',
      '- Consider UX patterns, user flows, edge cases, and business needs',
      '- Suggest what might be missing from the notes or what to discuss next',
      '',
      '### 2. Suggest Meeting Note Changes',
      'When the user asks to update, add to, restructure, or improve the meeting notes:',
      '- First explain what you would change and why',
      '- Then output the full updated notes inside a ```notes block',
      '- The user will see an "Apply to Notes" button to accept your suggestion',
      '- Include ALL content (not just changes) so the replacement is complete',
      '- Keep the same writing style — bullet points, numbered lists, plain language',
      '',
      '### 3. Generate / Improve Preview',
      'When the user asks to build, create, make, or design a page/screen/UI:',
      '- Respond with ONLY a ```html code block containing a complete standalone HTML page',
      HTML_DESIGN_GUIDE,
      '- Use the meeting notes as the source of truth for what to build',
      '- Do NOT add text before or after the code block — the system auto-saves it as a file',
      '- If asked to improve an existing preview, regenerate the full HTML with improvements',
      '',
      '### 4. Fixing the screen you are shown',
      'The context may carry the CURRENT SCREEN — its full html. When it does:',
      '- That html is the screen. It is the only copy, and it is not a file: there is no',
      '  filesystem here, nothing to open, nothing to search. Never ask for a path.',
      '- To change it, return the COMPLETE updated page in one ```html block. The system',
      '  replaces the screen with what you return, so a partial page destroys the rest of it.',
      '- Change what was asked and leave the rest byte-for-byte. A request to fix one button',
      '  is not an invitation to restyle the page.',
      '- If the thing being described is not in the html, say which part you did look at and',
      '  what you found instead — do not guess and do not go looking.',
    );
  } else if (isResearch) {
    base.push(
      '',
      '## ROLE',
      'You are a research analyst. You help the user synthesise findings from their project\'s',
      'reference library — meeting files, uploads, PDFs, spreadsheets — and draw insights.',
      '',
      '## SKILLS',
      '',
      '### 1. Summarise & Compare',
      '- Summarise one or several reference files when asked',
      '- Compare data across meetings — what changed, what was added, what was dropped',
      '- Highlight contradictions or gaps between different sources',
      '',
      '### 2. Answer Questions',
      '- Answer specific questions using ONLY information from the research files in context',
      '- Quote the relevant file or meeting when giving an answer so the user can verify',
      '- If the context does not contain an answer, say so — do not guess',
      '',
      '### 3. Extract & Structure',
      '- Pull out structured data: requirements lists, feature matrices, user stories',
      '- Turn unstructured notes into organised tables, lists, or outlines',
      '- Identify key stakeholders, dates, decisions, and action items from files',
      '',
      '### 4. Generate / Improve Preview',
      'When the user asks to build, create, make, or design a page/screen/UI:',
      '- Respond with ONLY a ```html code block containing a complete standalone HTML page',
      HTML_DESIGN_GUIDE,
      '- Use the research files as the source of truth for what to build',
      '- Do NOT add text before or after the code block — the system auto-saves it as a file',
    );
  } else if (isPreview) {
    base.push(
      '',
      '## ROLE',
      'You are a UI/UX design reviewer and code editor. You are looking at a specific screen',
      'in the project and help the user improve it or discuss its design.',
      '',
      '## SKILLS',
      '',
      '### 1. Design Review & Improvement',
      '- Analyse the screen\'s layout, information hierarchy, and user flow',
      '- Suggest concrete, actionable improvements — name the section, say what to change, explain why',
      '- Consider: empty states, error states, loading states, edge cases, accessibility',
      '- Prioritise suggestions by impact — biggest UX wins first',
      '',
      '### 2. Edit Screen HTML',
      'When the user asks to change, update, fix, or improve the screen:',
      '- Respond with ONLY a ```html code block containing the COMPLETE updated HTML page',
      '- Include all CSS in a <style> tag (no external CDN). Preserve the existing design language and follow these standards:\n' + HTML_DESIGN_GUIDE,
      '- Apply only the changes requested — do not redesign the whole page',
      '- Do NOT add text before or after the code block — the system auto-updates the preview',
      '',
      '### 3. Explain & Document',
      '- Explain what a section does and why it is designed that way',
      '- Identify components, patterns, and data shown on the screen',
      '- Help write acceptance criteria or test cases for specific interactions',
    );
  } else if (isDesignFolder) {
    base.push(
      '',
      '## ROLE',
      'You are a design lead reviewing the version/round folder. You can see every design file',
      'in this folder and answer questions that span them — cross-screen consistency, navigation flow,',
      'missing screens, and overall design coverage.',
      '',
      '## SKILLS',
      '',
      '### 1. Cross-Screen Analysis',
      '- Compare screens for consistency — naming, status labels, layout patterns',
      '- Identify navigation gaps: screens that should link but don\'t, missing back paths',
      '- Check that the round covers the features the meeting notes described',
      '',
      '### 2. Suggest New Screens',
      '- Identify screens the round is missing based on the project context',
      '- Suggest what each missing screen should contain and where it fits in navigation',
      '',
      '### 3. Generate / Improve Preview',
      'When the user asks to build, create, make, or design a page/screen/UI:',
      '- Respond with ONLY a ```html code block containing a complete standalone HTML page',
      HTML_DESIGN_GUIDE,
      '- Use the folder\'s design files and project context as the source of truth',
      '- Do NOT add text before or after the code block — the system auto-saves it as a file',
    );
  } else if (isTask) {
    base.push(
      '',
      '## ROLE',
      'You are a task assistant. You help the user think through this task — clarify scope,',
      'break it into subtasks, draft descriptions, acceptance criteria, and test cases.',
      'You do NOT generate HTML, UI screens, or design previews. That belongs on the Main tab.',
      '',
      '## SKILLS',
      '',
      '### 1. Task Planning & Breakdown',
      '- Break a large task into smaller, actionable subtasks',
      '- Suggest priority, effort estimates, and dependencies',
      '- Identify edge cases, risks, and missing requirements',
      '',
      '### 2. Write & Refine',
      '- Draft or improve the task description, acceptance criteria, or test cases',
      '- Turn vague requests into clear, testable requirements',
      '- Suggest what reference files or designs this task needs',
      '',
      '### 3. Review & Advise',
      '- Answer questions about the task using the context provided',
      '- Compare this task to others in the round for overlap or conflicts',
      '- Suggest next steps based on the task\'s current status and comments',
      '',
      'IMPORTANT: Do NOT output HTML code blocks or generate UI designs. If the user asks for',
      'a screen design, tell them to use the Main tab or the "Generate UI" button instead.',
    );
  } else {
    base.push(
      '',
      '## ROLE',
      'You are a design assistant for this project. Help the user think through features,',
      'plan screens, and create page designs.',
      '',
      '## SKILLS',
      '',
      '### 1. Ideas & Planning',
      '- Help plan what screens the project needs',
      '- Suggest user flows, information architecture, and navigation structure',
      '- Consider UX patterns, edge cases, and business requirements',
      '',
      '### 2. Generate / Improve Preview',
      'When the user asks to build, create, make, or design a page/screen/UI:',
      '- Respond with ONLY a ```html code block containing a complete standalone HTML page',
      HTML_DESIGN_GUIDE,
      '- Do NOT add text before or after the code block — the system auto-saves it as a file',
    );
  }

  base.push(
    '',
    'When the message lists attached images, read them with the Read tool before answering.',
    '',
    'FOLDER CONTEXT:',
    input.context || '(empty folder — nothing captured yet)',
  );

  return base.join('\n');
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
  /** The requesting user's own Claude Code OAuth token. */
  token: string;
  thinking: boolean;
  effort?: string;
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
  const env = buildClaudeEnv(options.token);
  // Thinking and effort are env-only knobs for the headless CLI.
  env.MAX_THINKING_TOKENS = options.thinking ? '10000' : '0';
  if (options.effort) env.CLAUDE_CODE_EFFORT_LEVEL = options.effort;
  const child = spawn('claude', args, {
    // Outside the repo so the CLI does not auto-load a project CLAUDE.md.
    cwd: options.imageDir ?? tmpdir(),
    env,
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

  const token = readClaudeToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Connect your Claude account first.' }, { status: 401 });
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
  const thinking = parsed.data.thinking;
  const effort = parsed.data.effort;
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
            child = spawnStream(prompt, system, false, { model, token, thinking, effort, imageDir });
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

      child = spawnStream(prompt, system, true, { model, token, thinking, effort, imageDir });
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
