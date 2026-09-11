/**
 * Pictures made on a task's board, kept as the task's own work.
 *
 * These used to be filed under Reference files, next to the customer's
 * spreadsheet and the call recording. That was wrong about where they come from:
 * a reference is something handed to us, and a board is something we drew. They
 * are listed as cards under the board instead, so the task shows what it produced
 * without claiming somebody sent it.
 *
 * A picture is stored as a data URL, which the API will refuse past a few
 * megabytes — so writing says whether it worked rather than losing the board
 * quietly.
 */
import { workspaceStore } from '@/lib/api/workspace-store';

export type BoardKind = 'whiteboard' | 'flow' | 'entities';

export interface BoardArtifact {
  id: string;
  kind: BoardKind;
  /** `Whiteboard 2`, `Flow 1`, `Entity model 3`. */
  title: string;
  /** What the author said it shows. Also what the brief reads. */
  caption?: string;
  /** PNG data URL. Absent when the picture was too big to keep. */
  dataUrl?: string;
  sizeKb: number;
  createdAt: string;
  createdBy: string;
  /** Set once a card has been reopened and saved again. */
  updatedAt?: string;
  /**
   * Enough to open this card again.
   *
   * A card used to be only a picture, which made it a dead end: the board clears
   * when you save, so there was no way back into what you drew. An entity model
   * keeps its source text; a whiteboard keeps its scene. Cards saved before this
   * carry neither, and say so rather than offering an Edit that cannot work.
   */
  source?: string;
  scene?: { elements: unknown[]; files: Record<string, unknown> };
}

export const KIND_LABEL: Record<BoardKind, string> = {
  whiteboard: 'Whiteboard',
  flow: 'Flow',
  entities: 'Entity model',
};

const STORAGE_KEY = 'we-adk:board-cards';

function cardsKey(sessionId: string): string {
  return `${STORAGE_KEY}:${sessionId}`;
}

function isArtifactArray(value: unknown): value is BoardArtifact[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { title?: unknown }).title === 'string',
    )
  );
}

export function loadArtifacts(sessionId: string): BoardArtifact[] {
  try {
    const raw = workspaceStore.getItem(cardsKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isArtifactArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(sessionId: string, artifacts: BoardArtifact[]): boolean {
  try {
    if (artifacts.length === 0) {
      workspaceStore.removeItem(cardsKey(sessionId));
      return true;
    }
    workspaceStore.setItem(cardsKey(sessionId), JSON.stringify(artifacts));
    return true;
  } catch {
    return false;
  }
}

let counter = 0;

/**
 * Records a board. Numbering runs per kind and off the highest already used, so
 * deleting Whiteboard 2 does not make the next one collide with Whiteboard 3.
 *
 * Returns null when the browser refused the write — the caller must say so rather
 * than show a card that will not survive a reload.
 */
export interface ArtifactFields {
  kind: BoardKind;
  /**
   * What to call it. Falls back to `Entity model 3` and the like — a numbered
   * title is a placeholder for a name, not a better answer than one.
   */
  title?: string;
  caption?: string;
  dataUrl?: string;
  sizeKb: number;
  createdBy: string;
  /** What an editor needs to reopen this — see BoardArtifact.source / .scene. */
  source?: string;
  scene?: { elements: unknown[]; files: Record<string, unknown> };
}

export function addArtifact(
  sessionId: string,
  fields: ArtifactFields,
  today: string,
): BoardArtifact | null {
  const existing = loadArtifacts(sessionId);
  const used = existing
    .filter((entry) => entry.kind === fields.kind)
    .map((entry) => Number(/(\d+)$/.exec(entry.title)?.[1] ?? 0));
  counter += 1;

  const artifact: BoardArtifact = {
    id: `bc-${counter}-${Math.random().toString(36).slice(2, 7)}`,
    kind: fields.kind,
    title: fields.title?.trim() || `${KIND_LABEL[fields.kind]} ${Math.max(0, ...used) + 1}`,
    ...(fields.caption ? { caption: fields.caption } : {}),
    ...(fields.dataUrl ? { dataUrl: fields.dataUrl } : {}),
    sizeKb: fields.sizeKb,
    createdAt: today,
    createdBy: fields.createdBy,
    ...(fields.source ? { source: fields.source } : {}),
    ...(fields.scene ? { scene: fields.scene } : {}),
  };

  return write(sessionId, [...existing, artifact]) ? artifact : null;
}

/**
 * Saves over a card that was reopened.
 *
 * Keeps its identity — id, title, and the day it was first made — so editing
 * `Entity model 1` leaves you with `Entity model 1` rather than a second card
 * beside the one you were fixing. Returns null when the write is refused, and in
 * that case the old card is still there, which is the right way round.
 */
export function replaceArtifact(
  sessionId: string,
  id: string,
  fields: ArtifactFields,
  today: string,
): BoardArtifact | null {
  const existing = loadArtifacts(sessionId);
  const previous = existing.find((entry) => entry.id === id);
  if (!previous) return addArtifact(sessionId, fields, today);

  const updated: BoardArtifact = {
    id: previous.id,
    // A renamed model renames its card; an unnamed one keeps the title it had.
    title: fields.title?.trim() || previous.title,
    createdAt: previous.createdAt,
    kind: fields.kind,
    sizeKb: fields.sizeKb,
    createdBy: fields.createdBy,
    updatedAt: today,
    ...(fields.caption ? { caption: fields.caption } : {}),
    ...(fields.dataUrl ? { dataUrl: fields.dataUrl } : {}),
    ...(fields.source ? { source: fields.source } : {}),
    ...(fields.scene ? { scene: fields.scene } : {}),
  };

  return write(
    sessionId,
    existing.map((entry) => (entry.id === id ? updated : entry)),
  )
    ? updated
    : null;
}

export function removeArtifact(sessionId: string, id: string): BoardArtifact[] {
  const next = loadArtifacts(sessionId).filter((entry) => entry.id !== id);
  write(sessionId, next);
  return next;
}

/** A filename for downloading one: `whiteboard-2.png`. */
export function artifactFileName(artifact: BoardArtifact): string {
  return `${artifact.title.toLowerCase().replace(/\s+/g, '-')}.png`;
}
