/**
 * A PRD becomes functional requirements.
 *
 * A straight forward: nothing here depends on the block catalogue, so there is nothing to
 * validate on this side. When the model answers in prose instead of JSON the API returns
 * that prose with an empty `items`, and the caller derives its own list — which is why
 * this route reports an empty result rather than an error.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { forward } from '@/lib/api/backend';
import { isLoopbackRequest } from '@/lib/api/loopback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  prdId: z.string().min(1).max(60),
  prdTitle: z.string().min(1).max(300),
  prdDescription: z.string().max(4_000).optional(),
  requirements: z.array(z.string().max(600)).max(60).default([]),
  screens: z.array(z.string().max(300)).max(60).default([]),
  projectId: z.string().max(120).optional(),
});

interface FrdReply {
  items?: { title?: string }[];
  reply?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ error: 'Only local requests allowed.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Could not read that PRD.' }, { status: 400 });
  }

  const outcome = await forward<FrdReply>(request, '/api/ai/frd', parsed.data);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({
    items: outcome.data.items ?? [],
    ...(outcome.data.reply ? { reply: outcome.data.reply } : {}),
  });
}
