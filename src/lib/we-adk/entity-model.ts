/**
 * Entity-relation diagrams, written as a model rather than drawn as shapes.
 *
 * The palette this replaces offered a table shape, an entity oval, a relationship
 * diamond and a dozen connector ends to assemble by hand. Assembling them is the
 * part that goes wrong: boxes drift out of line, a field is added to one table and
 * not its twin, and the crow's feet end up pointing whichever way the mouse went.
 * Declaring the model instead means the picture cannot disagree with itself —
 * every entity is drawn the same way, and cardinality is read off the text.
 *
 *   entity Bill
 *     id: uuid pk
 *     supplier_id: uuid fk
 *     remaining: decimal
 *
 *   entity Supplier
 *     id: uuid pk
 *     name: text
 *
 *   Bill *--1 Supplier : billed to
 *
 * Cardinality is the standard set — `1`, `*`, `0..1`, `0..*`, `1..*` — drawn as
 * bars, circles and crow's feet at the end that carries them.
 */
import { type DiagramDirection, type DiagramIssue } from '@/lib/we-adk/diagram-source';

export interface EntityField {
  name: string;
  type?: string;
  /** Primary key: shown as PK, and the row is emphasised. */
  pk?: boolean;
  /** Foreign key: shown as FK. */
  fk?: boolean;
  unique?: boolean;
  /** `null` in the source — the field is optional. */
  optional?: boolean;
}

export interface Entity {
  /** Case-folded name, so `Bill` and `bill` are the same table. */
  id: string;
  name: string;
  fields: EntityField[];
}

export type Cardinality = 'one' | 'many' | 'zero-one' | 'zero-many' | 'one-many' | 'none';

export interface Relationship {
  from: string;
  to: string;
  fromCard: Cardinality;
  toCard: Cardinality;
  label?: string;
}

export interface EntityModel {
  direction: DiagramDirection;
  entities: Entity[];
  relationships: Relationship[];
  issues: DiagramIssue[];
}

const CARDINALITIES: Record<string, Cardinality> = {
  '1': 'one',
  '*': 'many',
  n: 'many',
  many: 'many',
  '0..1': 'zero-one',
  '?': 'zero-one',
  '0..*': 'zero-many',
  '0..n': 'zero-many',
  '1..*': 'one-many',
  '1..n': 'one-many',
};

const MAX_TEXT = 40;

/** `Bill *--1 Supplier : billed to`, or `Bill -- Supplier` with no ends. */
const RELATION = /^(.+?)\s+([\w*?.]*)--([\w*?.]*)\s+([^:]+?)(?:\s*:\s*(.*))?$/;
const ENTITY = /^(?:entity|table)\s+(.+?)\s*\{?$/i;
const FIELD = /^(?:[-*+]\s*)?([\w .]+?)\s*(?::\s*(.*))?$/;

export function parseEntityModel(source: string): EntityModel {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const issues: DiagramIssue[] = [];
  let direction: DiagramDirection = 'down';
  /** The entity a field line belongs to — an indented line continues the last one. */
  let open: Entity | null = null;

  const find = (name: string): Entity | undefined =>
    entities.find((entity) => entity.id === name.trim().toLowerCase());

  source.split('\n').forEach((rawLine, index) => {
    const line = index + 1;
    const text = rawLine.trim();
    if (text.length === 0) {
      // A blank line ends a block, which is how the eye reads it too.
      open = null;
      return;
    }
    if (text.startsWith('#')) return;
    if (text === '}') {
      open = null;
      return;
    }

    const directive = /^direction\s*[:=]?\s*(.+)$/i.exec(text);
    if (directive) {
      const value = directive[1]!.trim().toLowerCase();
      if (['right', 'lr', 'across'].includes(value)) direction = 'right';
      else if (['down', 'tb', 'td'].includes(value)) direction = 'down';
      else issues.push({ line, message: `Unknown direction "${value}" — use down or right.` });
      return;
    }

    const entity = ENTITY.exec(text);
    if (entity) {
      const name = entity[1]!.trim().slice(0, MAX_TEXT);
      const existing = find(name);
      if (existing) {
        open = existing;
      } else {
        const created: Entity = { id: name.toLowerCase(), name, fields: [] };
        entities.push(created);
        open = created;
      }
      return;
    }

    const relation = RELATION.exec(text);
    if (relation) {
      const [, left, leftCard, rightCard, right, label] = relation;
      const from = find(left!) ?? register(entities, left!);
      const to = find(right!) ?? register(entities, right!);
      const fromCard = cardinalityOf(leftCard!, line, issues);
      const toCard = cardinalityOf(rightCard!, line, issues);
      if (from.id === to.id) {
        issues.push({ line, message: 'A table related to itself is not drawn.' });
        return;
      }
      relationships.push({
        from: from.id,
        to: to.id,
        fromCard,
        toCard,
        ...(label?.trim() ? { label: label.trim().slice(0, MAX_TEXT) } : {}),
      });
      open = null;
      return;
    }

    // Anything else inside a block is a field. Outside one it is a stray line, and
    // saying so is better than inventing a table for it.
    if (!open) {
      issues.push({ line, message: `"${text.slice(0, 24)}" is not inside an entity.` });
      return;
    }
    const field = FIELD.exec(text);
    if (!field) {
      issues.push({ line, message: 'Expected a field, like `id: uuid pk`.' });
      return;
    }
    const words = (field[2] ?? '').trim().split(/\s+/).filter(Boolean);
    const flags = new Set(words.map((word) => word.toLowerCase()));
    const type = words.filter((word) => !isFlag(word)).join(' ');
    open.fields.push({
      name: field[1]!.trim().slice(0, MAX_TEXT),
      ...(type ? { type: type.slice(0, MAX_TEXT) } : {}),
      ...(flags.has('pk') ? { pk: true } : {}),
      ...(flags.has('fk') ? { fk: true } : {}),
      ...(flags.has('unique') ? { unique: true } : {}),
      ...(flags.has('null') || flags.has('optional') ? { optional: true } : {}),
    });
  });

  return { direction, entities, relationships, issues };
}

const FLAGS = new Set(['pk', 'fk', 'unique', 'null', 'optional']);

function isFlag(word: string): boolean {
  return FLAGS.has(word.toLowerCase());
}

/** A relationship may name a table before it is declared, or instead of it. */
function register(entities: Entity[], name: string): Entity {
  const trimmed = name.trim().slice(0, MAX_TEXT);
  const created: Entity = { id: trimmed.toLowerCase(), name: trimmed, fields: [] };
  entities.push(created);
  return created;
}

function cardinalityOf(token: string, line: number, issues: DiagramIssue[]): Cardinality {
  if (token.length === 0) return 'none';
  const found = CARDINALITIES[token.toLowerCase()];
  if (found) return found;
  issues.push({ line, message: `Unknown cardinality "${token}" — use 1, *, 0..1, 0..* or 1..*.` });
  return 'none';
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * Which edges close a loop, by index.
 *
 * Depth-first: an edge pointing at something still open on the current path is
 * what closes the cycle. Iterative rather than recursive so a long chain cannot
 * overflow the stack, and every node is tried as a start so a loop that nothing
 * points into is still reached.
 */
function backEdges<T extends { from: string; to: string }>(ids: string[], edges: T[]): Set<number> {
  const outgoing = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), index]);
  });

  const state = new Map<string, 'open' | 'done'>();
  const back = new Set<number>();

  for (const root of ids) {
    if (state.has(root)) continue;
    state.set(root, 'open');
    const stack: { id: string; next: number }[] = [{ id: root, next: 0 }];
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const list = outgoing.get(top.id) ?? [];
      if (top.next >= list.length) {
        state.set(top.id, 'done');
        stack.pop();
        continue;
      }
      const index = list[top.next]!;
      top.next += 1;
      const target = edges[index]!.to;
      const seen = state.get(target);
      if (seen === 'open')
        back.add(index); // still on this path, so it loops
      else if (seen === undefined) {
        state.set(target, 'open');
        stack.push({ id: target, next: 0 });
      }
    }
  }

  return back;
}

/**
 * Nodes grouped into layers, deepest-parent-first, loops excluded.
 *
 * Lived beside the flow diagram until that went; this is its only caller now, so
 * it moved here rather than leaving a module behind to hold it. Two tables
 * referring to each other is an ordinary loop, and a loop must not decide the
 * layering — relaxing over a cycle deepens its target on every pass, so the layers
 * run away and the drawing comes out sized NaN.
 */
function layerByDepth<T extends { from: string; to: string }>(
  ids: string[],
  edges: T[],
): string[][] {
  const back = backEdges(ids, edges);
  const forward = edges.filter((_, index) => !back.has(index));

  const depth = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass += 1) {
    let changed = false;
    for (const edge of forward) {
      const next = (depth.get(edge.from) ?? 0) + 1;
      if (next > (depth.get(edge.to) ?? 0)) {
        depth.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Grouped by depth, then compacted: a gap in the depths would otherwise become
  // an empty band across the drawing.
  const grouped = new Map<number, string[]>();
  for (const id of ids) {
    const index = depth.get(id) ?? 0;
    grouped.set(index, [...(grouped.get(index) ?? []), id]);
  }
  return [...grouped.keys()].sort((a, b) => a - b).map((key) => grouped.get(key)!);
}

export interface EntityBox {
  entity: Entity;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Left-hand text per row, badge included, in field order. */
  rows: { left: string; right: string; emphasis: boolean }[];
}

export interface LaidRelationship {
  relationship: Relationship;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
}

export interface EntityLayout {
  width: number;
  height: number;
  boxes: EntityBox[];
  relationships: LaidRelationship[];
}

export const HEADER_HEIGHT = 30;
export const ROW_HEIGHT = 24;
const PAD_X = 12;
const PAD_BOTTOM = 6;
// Wide enough for a name and a type without either being squeezed: at 130 a field
// called `supplier_id` filled the row edge to edge, and on the canvas the editable
// name box was left with almost nothing.
const MIN_WIDTH = 190;
const MAX_WIDTH = 320;
const GAP_ALONG = 84;
const GAP_ACROSS = 36;
const MARGIN = 24;
const LABEL_PAD = 4;
const LABEL_HALF_HEIGHT = 9;

function badgeOf(field: EntityField): string {
  if (field.pk) return 'PK';
  if (field.fk) return 'FK';
  if (field.unique) return 'U';
  return '';
}

/**
 * Boxes and connector geometry.
 *
 * `measure` takes the weight because an entity's name is drawn bold and its
 * fields are not — measuring both with one font makes every box slightly too
 * narrow for its own title.
 */
export function layoutEntityModel(
  model: EntityModel,
  measure: (text: string, bold?: boolean) => number,
  /**
   * Where the tables have been dragged to. A table with a position is placed
   * there; one without keeps its layered slot, so a table just added still lands
   * somewhere sensible rather than at the origin.
   */
  positions?: EntityPositions,
): EntityLayout {
  const { entities, relationships, direction } = model;
  if (entities.length === 0) return { width: 0, height: 0, boxes: [], relationships: [] };

  const shaped = entities.map((entity) => {
    const rows = entity.fields.map((field) => ({
      left: `${badgeOf(field) ? `${badgeOf(field)} ` : ''}${field.name}`,
      right: `${field.type ?? ''}${field.optional ? '?' : ''}`,
      emphasis: field.pk === true,
    }));
    const widest = rows.reduce(
      (most, row) => Math.max(most, measure(row.left) + 16 + measure(row.right)),
      measure(entity.name, true),
    );
    return {
      entity,
      rows,
      width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widest + PAD_X * 2)),
      height: HEADER_HEIGHT + rows.length * ROW_HEIGHT + (rows.length > 0 ? PAD_BOTTOM : 0),
    };
  });
  const shapeOf = new Map(shaped.map((shape) => [shape.entity.id, shape]));

  const layers = layerByDepth(
    entities.map((entity) => entity.id),
    relationships,
  ).map((layer) => layer.map((id) => shapeOf.get(id)!));

  // Boxes vary in size here, unlike the flow diagram's uniform ones, so each
  // layer is centred on its own span and advances by its own depth.
  const spans = layers.map((layer) =>
    layer.reduce(
      (total, shape, index) =>
        total + (direction === 'down' ? shape.width : shape.height) + (index > 0 ? GAP_ACROSS : 0),
      0,
    ),
  );
  const widestSpan = Math.max(...spans);

  const boxes: EntityBox[] = [];
  const boxOf = new Map<string, EntityBox>();
  let along = MARGIN;
  layers.forEach((layer, layerIndex) => {
    let across = MARGIN + (widestSpan - (spans[layerIndex] ?? 0)) / 2;
    for (const shape of layer) {
      const box: EntityBox =
        direction === 'down'
          ? {
              entity: shape.entity,
              rows: shape.rows,
              x: across,
              y: along,
              width: shape.width,
              height: shape.height,
            }
          : {
              entity: shape.entity,
              rows: shape.rows,
              x: along,
              y: across,
              width: shape.width,
              height: shape.height,
            };
      const placed = positions?.[shape.entity.id];
      if (placed) {
        box.x = placed.x;
        box.y = placed.y;
      }
      boxes.push(box);
      boxOf.set(shape.entity.id, box);
      across += (direction === 'down' ? shape.width : shape.height) + GAP_ACROSS;
    }
    along +=
      Math.max(...layer.map((shape) => (direction === 'down' ? shape.height : shape.width))) +
      GAP_ALONG;
  });

  const laid: LaidRelationship[] = [];
  for (const relationship of relationships) {
    const from = boxOf.get(relationship.from);
    const to = boxOf.get(relationship.to);
    if (!from || !to) continue;
    // Centre to centre, clipped to each box: with boxes of different sizes, fixed
    // top/bottom anchors would leave connectors starting in mid-air.
    const fromCentre = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const toCentre = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    const start = clipToBox(fromCentre, toCentre, from);
    const end = clipToBox(toCentre, fromCentre, to);
    const labelWidth = relationship.label ? measure(relationship.label) : 0;
    laid.push({
      relationship,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      labelX: (start.x + end.x) / 2,
      labelY: (start.y + end.y) / 2,
      labelWidth,
    });
  }

  // Labels sit on the line, so nudge any that landed on a box.
  for (const line of laid) {
    if (!line.relationship.label) continue;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const hit = boxes.find(
        (box) =>
          line.labelX - line.labelWidth / 2 - LABEL_PAD < box.x + box.width + 2 &&
          line.labelX + line.labelWidth / 2 + LABEL_PAD > box.x - 2 &&
          line.labelY - LABEL_HALF_HEIGHT < box.y + box.height + 2 &&
          line.labelY + LABEL_HALF_HEIGHT > box.y - 2,
      );
      if (!hit) break;
      line.labelX += line.labelX >= hit.x + hit.width / 2 ? 12 : -12;
    }
  }

  const lefts = [
    ...boxes.map((box) => box.x),
    ...laid.filter((l) => l.relationship.label).map((l) => l.labelX - l.labelWidth / 2 - LABEL_PAD),
  ];
  const tops = [
    ...boxes.map((box) => box.y),
    ...laid.filter((l) => l.relationship.label).map((l) => l.labelY - LABEL_HALF_HEIGHT),
  ];
  const shiftX = Math.max(0, MARGIN - Math.min(...lefts));
  const shiftY = Math.max(0, MARGIN - Math.min(...tops));
  if (shiftX > 0 || shiftY > 0) {
    for (const box of boxes) {
      box.x += shiftX;
      box.y += shiftY;
    }
    for (const line of laid) {
      line.x1 += shiftX;
      line.x2 += shiftX;
      line.labelX += shiftX;
      line.y1 += shiftY;
      line.y2 += shiftY;
      line.labelY += shiftY;
    }
  }

  const width =
    Math.max(
      ...boxes.map((box) => box.x + box.width),
      ...laid
        .filter((l) => l.relationship.label)
        .map((l) => l.labelX + l.labelWidth / 2 + LABEL_PAD),
    ) + MARGIN;
  const height =
    Math.max(
      ...boxes.map((box) => box.y + box.height),
      ...laid.filter((l) => l.relationship.label).map((l) => l.labelY + LABEL_HALF_HEIGHT),
    ) + MARGIN;
  return { width, height, boxes, relationships: laid };
}

/** Where the line from `inside` towards `towards` leaves the box. */
function clipToBox(
  inside: { x: number; y: number },
  towards: { x: number; y: number },
  box: EntityBox,
): { x: number; y: number } {
  const dx = towards.x - inside.x;
  const dy = towards.y - inside.y;
  if (dx === 0 && dy === 0) return inside;
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  // How far along the ray each pair of edges is crossed; the nearer one wins.
  const scaleX = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: inside.x + dx * scale, y: inside.y + dy * scale };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

export const ENTITY_FONT = '12px ui-sans-serif, system-ui, -apple-system, sans-serif';
export const ENTITY_FONT_BOLD = '600 13px ui-sans-serif, system-ui, -apple-system, sans-serif';
const PAPER = '#ffffff';
const HEADER_FILL = '#eef2f7';
const BOX_FILL = '#ffffff';
const BOX_LINE = '#94a3b8';
const TEXT = '#0f172a';
const MUTED = '#64748b';
const LINE = '#64748b';

function boxPath(ctx: CanvasRenderingContext2D, box: EntityBox, radius = 6): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function')
    ctx.roundRect(box.x, box.y, box.width, box.height, radius);
  else ctx.rect(box.x, box.y, box.width, box.height);
}

/**
 * The end markers: a bar for one, a crow's foot for many, a circle for zero.
 *
 * `angle` runs along the connector towards the box, so every marker is built from
 * the same two directions and cannot end up pointing the wrong way — which is the
 * mistake hand-placed connector ends make.
 */
function endMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  card: Cardinality,
): void {
  if (card === 'none') return;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Perpendicular, for the width of a bar or the spread of a foot.
  const px = -sin;
  const py = cos;
  const at = (distance: number) => ({ x: x - cos * distance, y: y - sin * distance });

  const bar = (distance: number) => {
    const point = at(distance);
    ctx.beginPath();
    ctx.moveTo(point.x + px * 5, point.y + py * 5);
    ctx.lineTo(point.x - px * 5, point.y - py * 5);
    ctx.stroke();
  };
  const circle = (distance: number) => {
    const point = at(distance);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.stroke();
  };
  const foot = () => {
    const back = at(9);
    ctx.beginPath();
    ctx.moveTo(back.x + px * 5, back.y + py * 5);
    ctx.lineTo(x, y);
    ctx.lineTo(back.x - px * 5, back.y - py * 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(back.x, back.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.4;
  if (card === 'one') bar(6);
  else if (card === 'many') foot();
  else if (card === 'zero-one') {
    bar(6);
    circle(13);
  } else if (card === 'zero-many') {
    foot();
    circle(14);
  } else if (card === 'one-many') {
    foot();
    bar(13);
  }
}

export function drawEntityModel(ctx: CanvasRenderingContext2D, layout: EntityLayout): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, Math.max(layout.width, 1), Math.max(layout.height, 1));
  ctx.textBaseline = 'middle';

  // Connectors first, boxes over them, then the ends and labels — the same order
  // the flow diagram uses, and for the same reason.
  for (const line of layout.relationships) {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }

  for (const box of layout.boxes) {
    boxPath(ctx, box);
    ctx.fillStyle = BOX_FILL;
    ctx.fill();
    ctx.strokeStyle = BOX_LINE;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header band, clipped to the box so its corners stay round.
    ctx.save();
    boxPath(ctx, box);
    ctx.clip();
    ctx.fillStyle = HEADER_FILL;
    ctx.fillRect(box.x, box.y, box.width, HEADER_HEIGHT);
    ctx.restore();
    ctx.strokeStyle = BOX_LINE;
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + HEADER_HEIGHT);
    ctx.lineTo(box.x + box.width, box.y + HEADER_HEIGHT);
    ctx.stroke();

    ctx.font = ENTITY_FONT_BOLD;
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'left';
    ctx.fillText(box.entity.name, box.x + PAD_X, box.y + HEADER_HEIGHT / 2 + 0.5);

    box.rows.forEach((row, index) => {
      const y = box.y + HEADER_HEIGHT + ROW_HEIGHT * index + ROW_HEIGHT / 2;
      ctx.font = row.emphasis ? ENTITY_FONT_BOLD : ENTITY_FONT;
      ctx.fillStyle = row.emphasis ? TEXT : MUTED;
      ctx.textAlign = 'left';
      ctx.fillText(row.left, box.x + PAD_X, y);
      if (row.right) {
        ctx.font = ENTITY_FONT;
        ctx.fillStyle = MUTED;
        ctx.textAlign = 'right';
        ctx.fillText(row.right, box.x + box.width - PAD_X, y);
      }
    });
  }

  for (const line of layout.relationships) {
    const angle = Math.atan2(line.y1 - line.y2, line.x1 - line.x2);
    endMarker(ctx, line.x2, line.y2, angle + Math.PI, line.relationship.toCard);
    endMarker(ctx, line.x1, line.y1, angle, line.relationship.fromCard);

    if (line.relationship.label) {
      ctx.font = ENTITY_FONT;
      ctx.fillStyle = PAPER;
      ctx.fillRect(
        line.labelX - line.labelWidth / 2 - LABEL_PAD,
        line.labelY - LABEL_HALF_HEIGHT,
        line.labelWidth + LABEL_PAD * 2,
        LABEL_HALF_HEIGHT * 2,
      );
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'center';
      ctx.fillText(line.relationship.label, line.labelX, line.labelY);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Writing the model back out                                          */
/* ------------------------------------------------------------------ */

const CARDINALITY_TOKEN: Record<Cardinality, string> = {
  one: '1',
  many: '*',
  'zero-one': '0..1',
  'zero-many': '0..*',
  'one-many': '1..*',
  none: '',
};

/**
 * The model as source text.
 *
 * The stored artifact is the text, so the visual builder edits a model and writes
 * it back through here rather than keeping a second copy of the truth. Canonical
 * output: comments and hand formatting do not survive a visual edit, which the
 * builder says out loud.
 *
 * Entities without a name are skipped — a half-typed row should not make the
 * source unparseable while it is being typed.
 */
export function serialiseEntityModel(
  model: {
    direction: DiagramDirection;
    entities: Entity[];
    relationships: Relationship[];
  },
  positions?: EntityPositions,
  name?: string,
): string {
  const lines: string[] = [];
  // The name first, where a reader looks for a title.
  if (name?.trim()) lines.push(`# @name ${name.trim()}`, '');
  if (model.direction === 'right') lines.push('direction: right', '');

  const named = model.entities.filter((entity) => entity.name.trim().length > 0);
  for (const entity of named) {
    lines.push(`entity ${entity.name.trim()}`);
    for (const field of entity.fields) {
      const name = field.name.trim();
      if (name.length === 0) continue;
      const flags = [
        field.pk ? 'pk' : null,
        field.fk ? 'fk' : null,
        field.unique ? 'unique' : null,
        field.optional ? 'null' : null,
      ].filter(Boolean);
      const right = [field.type?.trim() ?? '', ...flags].filter(Boolean).join(' ');
      lines.push(`  ${name}${right ? `: ${right}` : ''}`);
    }
    lines.push('');
  }

  const ids = new Set(named.map((entity) => entity.id));
  for (const relationship of model.relationships) {
    if (!ids.has(relationship.from) || !ids.has(relationship.to)) continue;
    const from = named.find((entity) => entity.id === relationship.from)!.name.trim();
    const to = named.find((entity) => entity.id === relationship.to)!.name.trim();
    const left = CARDINALITY_TOKEN[relationship.fromCard];
    const right = CARDINALITY_TOKEN[relationship.toCard];
    const label = relationship.label?.trim();
    lines.push(`${from} ${left}--${right} ${to}${label ? ` : ${label}` : ''}`);
  }

  // Arrangement last, as comments the model parser skips — see parsePositions.
  const placed = named.filter((entity) => positions?.[entity.id]);
  if (placed.length > 0) {
    lines.push('');
    for (const entity of placed) {
      const at = positions![entity.id]!;
      lines.push(`# @pos ${entity.name.trim()} ${Math.round(at.x)},${Math.round(at.y)}`);
    }
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Lay out and paint a model onto a canvas, sizing its bitmap to fit.
 *
 * Shared by the text editor and the visual builder: both need the same picture,
 * and the measuring has to happen on the context that will draw it or the boxes
 * come out the wrong width. Returns null when there is nothing to draw.
 */
export function paintEntityModel(
  target: HTMLCanvasElement,
  model: EntityModel,
  scale: number,
  positions?: EntityPositions,
): { width: number; height: number } | null {
  const probe = target.getContext('2d');
  if (!probe) return null;
  const layout = layoutEntityModel(
    model,
    (text, bold) => {
      probe.font = bold ? ENTITY_FONT_BOLD : ENTITY_FONT;
      return probe.measureText(text).width;
    },
    positions,
  );
  if (layout.boxes.length === 0) return null;

  target.width = Math.round(layout.width * scale);
  target.height = Math.round(layout.height * scale);
  const ctx = target.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawEntityModel(ctx, layout);
  return { width: layout.width, height: layout.height };
}

/* ------------------------------------------------------------------ */
/* Where the tables sit                                                */
/* ------------------------------------------------------------------ */

/** Top-left corner of a table on the canvas, keyed by entity id. */
export type EntityPositions = Record<string, { x: number; y: number }>;

const POSITION_LINE = /^#\s*@pos\s+(.+?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/i;
const NAME_LINE = /^#\s*@name\s+(.+)$/i;

/**
 * What the model is called, if it has been named.
 *
 * Another `#` line, so the parser skips it and one artifact still carries
 * everything: the tables, where they sit, and what the whole thing is called.
 */
export function parseModelName(source: string): string {
  for (const line of source.split('\n')) {
    const match = NAME_LINE.exec(line.trim());
    if (match) return match[1]!.trim();
  }
  return '';
}

/**
 * Positions read back out of the source.
 *
 * They ride along as `# @pos Bill 120,80` lines, which the model parser already
 * skips as comments. One artifact — the text — then carries both the model and its
 * arrangement, so a card reopened later comes back where it was left instead of
 * snapping to an automatic grid.
 */
export function parsePositions(source: string): EntityPositions {
  const positions: EntityPositions = {};
  for (const line of source.split('\n')) {
    const match = POSITION_LINE.exec(line.trim());
    if (!match) continue;
    positions[match[1]!.trim().toLowerCase()] = { x: Number(match[2]), y: Number(match[3]) };
  }
  return positions;
}

/** What a new entity model starts as. */
export const ENTITY_STARTER = [
  '# One entity per block, one field per line.',
  'entity Bill',
  '  id: uuid pk',
  '  supplier_id: uuid fk',
  '  remaining: decimal',
  '  status: enum',
  '',
  'entity Supplier',
  '  id: uuid pk',
  '  name: text',
  '',
  'Bill *--1 Supplier : billed to',
].join('\n');
