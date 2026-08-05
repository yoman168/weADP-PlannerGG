import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseDesignPackage } from '@/lib/we-adk/design-phase';
import { isLoopbackRequest, runClaude } from '@/lib/we-adk/claude-cli';
import { describeCatalog } from '@/lib/we-adk/sketcher-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  /** The whole project: every meeting's notes, decisions, references and sketches. */
  context: z.string().min(200).max(60_000),
  projectName: z.string().max(160).optional(),
  customer: z.string().max(160).optional(),
  maxScreens: z.coerce.number().int().min(3).max(20).default(10),
});

function buildPrompt(input: z.infer<typeof requestSchema>): string {
  return [
    'You are WE-ADK Sketcher, moving a project out of discovery and into design.',
    '',
    'Discovery produced one sketch at a time, each drawn from a single meeting. Those sketches',
    'overlap, repeat each other and sometimes contradict, because the customer changed their mind',
    'between meetings. Your job is to consolidate everything into ONE screen set a designer can',
    'work from — the design phase baseline.',
    '',
    describeCatalog(),
    '',
    input.projectName ? `PROJECT: ${input.projectName}` : '',
    input.customer ? `CUSTOMER: ${input.customer}` : '',
    '',
    'EVERYTHING THE PROJECT KNOWS (meetings in chronological order):',
    input.context,
    '',
    'How to consolidate:',
    '- Later meetings override earlier ones. If meeting 3 split a screen that meeting 1 drew whole,',
    '  the split wins, and the original is dropped with a reason.',
    '- Merge duplicates: two meetings sketching the same screen become one, keeping the better props.',
    '- Honour every decision. A decision is settled; do not redesign around it.',
    '- Do not design an answer to an open question. Name it as a risk instead.',
    '- Reference-file content is evidence of how the customer works: take real column names,',
    '  statuses and wording from it rather than inventing them.',
    '- Where two meetings genuinely conflict, list it under "conflicts" with a recommendation —',
    '  a human settles it, not you.',
    '',
    `Return at most ${input.maxScreens} screens. Respond with a single JSON object and nothing else —`,
    'no prose, no markdown fences:',
    '{"summary":"<2-4 sentences: what this screen set is and how you resolved the pile>",',
    ' "screens":[{"name":"<screen name>","route":"</path>","rationale":"<why it exists, <25 words>",',
    '   "sources":["<sketch names this replaces>"],"constraints":["<decisions it must honour>"],',
    '   "blocks":[{"kind":"<block kind>","props":{...}}]}],',
    ' "conflicts":[{"issue":"<what disagrees>","meetings":["<which meetings>"],"recommendation":"<what to do>"}],',
    ' "risks":["<open question that makes part of this a guess>"],',
    ' "dropped":[{"name":"<sketch dropped>","reason":"<why>"}]}',
    '',
    'Rules:',
    '- Every screen needs a screenHeader block first, with its label set to the screen name.',
    '- Use only the block kinds and prop names listed above. Never invent props.',
    '- 3 to 8 blocks per screen, filled with content drawn from the meetings, not lorem ipsum.',
    '- Prefer fewer, better screens over covering every sketch.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json(
      { error: 'The design-phase consolidation only accepts local requests.' },
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
    return NextResponse.json(
      { error: 'Not enough project context to consolidate yet.' },
      { status: 400 },
    );
  }

  // Consolidation reads far more than a single generation, so allow longer.
  const outcome = await runClaude({ prompt: buildPrompt(parsed.data), timeoutMs: 420_000 });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  let payload: unknown;
  try {
    payload = extractJsonObject(outcome.text);
  } catch {
    console.error('[sketcher-consolidate] unparseable output:', outcome.text.slice(0, 2000));
    return NextResponse.json(
      { error: 'Claude did not return a design package this screen could read.' },
      { status: 502 },
    );
  }

  const pkg = parseDesignPackage(payload);
  if (!pkg) {
    console.error(
      '[sketcher-consolidate] invalid package:',
      JSON.stringify(payload).slice(0, 2000),
    );
    return NextResponse.json(
      { error: 'Claude returned no screens that matched the block catalog.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ...pkg, usage: outcome.usage });
}
