/**
 * Meeting notes become proposed screens — the board's "Generate screens".
 *
 * Same split as the canvas route: the API holds the prompt, the model call and the spend
 * record; the catalogue and `parseGeneratedScreens` stay here, because they are generated
 * from the block definitions this side owns. A screen whose blocks do not match the
 * catalogue is dropped and reported in `skipped` rather than failing the whole set.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { forward } from '@/lib/api/backend';
import { isLoopbackRequest } from '@/lib/api/loopback';
import { describeCatalog, parseGeneratedScreens } from '@/lib/we-adk/sketcher-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  notes: z.string().min(20).max(12_000),
  customer: z.string().max(120).optional(),
  sessionTitle: z.string().max(160).optional(),
  maxScreens: z.coerce.number().int().min(1).max(8).default(4),
  /** Merged text of the meeting's reference files (their sheet, the transcript, the RFP). */
  references: z.string().max(16_000).optional(),
  /** Names of attachments with no extractable text, so the model knows they exist. */
  referenceNames: z.array(z.string().max(200)).max(40).optional(),
  /** Optional: the production screen the change applies to. */
  baseScreen: z
    .object({
      path: z.string().max(200),
      route: z.string().max(200),
      blocks: z.array(z.object({ kind: z.string(), label: z.string().optional() })).max(30),
    })
    .optional(),
  projectId: z.string().max(120).optional(),
});

interface GenerateReply {
  reply?: string;
  screens?: unknown[];
  usage?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json(
      { error: 'The Sketcher generator only accepts local requests.' },
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
      { error: 'Paste at least a couple of lines of meeting notes.' },
      { status: 400 },
    );
  }

  const outcome = await forward<GenerateReply>(request, '/api/ai/generate', {
    ...parsed.data,
    catalog: describeCatalog(),
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const result = parseGeneratedScreens({
    reply: outcome.data.reply,
    screens: outcome.data.screens ?? [],
  });
  if (!result || result.screens.length === 0) {
    console.error(
      '[sketcher-generate] no screens matched the catalog:',
      JSON.stringify(outcome.data.screens ?? []).slice(0, 2000),
    );
    return NextResponse.json(
      { error: 'Claude proposed no screens that matched the block catalog.' },
      { status: 502 },
    );
  }
  if (result.skipped.length > 0) {
    console.error('[sketcher-generate] skipped screens:', result.skipped);
  }

  return NextResponse.json({
    reply: result.reply,
    screens: result.screens,
    skipped: result.skipped,
    usage: outcome.data.usage,
  });
}
