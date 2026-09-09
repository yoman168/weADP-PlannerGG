import { NextResponse, type NextRequest } from 'next/server';
import { isLoopbackRequest, readClaudeToken, runClaude } from '@/lib/we-adk/claude-cli';
import {
  aiRequestSchema,
  describeCanvas,
  describeCatalog,
  parseAiResult,
} from '@/lib/we-adk/sketcher-operations';
import { type CanvasBlock } from '@/lib/we-adk-mock/sketcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildPrompt(instruction: string, blocks: CanvasBlock[]): string {
  return [
    'You are the edit engine behind a UI mockup tool called WE-ADK Sketcher.',
    'A screen is a flat, ordered list of blocks. Translate the user instruction into canvas operations.',
    '',
    describeCatalog(),
    '',
    'CURRENT CANVAS (in order):',
    describeCanvas(blocks),
    '',
    `USER INSTRUCTION: ${instruction}`,
    '',
    'Respond with a single JSON object and nothing else — no prose, no markdown fences:',
    '{"reply": "<one short sentence describing what you changed>", "operations": [ ... ]}',
    '',
    'Allowed operations:',
    '{"op":"add","kind":"<block kind>","index":<optional 0-based insert position>,"name":"<optional layer name>","props":{...}}',
    '{"op":"addPattern","patternId":"<pattern id>","index":<optional>}',
    '{"op":"remove","id":"<existing block id>"}',
    '{"op":"update","id":"<existing block id>","props":{ only the props you are changing }}',
    '{"op":"rename","id":"<existing block id>","name":"<new layer name>"}',
    '{"op":"move","id":"<existing block id>","index":<new 0-based position>}',
    '{"op":"setHidden","id":"<existing block id>","hidden":true|false}',
    '{"op":"clear"}  — removes every block',
    '{"op":"reset"}  — restores the starter List page layout',
    '',
    'Rules:',
    '- Only use block kinds and prop names listed above. Never invent props.',
    '- Only reference ids that exist in the current canvas.',
    '- Prefer "update" over remove+add when changing an existing block.',
    '- If the instruction is a question or cannot be done, return an empty operations array and explain in "reply".',
    '- Keep "reply" under 25 words.',
  ].join('\n');
}

/** Models sometimes wrap JSON in prose or fences; pull out the outermost object. */
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
      { error: 'The Sketcher AI bridge only accepts local requests.' },
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

  const parsedRequest = aiRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const blocks = parsedRequest.data.blocks as CanvasBlock[];
  const outcome = await runClaude({
    prompt: buildPrompt(parsedRequest.data.instruction, blocks),
    token,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  let parsedResponse: unknown;
  try {
    parsedResponse = extractJsonObject(outcome.text);
  } catch {
    // Still useful: surface the prose so the user sees what Claude said.
    return NextResponse.json({ reply: outcome.text.slice(0, 500), operations: [] });
  }

  const result = parseAiResult(parsedResponse);
  if (!result) {
    console.error('[sketcher-ai] unusable response envelope:', outcome.text.slice(0, 2000));
    return NextResponse.json(
      { error: 'Claude returned a response this canvas could not read.' },
      { status: 502 },
    );
  }

  if (result.skipped.length > 0) {
    // Keep the good operations, but make the dropped ones visible rather than silent.
    console.error('[sketcher-ai] skipped operations:', JSON.stringify(result.skipped, null, 2));
  }

  return NextResponse.json({
    reply: result.reply,
    operations: result.operations,
    skipped: result.skipped.map((entry) => entry.reason),
  });
}
