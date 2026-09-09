/**
 * Where a task's diagram model is kept.
 *
 * This is what is left of the diagram-as-code module. The text editor it served is
 * gone — an entity model is built from a form now — but the model is still stored
 * as text, and two small things outlived the editor: the direction a diagram runs,
 * and how a line is reported when it cannot be read.
 */
import { workspaceStore } from '@/lib/api/workspace-store';

export type DiagramDirection = 'down' | 'right';

/** Something wrong with one line, reported rather than guessed at. */
export interface DiagramIssue {
  line: number;
  message: string;
}

const STORAGE_KEY = 'we-adk:diagram-code';

function sourceKey(sessionId: string): string {
  return `${STORAGE_KEY}:${sessionId}`;
}

export function loadDiagramSource(sessionId: string): string {
  try {
    return workspaceStore.getItem(sourceKey(sessionId)) ?? '';
  } catch {
    return '';
  }
}

export function saveDiagramSource(sessionId: string, source: string): void {
  try {
    if (source.trim().length === 0) workspaceStore.removeItem(sourceKey(sessionId));
    else workspaceStore.setItem(sourceKey(sessionId), source);
  } catch {
    // Storage unavailable — the model still works for this sitting.
  }
}
