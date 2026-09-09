'use client';

/**
 * The IA tab's Screen Flow view — the same sheet, drawn as a navigation map.
 *
 * The table answers "what screens are there"; this answers "how does someone
 * get from one to the next", which is the question an IA document is usually
 * opened for. Both views read the same IARow[], so a rename or a re-parent in
 * the sheet moves the card here on the next render and the two cannot drift.
 *
 * The layout is three fixed levels, read from the depth columns the sheet
 * already keeps:
 *
 *   depth1  role section      ACCOUNTANT
 *   depth2  business area     DASHBOARD · MONTH-END CLOSE · APPROVAL
 *   rest    the screens       01 Dashboard → 03 Close Status → …
 *
 * A business area is a heading, never a card: naming a group is not the same
 * as having a screen for it, and drawing it as a card would put a page in the
 * map that nobody can open. Primary screens run left-to-right on one line so
 * the main journey reads as a sentence; popups and drawers hang beneath their
 * parent inside a tinted well, side by side rather than in a chain, because
 * two ways out of one screen are alternatives, not steps.
 *
 * Thumbnails are the cached canvas blocks, not the running product. A board
 * carrying thirty live React screens is a board that does not open.
 */

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Frame, Layers, Maximize2, Minus, MoreVertical, Plus } from 'lucide-react';
import { cn } from '@/components/ui';
import { IA_DEPTH_FIELDS, type IARow } from '@/lib/we-adk-mock/ia';
import { DesignThumbnail } from '@/components/we-adk/design-thumbnail';

/** Card geometry. Fixed, so the branch connectors can be positioned exactly. */
const SCREEN_W = 252;
const POPUP_W = 208;
const THUMB_H = 122;
const POPUP_THUMB_H = 84;
/** Gap between popup siblings. */
const POPUP_GAP = 20;
/** The gap an area-to-area arrow lives in. */
const AREA_GAP = 64;

/**
 * The width a screen's column needs: its card, or the well of popups under it
 * when that is wider. A card is centred in its column, so a column wider than
 * a card leaves an overhang either side — which is exactly the space an arrow
 * has to cross on top of the gap between columns.
 */
function columnWidthOf(screen: { popups: unknown[] }): number {
  const count = screen.popups.length;
  const well = count > 0 ? count * POPUP_W + (count - 1) * POPUP_GAP : 0;
  return Math.max(SCREEN_W, well);
}

/** Half the space a centred card leaves on one side of its column. */
function overhangOf(columnWidth: number): number {
  return (columnWidth - SCREEN_W) / 2;
}

/** A screen and the popups that open from it. */
export interface FlowScreen {
  key: string;
  name: string;
  row: IARow;
  popups: { key: string; name: string; row: IARow }[];
}

/** A depth2 heading and the screens under it, in reading order. */
export interface FlowArea {
  key: string;
  name: string;
  screens: FlowScreen[];
}

/** A depth1 section — the role or top-level module. */
export interface FlowSection {
  name: string;
  areas: FlowArea[];
  screenCount: number;
  popupCount: number;
}

function isPopup(row: IARow): boolean {
  return row.screenType === 'Popup' || row.screenType === 'Drawer';
}

/** The depth segments of a row, trailing blanks dropped. */
function segmentsOf(row: IARow): string[] {
  const all = IA_DEPTH_FIELDS.map((field) => (row[field] ?? '').trim());
  let end = all.length;
  while (end > 0 && !all[end - 1]) end -= 1;
  return all.slice(0, end);
}

/** Working tree node, before it is flattened into sections. */
interface TreeNode {
  key: string;
  name: string;
  row: IARow | null;
  children: TreeNode[];
}

/**
 * Groups rows into sections, then flattens each into the two rails the board
 * draws: a line of primary screens, and the popups hanging off each of them.
 *
 * A popup is attached to the nearest screen above it rather than to its
 * literal parent path, so a popup filed one level too deep still lands under
 * the screen it opens from instead of floating loose.
 */
export function buildFlowSections(rows: IARow[]): FlowSection[] {
  const sections = new Map<string, TreeNode[]>();

  const descend = (siblings: TreeNode[], key: string, name: string): TreeNode => {
    const existing = siblings.find((node) => node.key === key);
    if (existing) return existing;
    const created: TreeNode = { key, name, row: null, children: [] };
    siblings.push(created);
    return created;
  };

  for (const row of rows) {
    const segments = segmentsOf(row);
    const sectionName = segments[0] ?? '';
    const roots = sections.get(sectionName) ?? [];
    sections.set(sectionName, roots);

    const rest = segments.slice(1);
    if (rest.length === 0) {
      const node = descend(roots, `${sectionName}//self`, sectionName || '(unnamed)');
      if (!node.row) node.row = row;
      continue;
    }

    let siblings = roots;
    let holder = roots;
    let node: TreeNode | null = null;
    let path = sectionName;
    for (const segment of rest) {
      path = `${path}/${segment}`;
      holder = siblings;
      node = descend(siblings, path, segment);
      siblings = node.children;
    }
    if (node) {
      if (!node.row) {
        node.row = row;
      } else {
        /*
         * Another row already sits on this path. Dropping this one would put
         * the board and the sheet out of step — the table would list a screen
         * the flow never draws — so it gets its own card beside the first.
         */
        holder.push({
          key: `${path}#${row.id}`,
          name: rest[rest.length - 1] ?? node.name,
          row,
          children: [],
        });
      }
    }
  }

  return [...sections.entries()]
    .map(([name, roots]) => {
      const areas: FlowArea[] = [];

      for (const root of roots) {
        const screens: FlowScreen[] = [];

        /** Walk a branch, appending screens in order and hanging popups. */
        const walk = (node: TreeNode) => {
          if (node.row && isPopup(node.row)) {
            const host = screens[screens.length - 1];
            if (host) {
              host.popups.push({ key: node.key, name: node.name, row: node.row });
            } else {
              // A popup with no screen above it still has to be visible, so it
              // stands on the main rail rather than being dropped.
              screens.push({ key: node.key, name: node.name, row: node.row, popups: [] });
            }
          } else if (node.row) {
            screens.push({ key: node.key, name: node.name, row: node.row, popups: [] });
          }
          for (const child of node.children) walk(child);
        };
        walk(root);

        if (screens.length > 0) areas.push({ key: root.key, name: root.name, screens });
      }

      let screenCount = 0;
      let popupCount = 0;
      for (const area of areas) {
        for (const screen of area.screens) {
          if (isPopup(screen.row)) popupCount += 1;
          else screenCount += 1;
          popupCount += screen.popups.length;
        }
      }
      return { name, areas, screenCount, popupCount };
    })
    .filter((section) => section.areas.length > 0)
    .sort((a, b) => {
      // Rows that never named a section collect at the end.
      if (!a.name) return 1;
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });
}

/** Numbers every card depth-first, so the order matches how the board reads. */
function numberScreens(sections: FlowSection[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let next = 1;
  for (const section of sections) {
    for (const area of section.areas) {
      for (const screen of area.screens) {
        numbers.set(screen.key, next);
        next += 1;
        for (const popup of screen.popups) {
          numbers.set(popup.key, next);
          next += 1;
        }
      }
    }
  }
  return numbers;
}

/** Status chip colours, matching the sheet's own vocabulary. */
const STATUS_CHIP: Record<string, string> = {
  'To do': 'bg-muted text-muted-foreground',
  'In progress': 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Review: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};

const STATUS_DOT: Record<string, string> = {
  'To do': 'bg-muted-foreground/40',
  'In progress': 'bg-blue-500',
  Review: 'bg-amber-500',
  Done: 'bg-emerald-500',
};

/**
 * A thumbnail that draws only once the card is near the viewport.
 *
 * The blocks themselves are cheap, but a round can carry dozens of cards and
 * there is no reason to lay out the ones nobody has scrolled to. Metadata is
 * rendered by the card regardless, so a card is readable before its picture
 * arrives.
 *
 * The whole thing is inert: a thumbnail is a picture of a screen, not the
 * screen, so nothing inside it should be clickable or reachable by tab — and a
 * canvas holding a button block really does render a <button>.
 */
function LazyThumb({ screenId, width, height }: { screenId: string | null; width: number; height: number }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = holder.current;
    if (!node || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div
      ref={holder}
      aria-hidden
      className="bg-muted/40 pointer-events-none flex items-center justify-center overflow-hidden rounded-md border select-none"
      style={{ height }}
    >
      {screenId && near ? (
        <DesignThumbnail screenId={screenId} width={width} height={height} />
      ) : (
        <Frame className="text-muted-foreground/40 size-5" />
      )}
    </div>
  );
}

interface CardProps {
  name: string;
  row: IARow;
  number: number | undefined;
  screenId: string | null;
  route: string;
  description: string;
  onOpen: (row: IARow) => void;
  popup?: boolean;
}

/**
 * Memoised so that zooming or panning — which re-renders the board — does not
 * re-render every card on it. The callbacks arrive already stable from the
 * page, so the comparison actually holds.
 */
const ScreenCard = memo(function ScreenCard({
  name,
  row,
  number,
  screenId,
  route,
  description,
  onOpen,
  popup = false,
}: CardProps) {
  const width = popup ? POPUP_W : SCREEN_W;
  const thumbH = popup ? POPUP_THUMB_H : THUMB_H;

  return (
    <div
      className={cn(
        'bg-background flex h-full flex-col gap-2 rounded-xl border p-3',
        popup
          // No lift on a popup: it sits on the group's green wash, where a
          // shadow reads as a halo around the card rather than depth.
          ? 'border-emerald-300 dark:border-emerald-800'
          : 'border-violet-300 shadow-sm transition-shadow hover:shadow-md dark:border-violet-800',
      )}
      style={{ width }}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
          {number !== undefined ? String(number).padStart(2, '0') : '--'}
        </span>
        <span className="truncate text-[13px] font-semibold" title={name}>
          {name}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onOpen(row)}
          title={`Open ${name}`}
          aria-label={`Open ${name}`}
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring -mr-1 shrink-0 rounded p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <MoreVertical className="size-3.5" />
        </button>
      </div>

      {/* The trigger is an overlay, not a wrapper — see LazyThumb. */}
      <div className="relative">
        <LazyThumb screenId={screenId} width={width} height={thumbH} />
        <button
          type="button"
          onClick={() => onOpen(row)}
          aria-label={`Preview ${name}`}
          className="focus-visible:ring-ring absolute inset-0 cursor-pointer rounded-md focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      {description && (
        <p className="text-foreground/80 line-clamp-2 text-[11.5px] leading-snug" title={description}>
          {description}
        </p>
      )}
      {route && (
        <p className="text-muted-foreground truncate font-mono text-[11px]" title={route}>
          {route}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px]',
            popup
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {row.screenType}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-[11px]">
          {row.platform}
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <span
            className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[row.status] ?? 'bg-muted-foreground/40')}
            aria-hidden
          />
          {row.status}
        </span>
      </div>
    </div>
  );
});

/** The solid connector between two primary screens. */
const AREA_HEAD_H = 36;

/**
 * The solid connector between two primary screens.
 *
 * The element occupies only the gap between two columns, but the line has to
 * span card edge to card edge — and a card is centred in its column, so where
 * a column is wider than a card (the ones carrying popups) there is an
 * overhang of empty column on each side of the gap to cross as well.
 *
 * Widening the element does not work: it widens the gap by exactly the amount
 * added and the line falls just as short. So the element keeps the gap's width
 * and the line is drawn wider than its box, pulled left over the overhang it
 * has to reach back across.
 */
function MainArrow({
  gap,
  leadOut = 0,
  leadIn = 0,
  offsetTop = 0,
}: {
  gap: number;
  /** Empty column between the previous card's right edge and the gap. */
  leadOut?: number;
  /** Empty column between the gap and the next card's left edge. */
  leadIn?: number;
  offsetTop?: number;
}) {
  const span = leadOut + gap + leadIn;
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center self-start"
      style={{ width: gap, height: THUMB_H + 46, marginTop: offsetTop }}
    >
      <svg
        width={span}
        height="12"
        viewBox={`0 0 ${span} 12`}
        fill="none"
        className="shrink-0 text-violet-500"
        style={{ marginLeft: -leadOut }}
      >
        <path d={`M0 6 H${span - 7}`} stroke="currentColor" strokeWidth="1.5" />
        <circle cx={span / 2} cy="6" r="3.5" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
        <path d={`M${span - 8} 2 L${span - 1} 6 L${span - 8} 10 Z`} fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * The drop from a screen into the popups it opens.
 *
 * One popup gets a straight stem. Two or more get a bracket: down from the
 * parent, out to each child's centre, then down into it — drawn as one SVG so
 * the corners are rounded and the whole thing sits behind the cards rather
 * than between them. Fixed card widths make every anchor exact, so nothing has
 * to be measured at runtime.
 */
function PopupConnector({ count, wellWidth }: { count: number; wellWidth: number }) {
  /**
   * The drop is the only thing separating a parent card from the well beneath
   * it, so it doubles as that gap. At 34px the two read as one block; this
   * gives the connector room to be seen as a connector.
   */
  const height = 62;
  const centre = wellWidth / 2;
  if (count === 1) {
    return (
      <svg aria-hidden width={wellWidth} height={height} className="text-emerald-500 dark:text-emerald-400">
        <path
          d={`M${centre} 0 V${height - 8}`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          fill="none"
        />
        <circle cx={centre} cy={height / 2} r="3.5" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
        <path d={`M${centre - 4} ${height - 8} L${centre} ${height - 1} L${centre + 4} ${height - 8} Z`} fill="currentColor" />
      </svg>
    );
  }

  // Child centres inside the well, left to right.
  const first = POPUP_W / 2;
  const step = POPUP_W + POPUP_GAP;
  const centres = Array.from({ length: count }, (_, index) => first + index * step);
  const mid = height / 2;
  const r = 8;
  // count >= 2 here, so both ends exist; naming them satisfies the checker
  // without an assertion that could hide a real gap later.
  const firstCentre = centres[0] ?? first;
  const lastCentre = centres[centres.length - 1] ?? first;

  return (
    <svg aria-hidden width={wellWidth} height={height} className="text-emerald-500 dark:text-emerald-400">
      {/* Stem down from the parent to the spine. */}
      <path d={`M${centre} 0 V${mid}`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
      <circle cx={centre} cy={mid} r="3.5" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
      {/* Spine, with a rounded turn down into each child. */}
      <path
        d={`M${firstCentre} ${mid + r} Q${firstCentre} ${mid} ${firstCentre + r} ${mid} H${lastCentre - r} Q${lastCentre} ${mid} ${lastCentre} ${mid + r}`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        fill="none"
      />
      {centres.map((x) => (
        <g key={x}>
          <path d={`M${x} ${mid + r} V${height - 8}`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
          <path d={`M${x - 4} ${height - 8} L${x} ${height - 1} L${x + 4} ${height - 8} Z`} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}


/** The explanatory footer — what the shapes and lines on the board mean. */
function BoardFooter({ screens, popups }: { screens: number; popups: number }) {
  const shapes = [
    {
      swatch: <span className="size-3 rounded-[3px] border-2 border-violet-400" aria-hidden />,
      title: 'Screen',
      body: 'A full page a user navigates to.',
    },
    {
      swatch: <span className="size-3 rounded-[3px] border-2 border-emerald-400" aria-hidden />,
      title: 'Popup / Modal',
      body: 'Opens on top of its parent screen.',
    },
    {
      swatch: (
        <svg width="20" height="10" viewBox="0 0 20 10" className="text-violet-500" aria-hidden>
          <path d="M0 5 H12" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 1.5 L19 5 L11 8.5 Z" fill="currentColor" />
        </svg>
      ),
      title: 'Main navigation',
      body: 'Solid line: the main flow between screens.',
    },
    {
      swatch: (
        <svg width="20" height="10" viewBox="0 0 20 10" className="text-emerald-500" aria-hidden>
          <path d="M0 5 H12" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
          <path d="M11 1.5 L19 5 L11 8.5 Z" fill="currentColor" />
        </svg>
      ),
      title: 'Opens popup',
      body: 'Dashed line: a popup belonging to a parent.',
    },
  ];

  return (
    <div className="bg-background shrink-0 border-t px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {shapes.map((shape) => (
          <div key={shape.title} className="flex min-w-[190px] flex-1 items-start gap-2.5">
            <span className="bg-muted/60 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border">
              {shape.swatch}
            </span>
            <span className="flex flex-col">
              <span className="text-[12px] font-semibold">{shape.title}</span>
              <span className="text-muted-foreground text-[11px] leading-snug">{shape.body}</span>
            </span>
          </div>
        ))}

        {/* Status vocabulary, in the order work moves through it. */}
        <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-[11px]">
          {(['In progress', 'Review', 'Done'] as const).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', STATUS_DOT[status])} aria-hidden />
              {status}
            </span>
          ))}
        </div>

        <div className="bg-muted/40 flex shrink-0 items-center gap-4 rounded-lg border px-4 py-2">
          <Layers className="text-muted-foreground size-4" aria-hidden />
          <span className="flex flex-col">
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">Total screens</span>
            <span className="text-sm font-semibold tabular-nums">{screens + popups}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">Screens</span>
            <span className="text-sm font-semibold tabular-nums">{screens}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">Popups</span>
            <span className="text-sm font-semibold tabular-nums">{popups}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function IAScreenFlow({
  rows,
  routeOf,
  screenIdOf,
  descriptionOf,
  onOpen,
  emptyLabel,
  otherLabel,
}: {
  rows: IARow[];
  routeOf: (row: IARow) => string;
  screenIdOf: (row: IARow) => string | null;
  descriptionOf: (row: IARow) => string;
  onOpen: (row: IARow) => void;
  emptyLabel: string;
  otherLabel: string;
}) {
  // The graph is rebuilt only when the rows change — never on zoom, pan or
  // selection, which are the interactions that happen most.
  const sections = useMemo(() => buildFlowSections(rows), [rows]);
  const numbers = useMemo(() => numberScreens(sections), [sections]);
  const totals = useMemo(
    () =>
      sections.reduce(
        (sum, section) => ({
          screens: sum.screens + section.screenCount,
          popups: sum.popups + section.popupCount,
        }),
        { screens: 0, popups: 0 },
      ),
    [sections],
  );

  const viewport = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  /** The board's unscaled layout size, which the scroll spacer is scaled from. */
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  /**
   * The visible width of the scroll area, in pixels.
   *
   * The board is `w-max`, so a section is only as wide as the cards in it and a
   * short one — or one narrowed by a search — stops mid-screen. Flooring the
   * board at this width lets every section panel run the full window.
   *
   * It has to be a real measurement: a percentage min-width on the board does
   * not resolve against the scroll area the way it appears it should, and
   * silently leaves the board at its content width.
   */
  const [viewWidth, setViewWidth] = useState(0);

  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const measure = () => setViewWidth(view.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    return () => observer.disconnect();
  }, []);

  // Remeasure whenever the board's own size changes — rows arriving, a
  // thumbnail loading, the window resizing. scrollWidth/Height ignore the
  // transform, so these stay the 100% dimensions at any zoom.
  useLayoutEffect(() => {
    const board = canvas.current;
    if (!board) return;
    const measure = () => setNatural({ w: board.scrollWidth, h: board.scrollHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [sections]);

  const clamp = (value: number) => Math.min(1.5, Math.max(0.3, value));

  /**
   * Scale so the widest section fits, but never blow a small board up past
   * 1:1. `scrollWidth` is a layout value and ignores the transform above it,
   * so it is the unscaled width whatever the current zoom happens to be.
   */
  const fitTo = useCallback((floor = 0.3) => {
    const view = viewport.current;
    const board = canvas.current;
    if (!view || !board) return;
    const width = board.scrollWidth;
    if (width <= 0) return;
    // When the board is only as wide as the floor above, the diagram already
    // fits and the width being measured is the floor itself — scaling to it
    // would shrink the board a little on every press.
    const floorWidth = viewWidth > 0 ? viewWidth / zoom : 0;
    if (width <= floorWidth + 1) {
      setZoom(1);
      view.scrollTo({ left: 0, top: 0 });
      return;
    }
    setZoom(clamp(Math.max(floor, Math.min(1, (view.clientWidth - 32) / width))));
    view.scrollTo({ left: 0, top: 0 });
  }, [viewWidth, zoom]);

  // Fit once the board has its real width, keeping a readable floor so a wide
  // role cannot shrink the whole diagram to something nobody can read.
  useLayoutEffect(() => {
    if (sections.length === 0) return;
    fitTo(0.75);
    // Deliberately keyed on the sections alone: refitting when `fitTo` changes
    // would refit on every zoom, undoing the zoom that just changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);


  // Panning writes scroll positions directly, so dragging never re-renders.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button,a,input')) return;
    const view = viewport.current;
    if (!view) return;
    drag.current = { x: event.clientX, y: event.clientY, left: view.scrollLeft, top: view.scrollTop };
    view.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const view = viewport.current;
    if (!start || !view) return;
    view.scrollLeft = start.left - (event.clientX - start.x);
    view.scrollTop = start.top - (event.clientY - start.y);
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    viewport.current?.releasePointerCapture(event.pointerId);
  };

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-xs">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {/* This wrapper has to be a flex column: the viewport inside it sizes
          itself with flex-1, and without a flex parent it grows to its content
          instead and spills under the footer, which then cannot be scrolled to. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative min-h-0 flex-1 cursor-grab overflow-auto active:cursor-grabbing"
      >
        <div style={{ width: natural.w * zoom, height: natural.h * zoom }}>
        <div
          ref={canvas}
          className="absolute w-max origin-top-left p-5 pb-14"
          /*
           * The board is `w-max`, so a section is only as wide as the cards in
           * it — a short section, or one narrowed by a search, stops mid-screen.
           * This floors it at the viewport width. The board is absolutely
           * positioned inside the scroll area, so `100%` already resolves to
           * that width without measuring anything; dividing by the zoom keeps
           * it right after the transform, which is applied post-layout.
           */
          style={{
            transform: `scale(${zoom})`,
            minWidth: viewWidth > 0 ? viewWidth / zoom : undefined,
          }}
        >
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <Fragment key={section.name || '__other'}>
              <section className="bg-background flex flex-col gap-3 rounded-xl border px-4 pt-3.5 pb-4 shadow-sm">
                <header className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 shrink-0 rounded-full bg-violet-500" aria-hidden />
                      <h2 className="text-[13px] font-bold tracking-[0.04em] uppercase">
                        {section.name || otherLabel}
                      </h2>
                      <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 tabular-nums dark:bg-violet-950 dark:text-violet-300">
                        {section.screenCount + section.popupCount}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {section.screenCount + section.popupCount === 1 ? 'screen' : 'screens'}
                      </span>
                    </div>
                    {/* Derived from the rows, never invented: the areas this
                        section actually contains, in board order. */}
                    <p className="text-muted-foreground mt-1 ml-3 text-[11.5px]">
                      {section.areas.map((area) => area.name).join(' · ')}
                    </p>
                  </div>
                </header>

                {/* Areas run left to right and wrap, so a wide role stays on
                    the board instead of running off the edge of it. */}
                <div className="flex flex-wrap items-start" style={{ gap: `28px 0` }}>
                  {section.areas.map((area, areaIndex) => {
                    /*
                     * An arrow has to reach the card, not the column edge. A
                     * card is centred in its column, so where a column is
                     * wider than a card — the ones carrying two popups — the
                     * card starts an overhang further in, and a fixed-width
                     * arrow stopped short of it with dead space after the head.
                     * Each arrow is therefore the gap plus the overhang it has
                     * to cross on either side.
                     */
                    const columns = area.screens.map(columnWidthOf);
                    // The gap is fixed; the arrow's line reaches across the
                    // overhangs on top of it without widening the layout.
                    const areaWidth =
                      columns.reduce((total, width) => total + width, 0) +
                      Math.max(0, columns.length - 1) * AREA_GAP;

                    // What the arrows either side of this area must also cross.
                    const leadIn = overhangOf(columns[0] ?? SCREEN_W);
                    const previous = section.areas[areaIndex - 1];
                    const leadOut = previous
                      ? overhangOf(columnWidthOf(previous.screens[previous.screens.length - 1] ?? { popups: [] }))
                      : 0;

                    return (
                      <div key={area.key} className="flex items-start">
                        {areaIndex > 0 && (
                          <MainArrow gap={AREA_GAP} leadOut={leadOut} leadIn={leadIn} offsetTop={AREA_HEAD_H} />
                        )}
                        <div className="flex flex-col gap-2.5" style={{ width: areaWidth }}>
                          <div className="rounded-lg bg-violet-50 py-1.5 text-center dark:bg-violet-950/40">
                            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-violet-700 uppercase dark:text-violet-300">
                              {area.name}
                            </h3>
                          </div>
                          <div className="flex items-start">
                            {area.screens.map((screen, index) => {
                              const columnWidth = columns[index] ?? SCREEN_W;
                              return (
                                <div key={screen.key} className="flex items-start">
                                  {index > 0 && (
                                    <MainArrow
                                      gap={AREA_GAP}
                                      leadOut={overhangOf(columns[index - 1] ?? SCREEN_W)}
                                      leadIn={overhangOf(columnWidth)}
                                    />
                                  )}
                                  <div
                                    className="flex flex-col items-center"
                                    style={{ width: columnWidth }}
                                  >
                                    <ScreenCard
                                      name={screen.name}
                                      row={screen.row}
                                      number={numbers.get(screen.key)}
                                      screenId={screenIdOf(screen.row)}
                                      route={routeOf(screen.row)}
                                      description={descriptionOf(screen.row)}
                                      onOpen={onOpen}
                                    />
                                    {screen.popups.length > 0 && (
                                      <>
                                        <PopupConnector count={screen.popups.length} wellWidth={columnWidth} />
                                        {/*
                                          No panel behind the popups. Every
                                          version of one — border, then tint —
                                          read as a glow around cards that
                                          already have a green border of their
                                          own. The dashed branch above is what
                                          says these belong to the same parent,
                                          and it says it without a backdrop.
                                        */}
                                        <div>
                                          <div className="flex items-stretch" style={{ gap: POPUP_GAP }}>
                                            {screen.popups.map((popup) => (
                                              <ScreenCard
                                                key={popup.key}
                                                popup
                                                name={popup.name}
                                                row={popup.row}
                                                number={numbers.get(popup.key)}
                                                screenId={screenIdOf(popup.row)}
                                                route={routeOf(popup.row)}
                                                description={descriptionOf(popup.row)}
                                                onOpen={onOpen}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              </Fragment>
            ))}
          </div>
        </div>
        </div>
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-md border bg-background/95 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setZoom((value) => clamp(value - 0.1))}
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1.5 transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="text-muted-foreground w-11 text-center font-mono text-[11px] tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((value) => clamp(value + 0.1))}
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1.5 transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="size-3.5" />
        </button>
        <span aria-hidden className="bg-border mx-0.5 h-4 w-px" />
        <button
          type="button"
          onClick={() => fitTo()}
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1.5 transition-colors"
          title="Fit to screen"
          aria-label="Fit to screen"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      </div>

      <BoardFooter screens={totals.screens} popups={totals.popups} />
    </div>
  );
}
