'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CANVAS_STORAGE_KEY,
  type BlockKind,
  type BlockProps,
  type CanvasBlock,
  createBlock,
  createPatternBlocks,
  initialCanvas,
  isCanvasBlockArray,
  nextBlockId,
} from '@/lib/we-adk-mock/sketcher';
import { type CanvasOperation } from '@/lib/we-adk/sketcher-operations';
import { workspaceStore } from '@/lib/api/workspace-store';

interface History {
  past: CanvasBlock[][];
  present: CanvasBlock[];
  future: CanvasBlock[][];
}

const MAX_HISTORY = 50;

export interface UseCanvasOptions {
  /** Workspace-state key — pass a per-screen key so screens keep separate canvases. */
  storageKey?: string;
  /** Blocks to start from when nothing has been saved under `storageKey` yet. */
  seed?: () => CanvasBlock[];
}

/**
 * Canvas state with real undo/redo history plus persistence through the API.
 * Every mutation goes through `commit`, which pushes the previous state onto
 * the undo stack and clears the redo stack — the same contract a design tool's
 * history gives you.
 */
export function useCanvas(options: UseCanvasOptions = {}) {
  const storageKey = options.storageKey ?? CANVAS_STORAGE_KEY;
  const seed = options.seed ?? initialCanvas;
  const [initialBlocks] = useState<CanvasBlock[]>(seed);
  const [history, setHistory] = useState<History>({
    past: [],
    present: initialBlocks,
    future: [],
  });
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from workspace state after mount so SSR markup stays stable. A canvas
  // that was never edited counts as saved, so the toolbar doesn't cry wolf.
  useEffect(() => {
    let restored: CanvasBlock[] | null = null;
    try {
      const raw = workspaceStore.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isCanvasBlockArray(parsed)) restored = parsed;
      }
    } catch {
      // Corrupt or unavailable storage — fall back to the default canvas.
    }
    if (restored) setHistory({ past: [], present: restored, future: [] });
    setSavedSnapshot(JSON.stringify(restored ?? initialBlocks));
    setHydrated(true);
  }, [initialBlocks, storageKey]);

  const blocks = history.present;

  const commit = useCallback((next: (current: CanvasBlock[]) => CanvasBlock[]) => {
    setHistory((current) => {
      const computed = next(current.present);
      if (computed === current.present) return current;
      return {
        past: [...current.past, current.present].slice(-MAX_HISTORY),
        present: computed,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const [next, ...rest] = current.future;
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: rest,
      };
    });
  }, []);

  /* --------------------------- mutations --------------------------- */

  const insertBlock = useCallback(
    (kind: BlockKind, atIndex?: number): string => {
      const block = createBlock(kind);
      commit((current) => {
        if (atIndex === undefined || atIndex < 0 || atIndex > current.length) {
          return [...current, block];
        }
        return [...current.slice(0, atIndex), block, ...current.slice(atIndex)];
      });
      return block.id;
    },
    [commit],
  );

  const insertPattern = useCallback(
    (patternId: string, atIndex?: number): string | null => {
      const pattern = createPatternBlocks(patternId);
      const first = pattern[0];
      if (!first) return null;
      commit((current) => {
        if (atIndex === undefined || atIndex < 0 || atIndex > current.length) {
          return [...current, ...pattern];
        }
        return [...current.slice(0, atIndex), ...pattern, ...current.slice(atIndex)];
      });
      return first.id;
    },
    [commit],
  );

  const removeBlock = useCallback(
    (id: string) => {
      commit((current) => current.filter((block) => block.id !== id));
    },
    [commit],
  );

  const duplicateBlock = useCallback(
    (id: string): string | null => {
      const source = history.present.find((block) => block.id === id);
      if (!source) return null;
      const copy: CanvasBlock = {
        ...source,
        id: nextBlockId(),
        name: `${source.name} copy`,
        props: structuredClone(source.props),
      };
      commit((current) => {
        const index = current.findIndex((block) => block.id === id);
        if (index === -1) return [...current, copy];
        return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
      });
      return copy.id;
    },
    [commit, history.present],
  );

  const reorderBlocks = useCallback(
    (fromId: string, toId: string) => {
      commit((current) => {
        const from = current.findIndex((block) => block.id === fromId);
        const to = current.findIndex((block) => block.id === toId);
        if (from === -1 || to === -1 || from === to) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        if (!moved) return current;
        next.splice(to, 0, moved);
        return next;
      });
    },
    [commit],
  );

  const moveBlockBy = useCallback(
    (id: string, delta: number) => {
      commit((current) => {
        const from = current.findIndex((block) => block.id === id);
        if (from === -1) return current;
        const to = Math.min(current.length - 1, Math.max(0, from + delta));
        if (to === from) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        if (!moved) return current;
        next.splice(to, 0, moved);
        return next;
      });
    },
    [commit],
  );

  const updateProps = useCallback(
    (id: string, patch: BlockProps) => {
      commit((current) =>
        current.map((block) =>
          block.id === id ? { ...block, props: { ...block.props, ...patch } } : block,
        ),
      );
    },
    [commit],
  );

  const renameBlock = useCallback(
    (id: string, name: string) => {
      commit((current) => current.map((block) => (block.id === id ? { ...block, name } : block)));
    },
    [commit],
  );

  const toggleHidden = useCallback(
    (id: string) => {
      commit((current) =>
        current.map((block) => (block.id === id ? { ...block, hidden: !block.hidden } : block)),
      );
    },
    [commit],
  );

  /**
   * Applies a batch of AI-produced operations as a single undoable step, so one
   * chat message maps to exactly one press of ⌘Z.
   */
  const applyOperations = useCallback(
    (operations: CanvasOperation[]): number => {
      let applied = 0;
      commit((current) => {
        let next = [...current];
        for (const operation of operations) {
          switch (operation.op) {
            case 'add': {
              const block = createBlock(operation.kind, operation.props);
              if (operation.name) block.name = operation.name;
              const index = operation.index;
              if (index === undefined || index < 0 || index > next.length) next.push(block);
              else next.splice(index, 0, block);
              applied += 1;
              break;
            }
            case 'addPattern': {
              const pattern = createPatternBlocks(operation.patternId);
              if (pattern.length === 0) break;
              const index = operation.index;
              if (index === undefined || index < 0 || index > next.length) next.push(...pattern);
              else next.splice(index, 0, ...pattern);
              applied += 1;
              break;
            }
            case 'remove': {
              const before = next.length;
              next = next.filter((block) => block.id !== operation.id);
              if (next.length !== before) applied += 1;
              break;
            }
            case 'update': {
              let hit = false;
              next = next.map((block) => {
                if (block.id !== operation.id) return block;
                hit = true;
                return { ...block, props: { ...block.props, ...operation.props } };
              });
              if (hit) applied += 1;
              break;
            }
            case 'rename': {
              let hit = false;
              next = next.map((block) => {
                if (block.id !== operation.id) return block;
                hit = true;
                return { ...block, name: operation.name };
              });
              if (hit) applied += 1;
              break;
            }
            case 'move': {
              const from = next.findIndex((block) => block.id === operation.id);
              if (from === -1 || operation.index === undefined) break;
              const to = Math.min(next.length - 1, Math.max(0, operation.index));
              if (to === from) break;
              const [moved] = next.splice(from, 1);
              if (!moved) break;
              next.splice(to, 0, moved);
              applied += 1;
              break;
            }
            case 'setHidden': {
              let hit = false;
              next = next.map((block) => {
                if (block.id !== operation.id) return block;
                hit = true;
                return { ...block, hidden: operation.hidden };
              });
              if (hit) applied += 1;
              break;
            }
            case 'clear':
              next = [];
              applied += 1;
              break;
            case 'reset':
              next = initialCanvas();
              applied += 1;
              break;
          }
        }
        return next;
      });
      return applied;
    },
    [commit],
  );

  const clearCanvas = useCallback(() => {
    commit(() => []);
  }, [commit]);

  const resetCanvas = useCallback(() => {
    commit(() => seed());
  }, [commit, seed]);

  /* --------------------------- persistence ------------------------- */

  const currentSnapshot = useMemo(() => JSON.stringify(blocks), [blocks]);
  const dirty = hydrated && savedSnapshot !== currentSnapshot;

  const save = useCallback(() => {
    try {
      workspaceStore.setItem(storageKey, currentSnapshot);
      setSavedSnapshot(currentSnapshot);
      return true;
    } catch {
      return false;
    }
  }, [currentSnapshot, storageKey]);

  return {
    blocks,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dirty,
    hydrated,
    undo,
    redo,
    save,
    insertBlock,
    insertPattern,
    removeBlock,
    duplicateBlock,
    reorderBlocks,
    moveBlockBy,
    updateProps,
    renameBlock,
    toggleHidden,
    applyOperations,
    clearCanvas,
    resetCanvas,
  };
}
