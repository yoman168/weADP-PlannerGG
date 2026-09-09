/**
 * A whiteboard scene: Excalidraw's own elements, kept per task.
 *
 * Nothing here understands what an element is — that is Excalidraw's business.
 * This only stores the array it hands over and reports how many live elements are
 * in it, so the task panel can say what is waiting without pulling the whole
 * editor into its bundle.
 *
 * Scenes can outgrow one stored value (a pasted screenshot is a data URL in `files`),
 * so writing reports whether it worked instead of failing silently.
 */
import { workspaceStore } from '@/lib/api/workspace-store';

export interface BoardScene {
  /** Excalidraw elements, exactly as the editor produced them. */
  elements: unknown[];
  /** Pasted or dropped images, keyed by file id. */
  files: Record<string, unknown>;
}

const STORAGE_KEY = 'we-adk:board-scene';

function sceneKey(sessionId: string): string {
  return `${STORAGE_KEY}:${sessionId}`;
}

function isScene(value: unknown): value is BoardScene {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { elements?: unknown }).elements)
  );
}

export function loadScene(sessionId: string): BoardScene | null {
  try {
    const raw = workspaceStore.getItem(sceneKey(sessionId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isScene(parsed)) return null;
    return { elements: parsed.elements, files: parsed.files ?? {} };
  } catch {
    return null;
  }
}

/** False when the browser refused the write — the caller should say so. */
export function saveScene(sessionId: string, scene: BoardScene): boolean {
  try {
    if (scene.elements.length === 0) {
      workspaceStore.removeItem(sceneKey(sessionId));
      return true;
    }
    workspaceStore.setItem(sceneKey(sessionId), JSON.stringify(scene));
    return true;
  } catch {
    return false;
  }
}

export function clearScene(sessionId: string): void {
  try {
    workspaceStore.removeItem(sceneKey(sessionId));
  } catch {
    // Nothing to do — the scene simply stays as it was.
  }
}

/** Live elements: Excalidraw keeps deleted ones around for undo. */
export function sceneCount(sessionId: string): number {
  const scene = loadScene(sessionId);
  if (!scene) return 0;
  return scene.elements.filter(
    (element) =>
      typeof element === 'object' &&
      element !== null &&
      (element as { isDeleted?: boolean }).isDeleted !== true,
  ).length;
}
