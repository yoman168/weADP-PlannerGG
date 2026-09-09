/**
 * The AI calls, as the browser makes them.
 *
 * These go to the proxies under `src/app/api/`, not to the API directly — same origin, no
 * CORS, and the block catalogue is added on the way through by code that owns it. The
 * request and response shapes are the ones the workspace has always used, which is why the
 * existing panels did not have to change when the engine behind them moved to the API.
 *
 * `readChatEvent` in `@/components/we-adk/claude-chat` decodes the chat stream; that
 * decoder is the client half of a contract pinned on the API side by
 * `ChatEnvelopes.java` and its test.
 */
import { claudeHeaders } from '@/lib/we-adk/claude-account';
import { readApiError, readJson } from './errors';
import type { Schema } from './client';

export type AiStatus = Schema<'AiStatus'>;
export type GeneratedScreen = Schema<'GeneratedScreen'>;

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, response.status));
  }
  return payload as T;
}

/** Whether the API can call Claude at all — asked before offering an AI action. */
export async function aiStatus(): Promise<AiStatus> {
  const response = await fetch('/api/ai/status');
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, response.status));
  }
  return payload as AiStatus;
}

export interface CanvasEditResult {
  reply: string;
  operations: unknown[];
  skipped: string[];
}

/** An instruction becomes canvas operations, already checked against the catalogue. */
export function editCanvas(
  input: { instruction: string; blocks: unknown[]; projectId?: string },
  signal?: AbortSignal,
): Promise<CanvasEditResult> {
  return post<CanvasEditResult>('/api/sketcher/ai', input, signal);
}

export interface GenerateResult {
  reply: string;
  screens: GeneratedScreen[];
  skipped: string[];
}

/** Meeting notes become proposed screens. */
export function generateScreens(
  input: {
    notes: string;
    customer?: string;
    sessionTitle?: string;
    maxScreens?: number;
    references?: string;
    referenceNames?: string[];
    baseScreen?: { path: string; route: string; blocks: { kind: string; label?: string }[] };
    projectId?: string;
  },
  signal?: AbortSignal,
): Promise<GenerateResult> {
  return post<GenerateResult>('/api/sketcher/generate', input, signal);
}

/** A PRD becomes functional requirements. */
export function generateFrd(
  input: {
    prdId: string;
    prdTitle: string;
    prdDescription?: string;
    requirements: string[];
    screens: string[];
    projectId?: string;
  },
  signal?: AbortSignal,
): Promise<{ items: { title?: string }[]; reply?: string }> {
  return post('/api/sketcher/frd', input, signal);
}

/** Proves the credential the browser holds actually works. */
export function verifyCredential(): Promise<{ ok: boolean; model?: string }> {
  return post('/api/claude-auth/verify', {});
}
