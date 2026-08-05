'use client';

/**
 * The entity model as a canvas you work on directly.
 *
 * This replaces a form beside a preview. The form was honest about the model but
 * wrong about the work: an ERD is a spatial thing, and the arrangement — what sits
 * next to what, which way the joins run — is half of what a reader gets from it.
 * You could not arrange anything in a form.
 *
 * Tables are real elements, dragged by their header. Fields are edited in place.
 * A relationship is made by dragging from one table's handle onto another. The
 * geometry comes from `layoutEntityModel`, the same function that draws the export,
 * so what is attached is what was arranged rather than an automatic redraw of it.
 */
import { KeyRound, Link2, Maximize2, Minus, Plus, Save, Trash2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button, cn } from '@/components/ui';
import { ChatPane } from '@/components/we-adk/claude-chat';
import { type DesignProject } from '@/lib/we-adk-mock/projects';
import { loadBoardChat, saveBoardChat } from '@/lib/we-adk/board-chat';
import { addArtifact, replaceArtifact } from '@/lib/we-adk/board-artifacts';
import { loadDiagramSource, saveDiagramSource } from '@/lib/we-adk/diagram-source';
import {
  ENTITY_FONT,
  ENTITY_FONT_BOLD,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  layoutEntityModel,
  paintEntityModel,
  parseEntityModel,
  parseModelName,
  parsePositions,
  serialiseEntityModel,
  type Cardinality,
  type Entity,
  type EntityField,
  type EntityLayout,
  type EntityPositions,
  type Relationship,
} from '@/lib/we-adk/entity-model';
import { dataUrlSizeKb } from '@/lib/we-adk/whiteboard';

interface Model {
  entities: Entity[];
  relationships: Relationship[];
}

const CARDINALITIES: { value: Cardinality; label: string }[] = [
  { value: 'one', label: '1' },
  { value: 'many', label: '*' },
  { value: 'zero-one', label: '0..1' },
  { value: 'zero-many', label: '0..*' },
  { value: 'one-many', label: '1..*' },
  { value: 'none', label: '—' },
];

const FLAGS: { key: 'pk' | 'fk' | 'unique' | 'optional'; label: string; title: string }[] = [
  { key: 'pk', label: 'PK', title: 'Primary key' },
  { key: 'fk', label: 'FK', title: 'Foreign key' },
  { key: 'unique', label: 'U', title: 'Unique' },
  { key: 'optional', label: '?', title: 'Nullable' },
];

/** How far the pointer must travel before a press counts as a drag. */
const DRAG_THRESHOLD = 3;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/** Where a new table lands: down the diagonal, so two in a row do not stack. */
function freeSpot(count: number): { x: number; y: number } {
  return { x: 40 + (count % 4) * 260, y: 40 + Math.floor(count / 4) * 200 + (count % 4) * 24 };
}

export function EntityCanvas({
  sessionId,
  project,
  uploadedBy,
  onSaved,
  replaceId,
  className,
}: {
  sessionId: string;
  /** For the chat pane, which answers in the project's terms. */
  project: DesignProject;
  uploadedBy: string;
  /** Called only on a real save, with the line the task shows afterwards. */
  onSaved: (message: string) => void;
  /** Set when a card was reopened: saving updates it instead of adding another. */
  replaceId?: string;
  className?: string;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [model, setModel] = useState<Model>({ entities: [], relationships: [] });
  const [positions, setPositions] = useState<EntityPositions>({});
  /** What this model is called. Empty until named, and then the card's title. */
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  /** Canvas scale. A transform, so the model keeps its own coordinates and what is
   *  exported does not depend on how closely you were looking. */
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [chatTurns] = useState(() => loadBoardChat(sessionId, 'entities'));
  /** The table a link is being dragged from, and where the cursor is now. */
  const [linking, setLinking] = useState<{ from: string; x: number; y: number } | null>(null);
  /**
   * The table being dragged, held in state rather than a ref so the window
   * listeners below can be attached only while a drag is live.
   */
  const [dragging, setDragging] = useState<{
    id: string;
    dx: number;
    dy: number;
    /** Where the pointer went down, so a click can be told from a drag. */
    fromX: number;
    fromY: number;
    moved: boolean;
  } | null>(null);
  /** Read by the drag listener, so it always commits the latest arrangement. */
  const latest = useRef({ model, positions, linking });
  latest.current = { model, positions, linking };

  // Both the model and its arrangement come out of the stored source.
  useEffect(() => {
    const source = loadDiagramSource(sessionId);
    const parsed = parseEntityModel(source);
    setModel({ entities: parsed.entities, relationships: parsed.relationships });
    setPositions(parsePositions(source));
    setName(parseModelName(source));
  }, [sessionId]);

  /** Every change writes the source, so the text and the canvas cannot drift. */
  const commit = useCallback(
    (next: Model, nextPositions: EntityPositions, nextName?: string) => {
      const title = nextName ?? name;
      setModel(next);
      setPositions(nextPositions);
      if (nextName !== undefined) setName(nextName);
      saveDiagramSource(
        sessionId,
        serialiseEntityModel({ direction: 'down', ...next }, nextPositions, title),
      );
      setNote(null);
    },
    [sessionId, name],
  );

  /**
   * Geometry for everything on screen.
   *
   * Measured with a detached 2D context in the same fonts the export uses, so a
   * card on the canvas is exactly the box the PNG will contain.
   */
  const layout: EntityLayout = useMemo(() => {
    const probe = document.createElement('canvas').getContext('2d');
    const measure = (text: string, bold?: boolean) => {
      if (!probe) return text.length * 7;
      probe.font = bold ? ENTITY_FONT_BOLD : ENTITY_FONT;
      return probe.measureText(text).width;
    };
    return layoutEntityModel(
      { direction: 'down', issues: [], ...model },
      measure,
      // While dragging, the live position wins so the card follows the pointer.
      positions,
    );
  }, [model, positions]);

  const boxOf = (id: string) => layout.boxes.find((box) => box.entity.id === id);

  /* --- dragging a table --------------------------------------------- */

  /**
   * Client coordinates to canvas coordinates — scroll and scale included.
   *
   * Dividing by the zoom is what keeps a dragged table under the cursor: without
   * it a card at 50% would move half as far as the pointer, and at 200% twice.
   */
  const pointOn = useCallback(
    (clientX: number, clientY: number) => {
      const surface = surfaceRef.current;
      if (!surface) return { x: 0, y: 0 };
      const rect = surface.getBoundingClientRect();
      return {
        x: (clientX - rect.left + surface.scrollLeft) / zoom,
        y: (clientY - rect.top + surface.scrollTop) / zoom,
      };
    },
    [zoom],
  );

  /**
   * Zoom about a point, so what is under the cursor stays under it.
   *
   * Without the scroll correction the canvas lunges away from wherever you were
   * looking, which makes wheel-zoom useless on a wide model.
   */
  const zoomAbout = useCallback((next: number, atX?: number, atY?: number) => {
    const surface = surfaceRef.current;
    setZoom((current) => {
      const target = clampZoom(next);
      if (surface && atX !== undefined && atY !== undefined) {
        const factor = target / current;
        surface.scrollLeft = (surface.scrollLeft + atX) * factor - atX;
        surface.scrollTop = (surface.scrollTop + atY) * factor - atY;
      }
      return target;
    });
  }, []);

  /**
   * Ctrl/⌘ + wheel zooms; a plain wheel scrolls.
   *
   * Attached by hand rather than through onWheel: React registers wheel listeners
   * passively, and a passive listener cannot preventDefault — the browser would
   * zoom the whole page instead of the board.
   */
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      zoomAbout(
        zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    surface.addEventListener('wheel', onWheel, { passive: false });
    return () => surface.removeEventListener('wheel', onWheel);
  }, [zoom, zoomAbout]);

  /**
   * A table is dragged from anywhere on it, including over its own fields.
   *
   * The header alone was not enough to grab: a 130px card is nearly all name
   * input, leaving a few pixels of header to hit. Dragging from anywhere would
   * normally cost you the ability to click into a field, so a press only becomes a
   * drag once the pointer has travelled — below that it is a click, and the field
   * keeps the focus it just took.
   */
  const startDrag = (event: ReactPointerEvent, id: string) => {
    const box = boxOf(id);
    if (!box) return;
    const at = pointOn(event.clientX, event.clientY);
    setDragging({ id, dx: at.x - box.x, dy: at.y - box.y, fromX: at.x, fromY: at.y, moved: false });
    setSelected(null);
  };

  /**
   * Moves and releases are watched on the window, not on the card.
   *
   * The first version captured the pointer on the card header and listened on the
   * surface — so every move went to the captured element and the surface heard
   * nothing. Dragging and drawing a join both did nothing at all. The window hears
   * everything, including a release outside the canvas.
   */
  useEffect(() => {
    if (!dragging && !linking) return;

    const move = (event: PointerEvent) => {
      const at = pointOn(event.clientX, event.clientY);
      if (dragging) {
        const far =
          dragging.moved ||
          Math.abs(at.x - dragging.fromX) > DRAG_THRESHOLD ||
          Math.abs(at.y - dragging.fromY) > DRAG_THRESHOLD;
        if (!far) return;
        if (!dragging.moved) setDragging({ ...dragging, moved: true });
        setPositions((current) => ({
          ...current,
          [dragging.id]: { x: Math.max(0, at.x - dragging.dx), y: Math.max(0, at.y - dragging.dy) },
        }));
      } else {
        setLinking((current) => (current ? { ...current, x: at.x, y: at.y } : current));
      }
    };

    const up = () => {
      if (dragging) {
        const wasDrag = dragging.moved;
        setDragging(null);
        // Write the arrangement once, at the end of a real drag — a click that
        // moved nothing should not rewrite the source.
        if (wasDrag) commit(latest.current.model, latest.current.positions);
      }
      // A link released anywhere but on a table is a link not made; the card's own
      // pointerup handler has already run by the time this does.
      setLinking(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, linking, pointOn, commit]);

  /* --- making a relationship ---------------------------------------- */

  const startLink = (event: ReactPointerEvent, id: string) => {
    event.stopPropagation();
    const at = pointOn(event.clientX, event.clientY);
    setLinking({ from: id, x: at.x, y: at.y });
  };

  const finishLink = (id: string) => {
    if (!linking || linking.from === id) {
      setLinking(null);
      return;
    }
    // A pair already joined is left alone rather than doubled up.
    const exists = model.relationships.some(
      (relationship) =>
        (relationship.from === linking.from && relationship.to === id) ||
        (relationship.from === id && relationship.to === linking.from),
    );
    if (!exists) {
      commit(
        {
          ...model,
          relationships: [
            ...model.relationships,
            { from: linking.from, to: id, fromCard: 'many', toCard: 'one' },
          ],
        },
        positions,
      );
    }
    setLinking(null);
  };

  /* --- tables and fields -------------------------------------------- */

  const addTable = () => {
    const index = model.entities.length + 1;
    let name = `Table ${index}`;
    let suffix = index;
    while (model.entities.some((entity) => entity.id === name.toLowerCase())) {
      suffix += 1;
      name = `Table ${suffix}`;
    }
    const entity: Entity = {
      id: name.toLowerCase(),
      name,
      fields: [{ name: 'id', type: 'uuid', pk: true }],
    };
    commit(
      { ...model, entities: [...model.entities, entity] },
      { ...positions, [entity.id]: freeSpot(model.entities.length) },
    );
  };

  const renameTable = (index: number, name: string) => {
    const before = model.entities[index];
    if (!before) return;
    const nextId = name.trim().toLowerCase();
    const nextPositions = { ...positions };
    if (nextPositions[before.id]) {
      nextPositions[nextId] = nextPositions[before.id]!;
      if (nextId !== before.id) delete nextPositions[before.id];
    }
    commit(
      {
        entities: model.entities.map((entity, i) =>
          i === index ? { ...entity, name, id: nextId } : entity,
        ),
        // Relationships point at ids, so a rename has to carry them along.
        relationships: model.relationships.map((relationship) => ({
          ...relationship,
          from: relationship.from === before.id ? nextId : relationship.from,
          to: relationship.to === before.id ? nextId : relationship.to,
        })),
      },
      nextPositions,
    );
  };

  const removeTable = (index: number) => {
    const gone = model.entities[index];
    if (!gone) return;
    const nextPositions = { ...positions };
    delete nextPositions[gone.id];
    commit(
      {
        entities: model.entities.filter((_, i) => i !== index),
        relationships: model.relationships.filter(
          (relationship) => relationship.from !== gone.id && relationship.to !== gone.id,
        ),
      },
      nextPositions,
    );
  };

  const setFields = (index: number, fields: EntityField[]) =>
    commit(
      {
        ...model,
        entities: model.entities.map((entity, i) => (i === index ? { ...entity, fields } : entity)),
      },
      positions,
    );

  const setField = (tableIndex: number, fieldIndex: number, patch: Partial<EntityField>) => {
    const entity = model.entities[tableIndex];
    if (!entity) return;
    setFields(
      tableIndex,
      entity.fields.map((field, i) => (i === fieldIndex ? { ...field, ...patch } : field)),
    );
  };

  /* --- saving ------------------------------------------------------- */

  const tableCount = model.entities.filter((entity) => entity.name.trim().length > 0).length;

  const save = () => {
    const off = document.createElement('canvas');
    const painted = paintEntityModel(
      off,
      { direction: 'down', issues: [], ...model },
      1,
      positions,
    );
    if (!painted) return;
    const dataUrl = off.toDataURL('image/png');
    const source = serialiseEntityModel({ direction: 'down', ...model }, positions, name);
    const fields = {
      kind: 'entities' as const,
      ...(name.trim() ? { title: name.trim() } : {}),
      sizeKb: dataUrlSizeKb(dataUrl),
      dataUrl,
      caption: source
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .join(' · ')
        .slice(0, 200),
      source,
      createdBy: uploadedBy,
    };
    const today = new Date().toISOString().slice(0, 10);
    const saved = replaceId
      ? replaceArtifact(sessionId, replaceId, fields, today)
      : addArtifact(sessionId, fields, today);
    if (!saved) {
      setNote('Browser storage is full, so this model could not be kept.');
      return;
    }
    onSaved(`${replaceId ? 'Updated' : 'Saved'} ${saved.title}.`);
  };

  /* --- painting the joins ------------------------------------------- */

  /** The middle of what is on screen, for the buttons to zoom about. */
  const viewportCentre = () => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 0, y: 0 };
    return { x: surface.clientWidth / 2, y: surface.clientHeight / 2 };
  };

  /**
   * Whatever scale shows the whole model, capped at 100% — blowing a two-table
   * diagram up to 200% to "fit" it is not what anyone means by fit.
   */
  const fitToView = () => {
    const surface = surfaceRef.current;
    if (!surface || layout.width === 0) return;
    const next = Math.min(
      1,
      (surface.clientWidth - 32) / layout.width,
      (surface.clientHeight - 32) / layout.height,
    );
    surface.scrollLeft = 0;
    surface.scrollTop = 0;
    setZoom(clampZoom(next));
  };

  /**
   * The model as the chat sees it.
   *
   * The source text is already the readable form, so it is handed over as-is —
   * minus the `@pos` lines, which describe where boxes sit and tell a reader
   * nothing about the data.
   */
  const chatContext = useMemo(() => {
    if (tableCount === 0) return 'The entity model is empty — no tables yet.';
    const text = serialiseEntityModel({ direction: 'down', ...model })
      .split('\n')
      .filter((line) => !line.trim().startsWith('# @pos'))
      .join('\n')
      .trim();
    return [
      `${name.trim() ? `Entity model "${name.trim()}"` : 'Entity model'} with ${tableCount} table${tableCount === 1 ? '' : 's'} and ${model.relationships.length} relationship${model.relationships.length === 1 ? '' : 's'}:`,
      '',
      text,
    ].join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, tableCount, name]);

  const surfaceSize = {
    width: Math.max(layout.width + 200, 1200),
    height: Math.max(layout.height + 200, 700),
  };

  return (
    <div className={cn('flex min-h-0 flex-1 gap-3', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          {/* The model's own name, kept in the source and used as the card's title —
              `Entity model 3` is a placeholder for a name, not a substitute. */}
          <input
            value={name}
            onChange={(event) => commit(model, positions, event.target.value)}
            placeholder="Untitled model"
            aria-label="Model name"
            className="bg-background h-8 w-56 min-w-0 rounded-md border px-2.5 text-xs font-medium"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={addTable}
          >
            <Plus className="size-3.5" />
            Add table
          </Button>
          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 truncate text-[11px]">
            <KeyRound className="size-3 shrink-0" />
            Drag a table to move it · drag the link handle onto another table · click a join to
            change it
          </p>

          {/* What the flags mean.
            The form this canvas replaced carried this legend and the canvas dropped
            it, leaving `U` and `?` to be guessed at — the per-button tooltips only
            help once you already suspect they are buttons. */}
          <p className="text-muted-foreground ml-auto hidden shrink-0 items-center gap-2 text-[11px] lg:flex">
            {[
              ['PK', 'primary key'],
              ['FK', 'foreign key'],
              ['U', 'unique'],
              ['?', 'nullable'],
            ].map(([flag, meaning]) => (
              <span key={flag} className="flex items-center gap-1">
                <span className="bg-muted text-foreground rounded px-1 font-mono text-[10px]">
                  {flag}
                </span>
                {meaning}
              </span>
            ))}
          </p>
        </div>

        {/* The canvas in two parts: a frame that stays put, and a scroller inside it.
          Anything absolutely positioned inside a scrolling box scrolls with the
          content — the zoom controls drifted away with the model, and the
          empty-state line was centred on the 1200×700 content rather than on what
          you can actually see. Overlays belong to the frame. */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={surfaceRef}
            onClick={() => setSelected(null)}
            className="bg-muted/20 absolute inset-0 overflow-auto rounded-md border"
          >
            {/* Two boxes, not one: the outer takes the scaled size so the scrollbars
            describe what is actually there, while the inner keeps model
            coordinates and is scaled. A transform alone leaves the scroll extents
            measuring the unscaled layout, so zooming in would crop the model. */}
            <div
              style={{ width: surfaceSize.width * zoom, height: surfaceSize.height * zoom }}
              className="relative"
            >
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{
                  width: surfaceSize.width,
                  height: surfaceSize.height,
                  transform: `scale(${zoom})`,
                }}
              >
                {/* Joins under the tables, the same order the export paints them. */}
                <svg
                  className="pointer-events-none absolute inset-0"
                  width={surfaceSize.width}
                  height={surfaceSize.height}
                >
                  {layout.relationships.map((line, index) => (
                    <g key={index}>
                      <line
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={selected === index ? '#2563eb' : '#64748b'}
                        strokeWidth={selected === index ? 2 : 1.3}
                      />
                      {line.relationship.label && (
                        <text
                          x={line.labelX}
                          y={line.labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-muted-foreground text-[11px]"
                        >
                          {line.relationship.label}
                        </text>
                      )}
                    </g>
                  ))}
                  {linking && boxOf(linking.from) && (
                    <line
                      x1={boxOf(linking.from)!.x + boxOf(linking.from)!.width}
                      y1={boxOf(linking.from)!.y + HEADER_HEIGHT / 2}
                      x2={linking.x}
                      y2={linking.y}
                      stroke="#2563eb"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  )}
                </svg>

                {layout.boxes.map((box) => {
                  const index = model.entities.findIndex((entity) => entity.id === box.entity.id);
                  return (
                    <div
                      // Keyed by position in the model, not by id.
                      //
                      // An entity's id comes from its name, so keying by it handed the
                      // card a new key on every keystroke: React unmounted and remounted
                      // it, the name input lost focus, and renaming a table one letter at
                      // a time was impossible.
                      key={`table-${index}`}
                      onPointerDown={(event) => startDrag(event, box.entity.id)}
                      onPointerUp={() => linking && finishLink(box.entity.id)}
                      style={{ left: box.x, top: box.y, width: box.width }}
                      className={cn(
                        // No overflow-hidden: the per-field controls sit just outside the
                        // right edge and would be clipped away. The header rounds its own
                        // top corners instead of relying on the card to crop them.
                        'bg-background absolute rounded-md border shadow-sm',
                        dragging?.id === box.entity.id && dragging.moved
                          ? 'cursor-grabbing shadow-md'
                          : 'cursor-grab',
                      )}
                    >
                      <div
                        style={{ height: HEADER_HEIGHT }}
                        className="bg-muted/50 flex items-center gap-1 rounded-t-md border-b px-2"
                      >
                        <input
                          value={box.entity.name}
                          onChange={(event) => renameTable(index, event.target.value)}
                          placeholder="Table"
                          className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                        />
                        <button
                          type="button"
                          aria-label={`Link ${box.entity.name} to another table`}
                          title="Drag onto another table"
                          onPointerDown={(event) => startLink(event, box.entity.id)}
                          className="text-muted-foreground hover:text-foreground shrink-0 cursor-crosshair"
                        >
                          <Link2 className="size-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${box.entity.name}`}
                          title="Remove table"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => removeTable(index)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>

                      {model.entities[index]?.fields.map((field, fieldIndex) => (
                        <div
                          key={fieldIndex}
                          style={{ height: ROW_HEIGHT }}
                          className="group/field relative flex items-center gap-1 px-2 text-[12px]"
                        >
                          <input
                            value={field.name}
                            onChange={(event) =>
                              setField(index, fieldIndex, { name: event.target.value })
                            }
                            placeholder="field"
                            className={cn(
                              'min-w-0 flex-1 bg-transparent outline-none',
                              field.pk && 'font-semibold',
                            )}
                          />
                          <input
                            value={field.type ?? ''}
                            onChange={(event) =>
                              setField(index, fieldIndex, { type: event.target.value })
                            }
                            placeholder="type"
                            className="text-muted-foreground w-20 min-w-0 shrink-0 bg-transparent text-right outline-none"
                          />
                          {/* Beside the card, not inside it.
                        In flow they were hidden with opacity, which keeps their
                        width, and on a narrow card that left the field name zero
                        pixels. Floating them over the row's right end fixed the
                        name and broke the type: reaching `type` means hovering the
                        row, which is exactly when the cluster covered it. So they
                        sit just outside the card's right edge — no overlap with
                        anything, and `left-full` with no gap keeps the pointer
                        inside the row on the way over, or they would vanish as you
                        reached for them. */}
                          <span className="bg-background absolute inset-y-0 left-full z-10 flex shrink-0 items-center gap-0.5 rounded-r-md border border-l-0 px-1 opacity-0 shadow-sm transition-opacity group-hover/field:opacity-100 focus-within:opacity-100">
                            {FLAGS.map((flag) => (
                              <button
                                key={flag.key}
                                type="button"
                                title={flag.title}
                                aria-pressed={field[flag.key] === true}
                                onClick={() =>
                                  setField(index, fieldIndex, { [flag.key]: !field[flag.key] })
                                }
                                className={cn(
                                  'rounded px-1 font-mono text-[9px]',
                                  field[flag.key]
                                    ? 'bg-foreground text-background'
                                    : 'text-muted-foreground hover:bg-muted',
                                )}
                              >
                                {flag.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              aria-label="Remove field"
                              onClick={() =>
                                setFields(
                                  index,
                                  (model.entities[index]?.fields ?? []).filter(
                                    (_, i) => i !== fieldIndex,
                                  ),
                                )
                              }
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </span>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          setFields(index, [
                            ...(model.entities[index]?.fields ?? []),
                            { name: '', type: '' },
                          ])
                        }
                        className="text-muted-foreground hover:text-foreground hover:bg-muted/40 flex w-full items-center gap-1 border-t px-2 py-1 text-[11px]"
                      >
                        <Plus className="size-2.5" />
                        field
                      </button>
                    </div>
                  );
                })}

                {/* Hit areas for the joins, above the tables.
              A fat transparent line makes a 1px join clickable, but down with the
              strokes it was unreachable wherever a card covered it — two tables
              close together leave a join barely 37px long with its midpoint inside
              one of them. Up here the click always lands, and the layer itself takes
              no pointer events, so the tables underneath stay usable. */}
                <svg
                  className="pointer-events-none absolute inset-0 z-[5]"
                  width={surfaceSize.width}
                  height={surfaceSize.height}
                >
                  {layout.relationships.map((line, index) => (
                    <line
                      key={index}
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="transparent"
                      strokeWidth={14}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(index);
                      }}
                    />
                  ))}
                </svg>

                {/* The one join that is selected gets its controls where it sits. */}
                {selected !== null && layout.relationships[selected] && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      left: layout.relationships[selected]!.labelX,
                      top: layout.relationships[selected]!.labelY + 12,
                    }}
                    className="bg-background absolute z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border p-1 shadow-md"
                  >
                    {(['fromCard', 'toCard'] as const).map((end) => (
                      <select
                        key={end}
                        value={layout.relationships[selected]!.relationship[end]}
                        onChange={(event) =>
                          commit(
                            {
                              ...model,
                              relationships: model.relationships.map((relationship, i) =>
                                i === selected
                                  ? { ...relationship, [end]: event.target.value as Cardinality }
                                  : relationship,
                              ),
                            },
                            positions,
                          )
                        }
                        className="bg-background h-6 rounded border px-1 font-mono text-[11px]"
                      >
                        {CARDINALITIES.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    ))}
                    <input
                      value={layout.relationships[selected]!.relationship.label ?? ''}
                      onChange={(event) =>
                        commit(
                          {
                            ...model,
                            relationships: model.relationships.map((relationship, i) =>
                              i === selected
                                ? { ...relationship, label: event.target.value }
                                : relationship,
                            ),
                          },
                          positions,
                        )
                      }
                      placeholder="label"
                      className="bg-background h-6 w-24 rounded border px-1.5 text-[11px]"
                    />
                    <button
                      type="button"
                      aria-label="Remove relationship"
                      onClick={() => {
                        commit(
                          {
                            ...model,
                            relationships: model.relationships.filter((_, i) => i !== selected),
                          },
                          positions,
                        );
                        setSelected(null);
                      }}
                      className="text-muted-foreground hover:text-destructive px-0.5"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Centred on what you can see, and out of the pointer's way. */}
          {tableCount === 0 && (
            <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs">
              Empty canvas — add a table to start.
            </p>
          )}

          <div className="bg-background/95 absolute bottom-2 left-2 z-20 flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm backdrop-blur">
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out (⌘ or Ctrl + scroll)"
              onClick={() => zoomAbout(zoom / 1.2, viewportCentre().x, viewportCentre().y)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              title="Back to 100%"
              onClick={() => zoomAbout(1, viewportCentre().x, viewportCentre().y)}
              className="text-muted-foreground hover:text-foreground min-w-11 rounded px-1 font-mono text-[11px] tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in (⌘ or Ctrl + scroll)"
              onClick={() => zoomAbout(zoom * 1.2, viewportCentre().x, viewportCentre().y)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
            >
              <Plus className="size-3.5" />
            </button>
            <span className="bg-border mx-0.5 h-4 w-px" />
            <button
              type="button"
              aria-label="Fit the model in view"
              title="Fit"
              onClick={fitToView}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-1">
          <p className="text-muted-foreground min-w-0 truncate text-[11px]">
            {note ??
              `${tableCount} table${tableCount === 1 ? '' : 's'} · ${model.relationships.length} relation${model.relationships.length === 1 ? '' : 's'}`}
          </p>
          <Button
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-3 text-xs"
            disabled={tableCount === 0}
            onClick={save}
          >
            <Save className="size-3.5" />
            Save model
          </Button>
        </div>
      </div>

      {/* Claude beside the model, the same pane the whiteboard and the task use.
          Hidden below xl: on a narrow window the canvas needs the width more than
          the conversation does. */}
      <aside className="hidden w-[26rem] shrink-0 flex-col border-l pl-3 xl:flex">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatPane
            project={project}
            contextText={chatContext}
            folderLabel="entity-model"
            greeting="Ask about this model"
            greetingHint="The tables, their fields and how they are joined are in context."
            initialTurns={chatTurns}
            onPersist={(turns) => saveBoardChat(sessionId, turns, 'entities')}
          />
        </div>
      </aside>
    </div>
  );
}
