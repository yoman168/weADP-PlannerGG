/**
 * Keeping Preview and Design on the same file in step.
 *
 * The two views hold different things: Design is a list of canvas blocks, and
 * Preview is the real screen plus a per-file layout config (which sections
 * show, what the title says, which columns and filters are on). Neither can
 * express everything the other can — you cannot turn a dragged block into a
 * React page — but they overlap on the things a reviewer actually changes:
 *
 *   · whether a section is shown
 *   · the screen title and its breadcrumb
 *   · which table columns there are, and what they are called
 *   · which filters the filter row carries
 *   · which summary cards there are, and what they are called
 *
 * This module translates that overlap in both directions. Sections and blocks
 * are paired by type, in order — a page registers its sections top to bottom,
 * and a design lists its blocks the same way — so no per-screen mapping table
 * has to be maintained.
 */
import {
  type ColumnConfig,
  type SectionConfig,
  type SectionType,
  type SiteConfig,
} from '@/components/eacc/edit-context';
import {
  type BlockKind,
  type CanvasBlock,
  type FilterControl,
  type PairEntry,
} from '@/lib/we-adk-mock/sketcher';
import { workspaceStore } from '@/lib/api/workspace-store';

/** Which kind of section a block stands for, when it stands for one at all. */
const BLOCK_SECTION_TYPE: Partial<Record<BlockKind, SectionType>> = {
  screenHeader: 'header',
  filterBar: 'filters',
  table: 'table',
  statCards: 'stats',
  keyValue: 'list',
  formGrid: 'list',
  taskList: 'list',
  metricBars: 'list',
  timeline: 'list',
  fileList: 'list',
  toggleList: 'list',
};

interface Pairing {
  block: CanvasBlock;
  blockIndex: number;
  sectionId: string;
  section: SectionConfig;
}

function normalise(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Pairs each block with the section it stands for: same type, same order.
 * A block with no matching section (a spare paragraph, say) is left out, and
 * so is a section with no block.
 */
export function pairSections(blocks: CanvasBlock[], config: SiteConfig): Pairing[] {
  const sections = Object.entries(config);
  const taken = new Set<string>();
  const pairs: Pairing[] = [];

  blocks.forEach((block, blockIndex) => {
    const wanted = BLOCK_SECTION_TYPE[block.kind];
    if (!wanted) return;
    const hit = sections.find(([id, section]) => !taken.has(id) && section.sectionType === wanted);
    if (!hit) return;
    taken.add(hit[0]);
    pairs.push({ block, blockIndex, sectionId: hit[0], section: hit[1] });
  });

  return pairs;
}

/**
 * Lines up the items inside a section — columns, filters, cards — with what the
 * canvas shows for them. Exact label matches first; anything still unmatched is
 * assigned in order, so renaming an item keeps it paired instead of reading as
 * "removed, and a different one added".
 */
function matchItems(sectionLabels: string[], canvasLabels: string[]): (number | null)[] {
  const result: (number | null)[] = sectionLabels.map(() => null);
  const used = new Set<number>();

  sectionLabels.forEach((label, index) => {
    const hit = canvasLabels.findIndex(
      (candidate, candidateIndex) =>
        !used.has(candidateIndex) && normalise(candidate) === normalise(label),
    );
    if (hit !== -1) {
      result[index] = hit;
      used.add(hit);
    }
  });

  const spareSections = result.flatMap((hit, index) => (hit === null ? [index] : []));
  const spareCanvas = canvasLabels.flatMap((_, index) => (used.has(index) ? [] : [index]));
  if (spareSections.length > 0 && spareSections.length === spareCanvas.length) {
    // Same count either side: treat them as renames rather than deletions.
    spareSections.forEach((sectionIndex, offset) => {
      const canvasIndex = spareCanvas[offset];
      if (canvasIndex !== undefined) result[sectionIndex] = canvasIndex;
    });
  }

  return result;
}

/** What a filter control reads as, for matching against a section's filters. */
function controlLabel(control: FilterControl): string {
  return control.label ?? control.placeholder ?? control.options?.[0] ?? control.type;
}

/**
 * A filter is often labelled one way in the page config ("Date Range") and
 * another on the canvas ("2026-07-01 ~ 2026-07-31"), so fall back to the kind
 * of control it is.
 */
function filterMatchesControl(filterKey: string, filterLabel: string, control: FilterControl) {
  const key = normalise(filterKey);
  const label = normalise(filterLabel);
  const text = normalise(controlLabel(control));
  if (text && (text.includes(label) || label.includes(text))) return true;
  if (control.type === 'search') return key.includes('search');
  if (control.type === 'dateRange') return key.includes('date');
  if (control.type === 'checkbox') return key.includes('skip') || key.includes('scope');
  return false;
}

/* ------------------------------------------------------------------ */
/* Design → Preview                                                    */
/* ------------------------------------------------------------------ */

/** The layout config a canvas implies, merged onto what the screen has now. */
export function canvasToConfig(blocks: CanvasBlock[], config: SiteConfig): SiteConfig {
  const next: SiteConfig = { ...config };

  for (const { block, sectionId, section } of pairSections(blocks, config)) {
    const patch: SectionConfig = { ...section, visible: !block.hidden };

    if (section.sectionType === 'header') {
      if (typeof block.props.label === 'string') patch.title = block.props.label;
      if (typeof block.props.subtitle === 'string') patch.subtitle = block.props.subtitle;
    }

    if (section.sectionType === 'table' && section.columns) {
      const canvasLabels = block.props.columns ?? [];
      const matches = matchItems(
        section.columns.map((column) => column.label),
        canvasLabels,
      );
      patch.columns = section.columns.map((column, index): ColumnConfig => {
        const hit = matches[index];
        return hit === null || hit === undefined
          ? { ...column, visible: false }
          : { ...column, visible: true, label: canvasLabels[hit] ?? column.label };
      });
    }

    if (section.sectionType === 'filters' && section.filters) {
      const controls = block.props.controls ?? [];
      patch.filters = section.filters.map((filter) => ({
        ...filter,
        visible: controls.some((control) =>
          filterMatchesControl(filter.key, filter.label, control),
        ),
      }));
    }

    if (section.sectionType === 'stats' && section.cards) {
      const pairs = block.props.pairs ?? [];
      const matches = matchItems(
        section.cards.map((card) => card.label),
        pairs.map((pair) => pair.key),
      );
      patch.cards = section.cards.map((card, index) => {
        const hit = matches[index];
        return hit === null || hit === undefined
          ? { ...card, visible: false }
          : { ...card, visible: true, label: pairs[hit]?.key ?? card.label };
      });
    }

    next[sectionId] = patch;
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* Preview → Design                                                    */
/* ------------------------------------------------------------------ */

/**
 * The canvas a layout config implies. `seed` is the file's shipped design — it
 * is where the data for a column that has just been switched back on comes
 * from, since the canvas dropped those cells when it was switched off.
 */
export function configToCanvas(
  blocks: CanvasBlock[],
  config: SiteConfig,
  seed: CanvasBlock[] = [],
): CanvasBlock[] {
  const pairs = pairSections(blocks, config);
  if (pairs.length === 0) return blocks;

  const next = [...blocks];

  for (const { block, blockIndex, section } of pairs) {
    const seedBlock = seed[blockIndex]?.kind === block.kind ? seed[blockIndex] : undefined;
    const props = { ...block.props };
    let changed = false;

    const hidden = section.visible === false;
    if (hidden !== block.hidden) changed = true;

    if (section.sectionType === 'header') {
      if (section.title !== undefined && section.title !== props.label) {
        props.label = section.title;
        changed = true;
      }
      if (section.subtitle !== undefined && section.subtitle !== props.subtitle) {
        props.subtitle = section.subtitle;
        changed = true;
      }
    }

    if (section.sectionType === 'table' && section.columns) {
      const canvasLabels = props.columns ?? [];
      const matches = matchItems(
        section.columns.map((column) => column.label),
        canvasLabels,
      );
      const seedLabels = seedBlock?.props.columns ?? [];
      const seedData = seedBlock?.props.data ?? [];
      const rows = props.data ?? [];

      const keep = section.columns.flatMap((column, index) => {
        if (column.visible === false) return [];
        const hit = matches[index];
        return [
          {
            label: column.label,
            // Where this column's cells come from: the canvas if it is still
            // there, otherwise the file's shipped design.
            from: hit === null || hit === undefined ? ('seed' as const) : ('canvas' as const),
            canvasIndex: hit ?? -1,
            seedIndex: seedLabels.findIndex(
              (label) => normalise(label) === normalise(column.label),
            ),
          },
        ];
      });

      const nextColumns = keep.map((entry) => entry.label);
      const nextRows = rows.map((row, rowIndex) =>
        keep.map((entry) =>
          entry.from === 'canvas'
            ? (row[entry.canvasIndex] ?? '')
            : (seedData[rowIndex]?.[entry.seedIndex] ?? ''),
        ),
      );

      if (JSON.stringify(nextColumns) !== JSON.stringify(canvasLabels)) {
        props.columns = nextColumns;
        props.data = rows.length > 0 ? nextRows : undefined;
        changed = true;
      }
    }

    if (section.sectionType === 'filters' && section.filters) {
      const controls = props.controls ?? [];
      const seedControls = seedBlock?.props.controls ?? [];
      const wanted = section.filters.filter((filter) => filter.visible !== false);
      const nextControls = wanted.flatMap((filter) => {
        const existing = controls.find((control) =>
          filterMatchesControl(filter.key, filter.label, control),
        );
        if (existing) return [existing];
        const fromSeed = seedControls.find((control) =>
          filterMatchesControl(filter.key, filter.label, control),
        );
        return fromSeed ? [fromSeed] : [];
      });
      if (JSON.stringify(nextControls) !== JSON.stringify(controls)) {
        props.controls = nextControls;
        changed = true;
      }
    }

    if (section.sectionType === 'stats' && section.cards) {
      const pairsNow = props.pairs ?? [];
      const seedPairs = seedBlock?.props.pairs ?? [];
      const matches = matchItems(
        section.cards.map((card) => card.label),
        pairsNow.map((pair) => pair.key),
      );
      const nextPairs = section.cards.flatMap((card, index): PairEntry[] => {
        if (card.visible === false) return [];
        const hit = matches[index];
        const existing = hit === null || hit === undefined ? undefined : pairsNow[hit];
        const fromSeed = seedPairs.find((pair) => normalise(pair.key) === normalise(card.label));
        const base = existing ?? fromSeed;
        return base ? [{ ...base, key: card.label }] : [];
      });
      if (JSON.stringify(nextPairs) !== JSON.stringify(pairsNow)) {
        props.pairs = nextPairs;
        changed = true;
      }
    }

    if (changed) next[blockIndex] = { ...block, hidden, props };
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function readJson<T>(key: string): T | null {
  try {
    const raw = workspaceStore.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    workspaceStore.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — the other view simply will not see this edit.
  }
}

/**
 * Design → Preview. Called when a prototype file's canvas is saved: the layout
 * the blocks describe is written where the screen reads it from.
 */
export function pushCanvasToScreen(configKey: string, blocks: CanvasBlock[]): void {
  const config = readJson<SiteConfig>(configKey);
  // Nothing registered yet means the screen has never been opened; it will
  // register its defaults on first render, and the canvas will win next save.
  if (!config) return;
  writeJson(configKey, canvasToConfig(blocks, config));
}

/**
 * Preview → Design. Called when the screen's layout changes: the canvas for
 * that file is brought in line, so opening Design shows the same thing.
 */
export function pushScreenToCanvas(
  canvasKey: string,
  config: SiteConfig,
  seed: CanvasBlock[],
): void {
  const blocks = readJson<CanvasBlock[]>(canvasKey) ?? seed;
  if (blocks.length === 0) return;
  writeJson(canvasKey, configToCanvas(blocks, config, seed));
}
