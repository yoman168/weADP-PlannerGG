/**
 * The conversation beside a board, kept per task.
 *
 * Shared by the whiteboard and the entity canvas so the two do not each grow their
 * own copy of the same eight lines. `scope` separates their threads: asking about a
 * drawing and asking about a data model are different conversations, and mixing
 * them would feed each one the other's history.
 *
 * The whiteboard passes no scope, which keeps its key exactly as it was — threads
 * that already exist stay where they are.
 */
import { type ChatTurn } from '@/components/we-adk/claude-chat';
import { workspaceStore } from '@/lib/api/workspace-store';

const STORAGE_KEY = 'we-adk:board-chat';

function chatKey(sessionId: string, scope?: string): string {
  return `${STORAGE_KEY}:${sessionId}${scope ? `:${scope}` : ''}`;
}

export function loadBoardChat(sessionId: string, scope?: string): ChatTurn[] {
  try {
    const raw = workspaceStore.getItem(chatKey(sessionId, scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

export function saveBoardChat(sessionId: string, turns: ChatTurn[], scope?: string): void {
  try {
    // Last forty turns: enough to read back, small enough not to crowd the boards
    // themselves out of storage.
    workspaceStore.setItem(chatKey(sessionId, scope), JSON.stringify(turns.slice(-40)));
  } catch {
    // Storage unavailable — the thread simply does not persist.
  }
}
