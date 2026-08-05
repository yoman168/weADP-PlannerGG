import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isLoopbackRequest, runClaude } from '@/lib/we-adk/claude-cli';
import {
  DEV_SESSIONS,
  HARNESSES,
  HARNESS_PILLAR_LABELS,
  INBOUND_REQUIREMENTS,
  type Harness,
  type HarnessPillarKey,
} from '@/lib/we-adk-mock/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  prompt: z.string().min(1).max(8000),
  harnessId: z.string(),
  sessionId: z.string().optional(),
  /** The Builder requirement the developer is solving. */
  requirementId: z.string().optional(),
});

const PILLAR_ORDER: HarnessPillarKey[] = [
  'rules',
  'domainContext',
  'workflow',
  'accessLimits',
  'validation',
  'designConformance',
];

const PILLAR_PREAMBLE: Record<HarnessPillarKey, string> = {
  rules: 'How code must be written here',
  domainContext: 'Business facts — reason with these, never guess',
  workflow: 'The sequence every task follows',
  accessLimits: 'Hard prohibitions you must not cross',
  validation: 'Work is not done until all of these hold',
  designConformance: 'How the screens must look — the round DESIGN.md is binding',
};

/**
 * Turns a harness into Claude's system prompt. This is the whole point of the
 * platform: the same CLI behaves differently per business line because the
 * rules, domain facts and limits it carries are different.
 */
function buildSystemPrompt(harness: Harness): string {
  const sections = PILLAR_ORDER.map((key) => {
    const pillar = harness.pillars.find((entry) => entry.key === key);
    if (!pillar) return '';
    const heading = `${HARNESS_PILLAR_LABELS[key].toUpperCase()} (${PILLAR_PREAMBLE[key]}):`;
    return [heading, ...pillar.items.map((item) => `- ${item}`)].join('\n');
  }).filter(Boolean);

  return [
    `You are Claude Code working inside the WE-ADK "${harness.name} ${harness.version}" harness`,
    `for the ${harness.businessLine} business line. The harness below is a binding work contract:`,
    'follow it in every answer, and call out explicitly when a request would violate it.',
    '',
    ...sections,
    '',
    'YOUR JOB: help the developer design and implement the requirement they are working on.',
    'Produce concrete work — designs, file-by-file code, tests, review findings — as text they can',
    'apply. You have no tools in this session, so never claim to have created, edited or run',
    'anything. Prefer showing the relevant code over describing it, and always call out which',
    'harness rule or domain fact drove a decision.',
  ].join('\n');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json(
      { error: 'The Developer console only accepts local requests.' },
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
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const harness = HARNESSES.find((entry) => entry.id === parsed.data.harnessId);
  if (!harness) {
    return NextResponse.json({ error: 'Unknown harness.' }, { status: 400 });
  }

  // Give Claude the requirement being solved plus any in-flight session state.
  const requirement = INBOUND_REQUIREMENTS.find((entry) => entry.id === parsed.data.requirementId);
  const session = DEV_SESSIONS.find((entry) => entry.id === parsed.data.sessionId);

  const contextLines: string[] = [];
  if (requirement) {
    contextLines.push(
      'REQUIREMENT HANDED OVER FROM BUILDER:',
      `- Title: ${requirement.title}`,
      `- Planner: ${requirement.planner} · handed over ${requirement.handedOverAt} · difficulty ${requirement.difficulty}/5`,
      `- Status: ${requirement.status}`,
      `- What the planner asked for: ${requirement.summary}`,
      '- Acceptance criteria (all must hold):',
      ...requirement.acceptanceCriteria.map((item) => `  * ${item}`),
      `- Screens affected: ${requirement.targetScreens.map((screen) => screen.name).join(', ')}`,
      '',
    );
  }
  if (session) {
    contextLines.push(
      'WORK IN FLIGHT:',
      `- Stage: ${session.currentStep}`,
      `- Files touched so far: ${session.files.map((file) => file.path).join(', ') || 'none'}`,
      `- Checker verdict: ${session.checkerVerdict.label}`,
      ...(session.checkerNotes.length > 0
        ? ['- Open review notes:', ...session.checkerNotes.map((note) => `  * ${note}`)]
        : []),
      '',
    );
  }

  const outcome = await runClaude({
    prompt: [...contextLines, parsed.data.prompt].join('\n'),
    systemPrompt: buildSystemPrompt(harness),
    timeoutMs: 150_000,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({ text: outcome.text, usage: outcome.usage });
}
