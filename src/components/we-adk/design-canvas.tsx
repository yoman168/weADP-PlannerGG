'use client';

/**
 * The Design tab's canvas — the screen, in the system's colours, clickable.
 *
 * Not `DesignThumbnail`: that renders its contents `aria-hidden` and
 * `pointer-events-none` because it is a picture for a list. Here the blocks are
 * the selection surface, so they are rendered directly with a hit target per
 * block and the same author-width-and-scale trick the thumbnail uses.
 *
 * Clicking a block selects the component spec that governs it. That mapping is
 * the point: a `datePicker` and an `autocomplete` are both an input field to a
 * design system, so both select the same spec, and editing it visibly changes
 * both on the canvas.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { cn } from '@/components/ui';
import { DeviceSwitcher, deviceWidth } from '@/components/we-adk/screen-preview';
import { BlockPreview } from '@/components/we-adk/sketcher/block-preview';
import { componentForBlock } from '@/lib/we-adk/design-block-map';
import { cssVarStyle, type ComponentPatch, type DesignSystem } from '@/lib/we-adk/design-systems';
import {
  BLOCK_CATALOG,
  loadScreenBlocks,
  type CanvasBlock,
  type DevicePresetId,
} from '@/lib/we-adk-mock/sketcher';

/** The width the designs are authored at. Everything scales off it. */
const AUTHOR_WIDTH = 1024;

/** Scope for the injected stylesheet. One canvas per page, so a constant is fine. */
const SCOPE = 'design-canvas-scope';

/**
 * Blocks with their authored per-element colours dropped.
 *
 * The sketcher lets a block pin a button to a literal palette colour — `red`,
 * `amber` — which renders as `bg-red-600 text-white`. Those are Tailwind palette
 * classes, not token references, so no amount of editing the design system moves
 * them: an authored-red button stays red under every system. Clearing the pin
 * lets the shared Button fall back to its token-driven variants, which is what
 * makes a design system preview mean anything.
 *
 * Reversible on purpose — the authored colours are a real decision someone made,
 * and the toggle is how you check whether a system can live with them.
 */
function systemColored(blocks: CanvasBlock[]): CanvasBlock[] {
  return blocks.map((block) => {
    if (!block.props.buttons?.length) return block;
    return {
      ...block,
      props: {
        ...block.props,
        buttons: block.props.buttons.map((button) => ({ ...button, color: 'default' as const })),
      },
    };
  });
}

/**
 * Where each component spec lands in the DOM.
 *
 * `BlockPreview` is the shared renderer, so the only handle on it is its markup:
 * the `data-slot` attributes the UI primitives set, plus a few element selectors
 * for the ones with no primitive of their own. Keeping the map here rather than
 * inline in the rule builder means adding a component is one entry, not a new
 * branch — and it is the one place to look when a spec appears to do nothing.
 */
const SELECTORS: Record<string, { box: string; height?: string; text?: string }> = {
  // A select trigger is a `button` element too, so it is excluded here and
  // picked up by the select entry — a select must match the input beside it,
  // not the button beside it.
  button: {
    box: 'button:not([data-slot="select-trigger"])',
    height: 'button:not([data-slot="select-trigger"])',
  },
  // A textarea takes the fill and radius but never the height: forcing a control
  // height on a multi-line field is how you get a one-line textarea.
  input: { box: 'input,textarea,[data-slot="input"]', height: 'input,[data-slot="input"]' },
  select: { box: '[data-slot="select-trigger"]', height: '[data-slot="select-trigger"]' },
  checkbox: { box: '[role="checkbox"],[data-slot="checkbox"]' },
  switch: { box: '[role="switch"],[data-slot="switch"]' },
  tab: {
    box: '[data-slot="tabs-list"],[role="tablist"]',
    height: '[data-slot="tabs-list"],[role="tablist"]',
  },
  chip: { box: '[data-slot="badge"]', height: '[data-slot="badge"]' },
  card: { box: '[data-slot="card"]' },
  // The row height is the density decision, so it goes on the rows rather than
  // on the table box.
  // The container, not the table: `border-radius` on a `table` draws a curve that
  // clips nothing, so a square header band sits over the rounded corner. The
  // container is a block with its own overflow, so rounding it actually cuts.
  table: {
    box: '[data-slot="table-container"],[data-slot="table"]>*,table',
    height: '[data-slot="table-row"],tbody tr',
  },
};

/**
 * The component specs, as CSS the preview will actually obey.
 *
 * The previews carry Tailwind utilities — `rounded-md h-8`, `bg-muted` — which a
 * custom property cannot reach, and some status tones are literal palette
 * classes with no token behind them at all. So the specs are applied as scoped
 * rules. `!important` earns its place: it is beating a utility class inside a
 * surface we own, and the alternative is a second preview renderer to keep in
 * sync with the first.
 */
function specStyles(
  system: DesignSystem,
  /** Block id → its exception, rendered as rules that outrank the system's. */
  blockOverrides: Record<string, ComponentPatch> = {},
  /** Block id → the component that governs it, so an override knows its selector. */
  blockComponents: Record<string, string> = {},
): string {
  const token = (name: string | null) =>
    name ? (system.colors.find((color) => color.name === name)?.value ?? null) : null;

  const rules: string[] = [];

  for (const spec of system.components) {
    const where = SELECTORS[spec.id];
    if (!where) continue;

    const scoped = (selector: string) =>
      selector
        .split(',')
        .map((part) => `.${SCOPE} ${part.trim()}`)
        .join(',');

    const decls: string[] = [];

    const radius = system.radius[spec.radius];
    if (radius) decls.push(`border-radius:${radius}!important`);

    const fill = token(spec.fill);
    if (fill) decls.push(`background-color:${fill}!important`);

    const text = token(spec.text);
    if (text) decls.push(`color:${text}!important`);

    const border = token(spec.border);
    // An explicit `none` has to erase the border, not just leave the shipped one
    // in place — otherwise the option does nothing and reads as broken.
    decls.push(
      border
        ? `border-color:${border}!important;border-width:1px!important;border-style:solid!important`
        : 'border-width:0!important',
    );

    if (decls.length > 0) rules.push(`${scoped(where.box)}{${decls.join(';')}}`);

    if (where.height) {
      rules.push(`${scoped(where.height)}{height:${spec.height}px!important}`);
    }
  }

  // The card's padding is its height field, and it goes on the sections rather
  // than on the card box.
  //
  // Forcing it on the box was wrong: a card holding an edge-to-edge table sets
  // `py-0` deliberately, and padding the box pushed the table off its own corners
  // — the rounded card clipped a square header that no longer lined up with it.
  // The sections are where shadcn puts padding, so that is where a change to it
  // belongs.
  const card = system.components.find((entry) => entry.id === 'card');
  if (card) {
    rules.push(
      `.${SCOPE} [data-slot="card-header"],.${SCOPE} [data-slot="card-content"],.${SCOPE} [data-slot="card-footer"]{padding:${card.height}px!important}`,
    );
  }

  // Block exceptions come last so they win on source order alone — both sides
  // use `!important`, and stacking specificity hacks to break that tie would be
  // worse than relying on the order they are written in.
  for (const [blockId, patch] of Object.entries(blockOverrides)) {
    const componentId = blockComponents[blockId];
    if (!componentId) continue;
    const where = SELECTORS[componentId];
    const spec = system.components.find((entry) => entry.id === componentId);
    if (!where || !spec) continue;

    const prefix = `.${SCOPE} [data-block-id="${blockId}"]`;
    const scoped = (selector: string) =>
      selector
        .split(',')
        .map((part) => `${prefix} ${part.trim()}`)
        .join(',');

    const decls: string[] = [];

    if (patch.radius) {
      const radius = system.radius[patch.radius];
      if (radius) decls.push(`border-radius:${radius}!important`);
    }
    if (patch.fill) {
      const fill = token(patch.fill);
      if (fill) decls.push(`background-color:${fill}!important`);
    }
    if (patch.text) {
      const text = token(patch.text);
      if (text) decls.push(`color:${text}!important`);
    }
    // `border` in the patch at all means it was set — including to null, which
    // must erase the border rather than fall through to the spec's.
    if ('border' in patch) {
      const border = token(patch.border ?? null);
      decls.push(
        border
          ? `border-color:${border}!important;border-width:1px!important;border-style:solid!important`
          : 'border-width:0!important',
      );
    }

    if (decls.length > 0) rules.push(`${scoped(where.box)}{${decls.join(';')}}`);

    if (patch.height !== undefined && where.height) {
      rules.push(`${scoped(where.height)}{height:${patch.height}px!important}`);
    }
    // The card's padding is its height, and it lands on the card box itself.
    if (patch.height !== undefined && componentId === 'card') {
      rules.push(
        `${prefix}[data-slot="card"],${prefix} [data-slot="card"]{padding:${patch.height}px!important;gap:${patch.height}px!important}`,
      );
    }
  }

  return rules.join('');
}

export function DesignCanvas({
  system,
  screen,
  blockOverrides,
  selectedBlockId,
  onSelect,
}: {
  system: DesignSystem;
  /** Null when a folder or the round is selected — there is no one screen then. */
  screen: { id: string; name: string } | null;
  /** Block id → its exception from the spec, so the canvas can draw both. */
  blockOverrides: Record<string, ComponentPatch>;
  selectedBlockId: string | null;
  onSelect: (selection: { blockId: string; componentId: string } | null) => void;
}) {
  const [device, setDevice] = useState<DevicePresetId>('full');
  const [blocks, setBlocks] = useState<CanvasBlock[] | null>(null);
  const [systemColours, setSystemColours] = useState(true);

  /** The frame, measured — `full` scales to whatever width the pane happens to be. */
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  /** The unscaled height of the rendered blocks, so the frame can reserve it. */
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);

  // Blocks live in localStorage, so they can only be read on the client. Reset to
  // null on a screen change or the previous screen's blocks flash in the new one.
  useEffect(() => {
    if (!screen) {
      setBlocks(null);
      return;
    }
    setBlocks(loadScreenBlocks(screen.id, 'listPage'));
    // A block id from the previous screen would either ring nothing or, worse,
    // ring an unrelated block that happens to share the id.
    onSelect(null);
  }, [screen?.id, screen]);

  // The pane resizes with the window and with the rail's tabs, so the fit width
  // has to be observed rather than read once.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrameWidth(entry.contentRect.width);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const shown = systemColours ? systemColored(blocks ?? []) : (blocks ?? []);
  const visible = shown.filter((block) => !block.hidden);

  // Which spec governs each block on screen, so a stored override can find the
  // selector it belongs to without the store having to remember it.
  const blockComponents: Record<string, string> = {};
  for (const block of visible) {
    const componentId = componentForBlock(block.kind);
    if (componentId) blockComponents[block.id] = componentId;
  }

  // `full` means "as wide as the pane"; the rest are real device widths. Either
  // way the sheet is authored at 1024 and scaled, and the scale never goes above
  // 1 — blowing a 1024px design up to 1440 would be a lie about the design.
  const presetWidth = deviceWidth(device);
  const targetWidth = presetWidth > 0 ? presetWidth : frameWidth || AUTHOR_WIDTH;
  const scale = Math.min(targetWidth / AUTHOR_WIDTH, 1);

  // A transform does not affect layout, so the scaled sheet contributes no
  // height and the frame would collapse. Measuring it is what makes the canvas
  // scroll through the whole screen instead of clipping at a fixed height.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) {
      setSheetHeight(0);
      return;
    }
    const observer = new ResizeObserver(() => setSheetHeight(sheet.scrollHeight));
    observer.observe(sheet);
    setSheetHeight(sheet.scrollHeight);
    return () => observer.disconnect();
  }, [visible.length, system, device]);

  return (
    // flex-1 so the frame gets the leftover height of the middle column — that
    // height is what it scrolls against.
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <header className="flex shrink-0 items-center gap-2">
        <MonitorSmartphone className="text-muted-foreground size-3.5" />
        <h3 className="text-[10px] font-semibold tracking-wider uppercase">Canvas</h3>
        <span className="text-muted-foreground min-w-0 truncate font-mono text-[11px]">
          {screen?.name ?? 'select a screen'}
        </span>
        <div className="flex-1" />
        <span className="text-muted-foreground shrink-0 text-[10px]">click a block to inspect</span>

        {/* Authored colours vs the system's. Off is the honest preview of what
            ships today; on is what the system would make of it. */}
        <button
          type="button"
          onClick={() => setSystemColours(!systemColours)}
          aria-pressed={systemColours}
          title={
            systemColours
              ? 'Showing system colours — authored per-button colours are ignored'
              : 'Showing authored colours — per-button palette colours override the system'
          }
          className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium',
            systemColours ? 'border-primary' : 'text-muted-foreground',
          )}
        >
          {systemColours ? 'System colours' : 'As authored'}
        </button>
        <DeviceSwitcher device={device} onChange={setDevice} />
      </header>

      {screen === null ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-12 text-center text-xs">
          Pick a design file in the tree to see it in these colours.
        </p>
      ) : blocks === null ? (
        <p className="text-muted-foreground rounded-xl border px-3 py-12 text-center text-xs">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-12 text-center text-xs">
          This screen has no blocks yet.
        </p>
      ) : (
        <div
          // The variables live on the wrapper rather than on each block so the
          // frame itself — border and backdrop — is in the system's palette too.
          style={cssVarStyle(system)}
          className={cn(
            SCOPE,
            // The frame scrolls, not the page: the inspector beside it has to
            // stay put while you scroll down a long screen.
            'bg-background border-border min-h-0 flex-1 overflow-auto rounded-xl border p-4',
            // Below xl the page is one column, so the frame needs a height of
            // its own or it grows to the full screen length and buries the rail.
            'max-xl:max-h-[36rem]',
          )}
        >
          {/* Scoped rather than global: these rules exist to make the preview
              obey the specs, and must not leak into the app chrome around it. */}
          <style>{specStyles(system, blockOverrides, blockComponents)}</style>

          <div ref={frameRef} className="w-full">
            {/* The scaled sheet is absolutely-positioned inside a box given the
                measured height, so the frame scrolls the whole screen. */}
            <div
              className="relative mx-auto"
              style={{
                width: scale * AUTHOR_WIDTH,
                height: sheetHeight * scale,
              }}
            >
              <div
                ref={sheetRef}
                className="absolute top-0 left-0 flex flex-col gap-6"
                style={{
                  width: AUTHOR_WIDTH,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {visible.map((block) => {
                  const componentId = componentForBlock(block.kind);
                  const selected = block.id === selectedBlockId;
                  const label = BLOCK_CATALOG[block.kind]?.label ?? block.kind;

                  return (
                    <div
                      key={block.id}
                      data-block-id={block.id}
                      role="button"
                      tabIndex={0}
                      aria-label={
                        componentId
                          ? `${label} — inspect ${componentId}`
                          : `${label} — governed by typography and spacing`
                      }
                      title={
                        componentId
                          ? `${label} → ${componentId}`
                          : `${label} — type and spacing, no component of its own`
                      }
                      onClick={() => {
                        if (!componentId) return;
                        onSelect({ blockId: block.id, componentId });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        if (!componentId) return;
                        onSelect({ blockId: block.id, componentId });
                      }}
                      className={cn(
                        // Padding, not a bare ring: a rounded outline drawn tight
                        // against edge-to-edge content cuts the corners of it. The
                        // negative margin keeps the block's own position, so the
                        // breathing room costs no layout.
                        'relative -mx-2 rounded-lg px-2 py-1.5 transition-shadow',
                        // Fixed black, never the theme's primary: the selection
                        // outline is chrome for this tool, and a token-driven
                        // ring vanishes the moment someone recolours primary to
                        // something close to the canvas.
                        componentId
                          ? 'cursor-pointer hover:ring-2 hover:ring-black/40'
                          : 'cursor-default',
                        selected && 'ring-2 ring-black',
                      )}
                    >
                      {/* The preview is inert so the click lands on the wrapper
                          rather than on an input or a button inside it. */}
                      <div className="pointer-events-none" aria-hidden>
                        <BlockPreview block={block} />
                      </div>

                      {selected && (
                        <span
                          // Right-aligned: a block's own label sits top-left, and
                          // the tag was covering it.
                          className="absolute -top-2 right-0 rounded bg-black px-1.5 text-[10px] font-medium text-white"
                          // Unscaled, so the tag stays readable at phone width.
                          style={{
                            transform: `scale(${1 / scale})`,
                            transformOrigin: 'top right',
                          }}
                        >
                          {componentId}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
