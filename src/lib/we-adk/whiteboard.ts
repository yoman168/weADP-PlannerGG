/**
 * What is left of the hand-rolled whiteboard.
 *
 * The board is Excalidraw now, so the pen, the eraser and the canvas renderer
 * that used to live here are gone. Two things survived because they still have
 * callers: the stroke format, so boards drawn before the change can be carried
 * into a scene once (see `strokesAsElements`), and the data-URL size helper the
 * attach paths share.
 */

export interface Stroke {
  /** CSS colour. An eraser stroke was simply white — the paper colour. */
  color: string;
  width: number;
  /** Flattened x, y pairs, in the old board's 960×540 coordinates. */
  points: number[];
}

const STORAGE_KEY = 'we-adk:whiteboard';

function boardKey(sessionId: string): string {
  return `${STORAGE_KEY}:${sessionId}`;
}

function isStrokeArray(value: unknown): value is Stroke[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { color?: unknown }).color === 'string' &&
        typeof (entry as { width?: unknown }).width === 'number' &&
        Array.isArray((entry as { points?: unknown }).points),
    )
  );
}

/** Strokes from a board drawn before Excalidraw, or none. */
export function loadBoard(sessionId: string): Stroke[] {
  try {
    const raw = window.localStorage.getItem(boardKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isStrokeArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Called once the strokes have been converted, so they cannot be re-imported. */
export function clearBoard(sessionId: string): void {
  try {
    window.localStorage.removeItem(boardKey(sessionId));
  } catch {
    // Storage unavailable — the strokes stay, and convert again next time.
  }
}

/** What a data URL weighs, for the file row. Base64 carries 3 bytes per 4 chars. */
export function dataUrlSizeKb(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.max(1, Math.round((base64.length * 3) / 4 / 1024));
}
