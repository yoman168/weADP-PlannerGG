/**
 * Canvas edits: an instruction becomes a list of operations.
 *
 * Forwards to the API, which owns the prompt and the model call, and keeps the two things
 * that belong on this side: the block catalogue, generated from the same module the
 * inspector is drawn from, and `parseAiResult`, which checks each returned operation
 * against that catalogue. The API deliberately does not validate them — it would need its
 * own copy of the catalogue to do it, and a second copy is a copy that drifts.
 *
 * One operation failing validation costs that operation, not the batch, which is why the
 * checking is per-operation and the rejects come back in `skipped`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { forward } from '@/lib/api/backend';
import { isLoopbackRequest } from '@/lib/api/loopback';
import { aiRequestSchema, describeCatalog, parseAiResult } from '@/lib/we-adk/sketcher-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CanvasReply {
  reply?: string;
  operations?: unknown[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ error: 'Remote access is disabled.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Could not read that instruction.' }, { status: 400 });
  }

  const projectId =
    typeof (body as { projectId?: unknown }).projectId === 'string'
      ? (body as { projectId: string }).projectId
      : undefined;

  const outcome = await forward<CanvasReply>(request, '/api/ai/canvas', {
    instruction: parsed.data.instruction,
    blocks: parsed.data.blocks,
    catalog: describeCatalog(),
    projectId,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const result = parseAiResult({
    reply: outcome.data.reply,
    operations: outcome.data.operations ?? [],
  });
  if (!result) {
    return NextResponse.json(
      { error: 'Claude returned a response this canvas could not read.' },
      { status: 502 },
    );
  }
  if (result.skipped.length > 0) {
    // Kept visible rather than silent: an operation the catalogue rejected is usually a
    // prop name the model invented, and that is worth seeing.
    console.error('[sketcher-ai] skipped operations:', JSON.stringify(result.skipped, null, 2));
  }

  return NextResponse.json({
    reply: result.reply,
    operations: result.operations,
    skipped: result.skipped.map((entry) => entry.reason),
  });
}
