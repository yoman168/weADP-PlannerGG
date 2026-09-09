import { NextResponse, type NextRequest } from 'next/server';
import { isLoopbackRequest, readClaudeToken, runClaude } from '@/lib/we-adk/claude-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildPrompt(prdId: string, prdTitle: string, prdDescription: string, prdRequirements: string[], screens: string[]): string {
  return [
    'You are a business analyst generating Functional Requirements (FRD) from a Product Requirements Document (PRD).',
    '',
    `PRD: [${prdId}] ${prdTitle}`,
    `Description: ${prdDescription}`,
    '',
    'Product Requirements (PRD items):',
    ...prdRequirements.map((r, i) => `  ${i + 1}. ${r}`),
    '',
    'Screens in this feature:',
    ...screens.map((s) => `  - ${s}`),
    '',
    'Generate 4–8 functional requirements that describe specific, implementable behaviors for these screens.',
    'Each FRD item should be a concrete UI behavior, data rule, or interaction — not a copy of the PRD items.',
    'Think about: validation rules, edge cases, loading states, error handling, data formats, permissions, and UX details.',
    '',
    'Respond with ONLY a JSON array, no markdown fences, no prose:',
    '[{"title": "Short functional requirement"}, ...]',
  ].join('\n');
}

function extractJsonArray(text: string): unknown[] {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('No JSON array found');
  return JSON.parse(candidate.slice(start, end + 1)) as unknown[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ error: 'Only local requests allowed.' }, { status: 403 });
  }

  const token = readClaudeToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Connect your Claude account first.' }, { status: 401 });
  }

  let body: { prdId: string; prdTitle: string; prdDescription: string; requirements: string[]; screens: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const outcome = await runClaude({
    prompt: buildPrompt(body.prdId, body.prdTitle, body.prdDescription, body.requirements, body.screens),
    token,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  try {
    const items = extractJsonArray(outcome.text);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ reply: outcome.text, items: [] });
  }
}
