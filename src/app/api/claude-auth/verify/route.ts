/**
 * Confirms a pasted credential works before the browser saves it.
 *
 * The API runs one tiny Haiku turn as that credential and reports the outcome, so a key
 * that will not work is rejected at the point it is entered rather than the first time
 * someone tries to generate a screen.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { forward } from '@/lib/api/backend';
import { isLoopbackRequest } from '@/lib/api/loopback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ error: 'Remote access is disabled.' }, { status: 403 });
  }

  // The key itself travels in the header `backendHeaders` forwards; there is no body.
  const outcome = await forward<{ ok?: boolean; model?: string }>(request, '/api/ai/verify', {});
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({ ok: true, model: outcome.data.model });
}
