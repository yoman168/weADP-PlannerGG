/**
 * What changed between two versions of one screen.
 *
 * A design is an ordered list of blocks plus, for an html screen, the section
 * layout Edit UI writes. This turns two of those into the rows a diff shows:
 * blocks added, blocks removed, blocks whose props moved, and the untouched
 * ones in between as context.
 *
 * Blocks are matched on kind + name rather than on id, because a copy
 * regenerates every id — matching on ids would call the whole screen new. The
 * sequence is aligned with a longest-common-subsequence pass so an insert in
 * the middle reads as one added row rather than as everything below it moving.
 */
import { type CanvasBlock } from '@/lib/we-adk-mock/sketcher';

export type DiffKind = 'added' | 'removed' | 'changed' | 'same';

/** One prop of a block that differs, as text a reader can compare. */
export interface PropChange {
  key: string;
  before: string;
  after: string;
}

export interface BlockDiffRow {
  kind: DiffKind;
  /** The block as it is after the change — or as it was, for a removal. */
  block: CanvasBlock;
  /**
   * The block as it was before, for `changed`. Nothing renders it now that the
   * side-by-side view is gone — it is kept because a block diff that only knows
   * the after state cannot be shown later without recomputing everything.
   */
  previous?: CanvasBlock;
  /** Set for `changed`. */
  props?: PropChange[];
}

export interface LayoutDiffRow {
  kind: DiffKind;
  /** The section id, e.g. `approvals-table`. */
  id: string;
}

export interface DesignDiff {
  blocks: BlockDiffRow[];
  layout: LayoutDiffRow[];
  added: number;
  removed: number;
  changed: number;
}

/* ------------------------------------------------------------------ */
/* Comparing values                                                    */
/* ------------------------------------------------------------------ */

/** Object keys in a fixed order, so equal values compare equal. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function show(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(canonical(value)) ?? '—';
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Which props of a matched pair differ, in a stable order.
 *
 * Both sides are read through a defaulted object rather than off the block.
 * `CanvasBlock` says `props` is always there, but blocks are parsed out of
 * workspace state and `isCanvasBlockArray` only checks `id` and `kind` — so a block
 * saved by an older build can arrive without props, and indexing it directly
 * throws while the diff is being built.
 */
function propChanges(before: CanvasBlock, after: CanvasBlock): PropChange[] {
  const beforeProps = (before.props ?? {}) as Record<string, unknown>;
  const afterProps = (after.props ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)])].sort();
  const changes: PropChange[] = [];
  for (const key of keys) {
    const a = beforeProps[key];
    const b = afterProps[key];
    if (!same(a, b)) changes.push({ key, before: show(a), after: show(b) });
  }
  // Hiding a block is a change worth seeing, and it does not live in props.
  if ((before.hidden ?? false) !== (after.hidden ?? false)) {
    changes.push({
      key: 'hidden',
      before: String(before.hidden ?? false),
      after: String(after.hidden ?? false),
    });
  }
  return changes;
}

/* ------------------------------------------------------------------ */
/* Aligning the two sequences                                          */
/* ------------------------------------------------------------------ */

/**
 * What identifies "the same block" across two copies of a screen.
 *
 * `name` is as unvalidated as `props` — see propChanges — so an unnamed block
 * falls back to matching on kind alone.
 */
function blockKey(block: CanvasBlock): string {
  return `${block.kind} ${block.name ?? ''}`;
}

/**
 * Longest common subsequence of the two key sequences.
 *
 * Quadratic, which is fine: a screen is tens of blocks, not thousands.
 */
function lcs(before: string[], after: string[]): number[][] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        before[i] === after[j]
          ? (table[i + 1]![j + 1] ?? 0) + 1
          : Math.max(table[i + 1]![j] ?? 0, table[i]![j + 1] ?? 0);
    }
  }
  return table;
}

/** Block-level diff, in reading order. */
export function diffBlocks(before: CanvasBlock[], after: CanvasBlock[]): BlockDiffRow[] {
  const beforeKeys = before.map(blockKey);
  const afterKeys = after.map(blockKey);
  const table = lcs(beforeKeys, afterKeys);

  const rows: BlockDiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (beforeKeys[i] === afterKeys[j]) {
      const from = before[i]!;
      const to = after[j]!;
      const props = propChanges(from, to);
      rows.push(
        props.length > 0
          ? { kind: 'changed', block: to, previous: from, props }
          : { kind: 'same', block: to },
      );
      i += 1;
      j += 1;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      rows.push({ kind: 'removed', block: before[i]! });
      i += 1;
    } else {
      rows.push({ kind: 'added', block: after[j]! });
      j += 1;
    }
  }
  while (i < before.length) {
    rows.push({ kind: 'removed', block: before[i]! });
    i += 1;
  }
  while (j < after.length) {
    rows.push({ kind: 'added', block: after[j]! });
    j += 1;
  }

  return rows;
}

/** Section-layout diff, for an html screen where Edit UI is the real editor. */
export function diffLayout(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): LayoutDiffRow[] {
  const a = before ?? {};
  const b = after ?? {};
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const rows: LayoutDiffRow[] = [];
  for (const id of ids) {
    if (!(id in a)) rows.push({ kind: 'added', id });
    else if (!(id in b)) rows.push({ kind: 'removed', id });
    else if (!same(a[id], b[id])) rows.push({ kind: 'changed', id });
  }
  return rows;
}

/** The whole comparison, with the counts a summary line needs. */
export function designDiff(
  before: { blocks: CanvasBlock[]; layout: Record<string, unknown> | null },
  after: { blocks: CanvasBlock[]; layout: Record<string, unknown> | null },
): DesignDiff {
  const blocks = diffBlocks(before.blocks, after.blocks);
  const layout = diffLayout(before.layout, after.layout);
  const counted = [...blocks, ...layout];
  return {
    blocks,
    layout,
    added: counted.filter((row) => row.kind === 'added').length,
    removed: counted.filter((row) => row.kind === 'removed').length,
    changed: counted.filter((row) => row.kind === 'changed').length,
  };
}
