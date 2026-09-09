/**
 * Confirms a pasted `claude setup-token` actually works before the browser
 * saves it: runs one tiny haiku turn as that account and reports the outcome.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isLoopbackRequest, readClaudeToken, runClaude } from '@/lib/we-adk/claude-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ error: 'Remote access is disabled.' }, { status: 403 });
  }

  const token = readClaudeToken(request);
  if (!token) {
    return NextResponse.json(
      { error: 'That does not look like a Claude Code token (expected sk-ant-…).' },
      { status: 401 },
    );
  }

  const outcome = await runClaude({
    prompt: 'Reply with exactly OK',
    token,
    model: 'haiku',
    timeoutMs: 60_000,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({ ok: true });
}
