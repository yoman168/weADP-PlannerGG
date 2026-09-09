/**
 * Generating a screen as canvas blocks rather than as HTML.
 *
 * The HTML path produces a page nobody can edit. `htmlToBlocks` then tries to
 * recover blocks from that page with a handful of DOM heuristics, and against
 * arbitrary generated markup most of it falls through — which is why a full POS
 * screen arrives on the canvas as a single header block.
 *
 * So this asks for the blocks themselves. What comes back is the canvas's own
 * format, which means the generated screen *is* the canvas: editable block by
 * block, and rendered by the same component that draws every other design in
 * the app.
 *
 * The catch is that the canvas's props are not the shapes a model would guess.
 * `table.rows` is a row *count* and the cells live in `data`; `formGrid.pairs`
 * are `{key, value}`; a button is `{label, variant}`. Guessing wrong produced a
 * screen of empty boxes — a table with headers and no body, fields with no
 * labels, buttons with no text. Two things fix that: the prompt carries each
 * kind's real defaults as JSON so the shape is shown rather than described, and
 * `toBlock` below repairs the mistakes that survive.
 */

import { claudeHeaders } from '@/lib/we-adk/claude-account';
import { readChatEvent } from '@/components/we-adk/claude-chat';
import { BLOCK_CATALOG, type BlockKind, type BlockProps, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';

/**
 * The props a block may carry.
 *
 * Taken from `BlockProps` rather than from a kind's defaults: a default only
 * lists what a *fresh* block starts with, and the props that matter most are
 * exactly the ones missing from it — `table.data` holds a screen's rows and
 * appears in no default at all.
 */
const KNOWN_PROPS = new Set<keyof BlockProps>([
  'label', 'subtitle', 'placeholder', 'helpText', 'value', 'startValue', 'endValue',
  'required', 'checked', 'width', 'height', 'align', 'direction', 'headingLevel',
  'options', 'quickRanges', 'showQuickRanges', 'activeIndex', 'columns', 'rows',
  'data', 'striped', 'dense', 'showHeader', 'showActions', 'buttons', 'pairs',
  'controls', 'tabs', 'badges', 'tone', 'progress',
]);

/** What the model may emit, each kind shown as the props a fresh one carries. */
function catalogSummary(): string {
  return (Object.keys(BLOCK_CATALOG) as BlockKind[])
    .map((kind) => {
      const definition = BLOCK_CATALOG[kind];
      return `${kind} — ${definition.label}\n  ${JSON.stringify(definition.defaults)}`;
    })
    .join('\n');
}

const INSTRUCTION = `You lay out product screens as an ordered list of canvas blocks.

Return ONLY a \`\`\`json code block containing an array. Each entry is:
  { "kind": "<one of the kinds below>", "name": "<short layer name>", "props": { ... } }

Every kind is listed below with the exact props a fresh block carries, as JSON.
That JSON is the schema: match its shape and its types exactly. A prop you omit
keeps the sample value shown, which is generic filler — so fill in every prop
that should carry this screen's own content.

Shapes that are easy to get wrong:
- appShell: the product's frame — its name and left navigation. "label" is the
  PRODUCT's name, short and brand-like (e.g. "StockPOS"), never the title of
  this screen; invent one from the notes if they do not name it. "pairs" is
  [{ "key": "<group heading>", "value": "<nav item>" }], one entry per item,
  with items of the same group listed together; "activeIndex" is the 0-based
  position of the item this screen is, counted across every group. The canvas
  draws this block AROUND the others, so put it first and give exactly one.
- table: "columns" is string[]. The cells go in "data" as string[][], one array
  per row, each aligned to "columns". "rows" is a NUMBER — the count to draw —
  never the cells. Always give "data" 6 to 10 real rows for the screen.
- formGrid: "pairs" is [{ "key": "<field label>", "value": "<a real value>" }].
  Both are required. This draws a filled form, so put real values in, not blanks.
- statCards: "pairs" is [{ "key": "<metric>", "value": "<number>" }].
- buttons (screenHeader, buttonBar): [{ "label": "<text>", "variant":
  "default" | "outline" | "ghost" | "destructive" }]. A button with no label
  renders as an empty box — every button needs one.
- filterBar: "controls" is [{ "type": "search", "placeholder": "..." },
  { "type": "select", "label": "...", "options": ["...", "..."] }].
- tabs: "tabs" is [{ "label": "..." }] with "activeIndex" a number.

Rules:
- Use only the kinds listed. Anything else is dropped.
- Order matters: the array is the screen, top to bottom.
- Start with an appShell naming the product and laying out its sidebar — 5 to
  10 nav items, grouped, with the current screen marked by "activeIndex". The
  notes usually list the product's screens; those are the nav.
- Follow it with a screenHeader carrying the screen's title, a subtitle, and its
  primary actions.
- Build the WHOLE screen, not a sketch of it: 10 to 18 blocks after the shell. A list screen has
  a header, a filter bar, stat cards, a table with real rows, and a button bar.
  A detail screen has a header, a form grid of filled fields, supporting
  sections, and its actions.
- Every label, column name, row value, field value and button caption comes from
  the notes. Use the notes' own product names, currencies, statuses and numbers.
- Write the interface in the language the notes are written in. Names and values
  the notes give in another language stay exactly as the notes wrote them.
- Never emit an empty string, an empty array, or a placeholder like "Item 1"
  where the notes say what it should be.

Available kinds:
`;

/* ------------------------------------------------------------------ */
/* Repair                                                              */
/* ------------------------------------------------------------------ */

/** Narrowing filter, so a map that can bail keeps its element type. */
function present<T>(value: T | null): value is T {
  return value !== null;
}

const text = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

/** An entry's first usable caption, whatever the model chose to call it. */
function captionOf(entry: Record<string, unknown>): string | null {
  for (const key of ['label', 'text', 'title', 'name', 'caption', 'key']) {
    const found = text(entry[key]);
    if (found) return found;
  }
  return null;
}

const VARIANTS = new Set(['default', 'outline', 'ghost', 'destructive', 'secondary', 'link']);

function fixButtons(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;
  const buttons = value
    .map((raw) => {
      // A bare string is a common shorthand, and unambiguous.
      if (typeof raw === 'string') return raw.trim() ? { label: raw.trim() } : null;
      if (typeof raw !== 'object' || raw === null) return null;
      const entry = raw as Record<string, unknown>;
      const label = captionOf(entry);
      // A button with no caption draws as a filled box with nothing in it.
      if (!label) return null;
      const variant = text(entry.variant) ?? text(entry.type);
      return {
        label,
        ...(variant && VARIANTS.has(variant) ? { variant } : {}),
        ...(text(entry.color) ? { color: text(entry.color) } : {}),
      };
    })
    .filter(present);
  return buttons.length > 0 ? buttons : undefined;
}

/** `{key, value}` pairs, from whatever names the model gave the two halves. */
function fixPairs(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;
  const pairs = value
    .map((raw) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const entry = raw as Record<string, unknown>;
      const key = captionOf(entry);
      const pairValue =
        text(entry.value) ?? text(entry.val) ?? text(entry.text) ?? text(entry.placeholder);
      if (!key) return null;
      // A pair with no value still draws its field, just empty — which is right
      // for a form that is genuinely blank, and wrong to throw the label away for.
      return { key, value: pairValue ?? '' };
    })
    .filter(present);
  return pairs.length > 0 ? pairs : undefined;
}

function fixControls(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;
  const controls = value
    .map((raw) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const entry = raw as Record<string, unknown>;
      const type = text(entry.type) ?? 'select';
      if (type === 'search') {
        return { type: 'search', placeholder: text(entry.placeholder) ?? 'Search…' };
      }
      const options = Array.isArray(entry.options)
        ? entry.options.map(text).filter((option): option is string => option !== null)
        : [];
      const label = captionOf(entry);
      if (!label && options.length === 0) return null;
      return {
        type,
        ...(label ? { label } : {}),
        ...(options.length > 0 ? { options } : {}),
      };
    })
    .filter(present);
  return controls.length > 0 ? controls : undefined;
}

function fixTabs(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;
  const tabs = value
    .map((raw) => {
      const label = typeof raw === 'string' ? text(raw) : null;
      if (label) return { label };
      if (typeof raw !== 'object' || raw === null) return null;
      const entry = raw as Record<string, unknown>;
      const caption = captionOf(entry);
      if (!caption) return null;
      return { label: caption, ...(text(entry.badge) ? { badge: text(entry.badge) } : {}) };
    })
    .filter(present);
  return tabs.length > 0 ? tabs : undefined;
}

/** Table cells, aligned to `columns` however the rows were shaped. */
function fixData(value: unknown, columns: string[]): string[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const width = columns.length;
  const rows = value
    .map((raw): string[] | null => {
      if (Array.isArray(raw)) {
        const cells = raw.map((cell) => text(cell) ?? '');
        return cells.some((cell) => cell) ? cells : null;
      }
      // An object row is read in column order, so it lands under the right
      // headers instead of in whatever order the keys happened to come in.
      if (typeof raw === 'object' && raw !== null) {
        const entry = raw as Record<string, unknown>;
        const byColumn = columns.map((column) => {
          const direct = entry[column];
          if (direct !== undefined) return text(direct) ?? '';
          const loose = Object.keys(entry).find(
            (key) => key.toLowerCase().replace(/[\s_]/g, '') === column.toLowerCase().replace(/[\s_]/g, ''),
          );
          return loose ? (text(entry[loose]) ?? '') : '';
        });
        return byColumn.some((cell) => cell) ? byColumn : null;
      }
      return null;
    })
    .filter(present)
    // Ragged rows would slide under the wrong headers.
    .map((row) => (width > 0 ? [...row.slice(0, width), ...Array(Math.max(0, width - row.length)).fill('')] : row));
  return rows.length > 0 ? rows : undefined;
}

/**
 * Merges a generated entry into a real block.
 *
 * Unknown kinds are dropped and unknown props ignored: the model is guessing at
 * a schema, and a canvas that renders a block it does not understand is worse
 * than one that renders fewer. Empty values are dropped too rather than
 * written — a default's sample content reads better than a blank box, and a
 * blank is what an omitted-but-present prop would otherwise produce.
 */
function toBlock(raw: unknown, index: number): CanvasBlock | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as { kind?: unknown; name?: unknown; props?: unknown };
  if (typeof entry.kind !== 'string') return null;
  const kind = entry.kind as BlockKind;
  const definition = BLOCK_CATALOG[kind];
  if (!definition) return null;

  const props: Record<string, unknown> = { ...definition.defaults };
  const given: Record<string, unknown> =
    typeof entry.props === 'object' && entry.props !== null
      ? (entry.props as Record<string, unknown>)
      : {};

  // Columns first: the table's cells are aligned against them.
  const columns = Array.isArray(given.columns)
    ? given.columns.map(text).filter((column): column is string => column !== null)
    : ((definition.defaults as BlockProps).columns ?? []);

  for (const [key, value] of Object.entries(given)) {
    if (!KNOWN_PROPS.has(key as keyof BlockProps)) continue;
    if (value === null || value === undefined) continue;

    let next: unknown = value;
    switch (key) {
      case 'buttons': next = fixButtons(value); break;
      case 'pairs': next = fixPairs(value); break;
      case 'controls': next = fixControls(value); break;
      case 'tabs': next = fixTabs(value); break;
      case 'data': next = fixData(value, columns); break;
      case 'columns': next = columns.length > 0 ? columns : undefined; break;
      case 'rows':
        /*
         * `rows` is the number of rows to draw. Handed an array — the common
         * mistake, since every other list prop is one — it is the cells, and
         * belongs in `data`, where it is aligned and counted.
         */
        if (Array.isArray(value)) {
          const asData = fixData(value, columns);
          if (asData) {
            props.data = asData;
            props.rows = asData.length;
          }
          continue;
        }
        next = typeof value === 'number' ? value : undefined;
        break;
      default:
        if (typeof value === 'string' && !value.trim()) next = undefined;
        else if (Array.isArray(value) && value.length === 0) next = undefined;
    }

    if (next !== undefined) props[key] = next;
  }

  // A table that carries its own rows should draw all of them.
  if (Array.isArray(props.data)) props.rows = (props.data as string[][]).length;

  return {
    id: `gen-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : definition.label,
    hidden: false,
    props: props as BlockProps,
  };
}

/**
 * Generates the blocks for one screen from a brief.
 *
 * Returns an empty array when the model answered without usable JSON — the
 * caller keeps whatever the canvas already had rather than clearing it.
 */
export async function generateScreenBlocks(
  input: { title: string; notes: string; context?: string },
  signal?: AbortSignal,
): Promise<CanvasBlock[]> {
  const response = await fetch('/api/sketcher/chat', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
    body: JSON.stringify({
      message: `${INSTRUCTION}${catalogSummary()}`,
      history: [],
      context: `Screen: ${input.title}\n\nNotes:\n${input.notes}${
        input.context ? `\n\n${input.context}` : ''
      }`,
      folderLabel: `blocks/${input.title}`,
      projectName: input.title,
      model: 'sonnet',
    }),
  });
  if (!response.ok || !response.body) throw new Error('Generation failed');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = readChatEvent(line);
      if (event.kind === 'delta') fullText += event.text;
      else if (event.kind === 'full') fullText = event.text;
    }
  }

  // A fenced block if there is one, otherwise the first bare array in the text.
  const fenced = fullText.match(/```json\s*\n([\s\S]*?)```/);
  const bare = fullText.match(/\[[\s\S]*\]/);
  const payload = fenced?.[1] ?? bare?.[0];
  if (!payload) return [];

  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, index) => toBlock(entry, index))
      .filter((block): block is CanvasBlock => block !== null);
  } catch {
    return [];
  }
}
