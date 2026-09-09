/**
 * The folder chat, streamed.
 *
 * A pass-through: the request goes to the API and the response body comes back untouched,
 * so the first token reaches the panel as soon as the model produces it.
 *
 * The stream is newline-delimited JSON in the envelope shape `readChatEvent` in
 * `src/components/we-adk/claude-chat.tsx` decodes — a `stream_event` per token, a closing
 * `result` carrying the turn's usage, a `bridge_error` when the bridge itself fails. Six
 * panels read that decoder, so the API emits those exact envelopes and this route does not
 * reshape them. `backend/src/main/java/com/weadk/ai/ChatEnvelopes.java` is the other half
 * of that contract, and its test pins the field names.
 *
 * The caps below are validated here as well as at the API so a body that cannot work is
 * refused without a round trip. Two of them are load-bearing: `message` allows 12,000
 * characters because the canvas generator sends the block catalogue's own schema inline
 * with its prompt, and `context` allows 200,000 because the screen being discussed is in
 * there as full html.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { forwardStream } from '@/lib/api/backend';
import { isLoopbackRequest } from '@/lib/api/loopback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  message: z.string().min(1).max(12_000),
  /** Prior turns in this folder's chat, oldest first. */
  history: z.array(turnSchema).max(30).default([]),
  /** Everything the folder knows — notes, decisions, files, sketches, a screen's html. */
  context: z.string().max(200_000).default(''),
  folderLabel: z.string().max(200).default(''),
  projectName: z.string().max(160).default(''),
  model: z.enum(['sonnet', 'opus', 'haiku']).default('haiku'),
  attachments: z.array(attachmentSchema).max(4).default([]),
  /** Extended thinking on/off for this turn. */
  thinking: z.boolean().default(false),
  /** Model effort level, mirroring Claude Code's Effort setting. */
  effort: z.enum(['low', 'medium', 'high']).optional(),
  projectId: z.string().max(120).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json(
      { error: 'The folder terminal only accepts local requests.' },
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
    return NextResponse.json({ error: 'Could not read that message.' }, { status: 400 });
  }

  return forwardStream(request, '/api/ai/chat', parsed.data);
}
