'use client';

/**
 * The Design tab's properties panel.
 *
 * Modelled on the sketcher's block inspector, because it is the same job: a
 * thing is selected, and its properties are edited in place with the result
 * visible next to the controls. Here the selected thing is a design system, so
 * the properties are its tokens.
 *
 * Every control shows the value it is editing and marks itself when that value
 * has moved off what the system ships — an inspector that cannot tell you what
 * you changed is a list of defaults you have to remember.
 */

import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FONT_CHOICES,
  SPACING_BASE_CHOICES,
  TRACKING_CHOICES,
  WEIGHT_CHOICES,
  isComponentEdited,
  isTokenEdited,
  tokenColor,
  type ComponentPatch,
  type ComponentSpec,
  type DesignSystem,
  type TypePatch,
} from '@/lib/we-adk/design-systems';
import { cn } from '@/components/ui';

/**
 * The swatches offered per colour token.
 *
 * A fixed row rather than a full picker for the common case: most recolouring is
 * "make the button blue", and a palette answers that in one click. The native
 * picker is still there as the last chip for anything else.
 */
const SWATCHES = [
  '#0a0a0a',
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#334155',
] as const;

/* ------------------------------------------------------------------ */
/* Shared row furniture                                                */
/* ------------------------------------------------------------------ */

function Section({
  title,
  edited,
  onReset,
  children,
}: {
  title: string;
  /** How many values in this section have moved. Drives the section's reset. */
  edited?: number;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border p-3">
      <header className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold tracking-wider uppercase">{title}</h3>
        {edited !== undefined && edited > 0 && (
          <span className="text-muted-foreground text-[10px]">{edited} edited</span>
        )}
        <div className="flex-1" />
        {onReset && edited !== undefined && edited > 0 && (
          <button
            type="button"
            onClick={onReset}
            title={`Reset ${title.toLowerCase()}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 shrink-0 text-[11px]">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** A native select styled to sit in a row without looking like a form field. */
function Picker<T extends string | number>({
  value,
  options,
  onChange,
  edited,
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  edited?: boolean;
}) {
  return (
    <select
      value={String(value)}
      onChange={(event) =>
        onChange((typeof value === 'number' ? Number(event.target.value) : event.target.value) as T)
      }
      className={cn(
        'min-w-0 flex-1 rounded-md border px-2 py-1 text-[11px]',
        edited ? 'border-primary/50 font-medium' : 'bg-transparent',
      )}
    >
      {options.map((option) => (
        <option key={String(option)} value={String(option)}>
          {option}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Colour                                                             */
/* ------------------------------------------------------------------ */

function ColorRow({
  token,
  value,
  baseValue,
  onChange,
}: {
  token: string;
  value: string;
  baseValue: string;
  onChange: (next: string | null) => void;
}) {
  const moved = value !== baseValue;

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate font-mono text-[11px]" title={token}>
        {token}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-1">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            aria-label={`${token} ${swatch}`}
            aria-pressed={value.toLowerCase() === swatch}
            title={swatch}
            // The ring rather than a border, so selecting does not nudge the
            // row: a border would change the swatch's box size by 2px.
            className={cn(
              'size-5 shrink-0 rounded-full',
              value.toLowerCase() === swatch && 'ring-foreground ring-2 ring-offset-1',
            )}
            style={{ background: swatch }}
          />
        ))}

        {/* Anything outside the palette. The label wraps the input so the whole
            swatch is the hit area, not the 2px of chrome a bare input gives. */}
        <label
          className="relative ml-1 size-5 shrink-0 cursor-pointer overflow-hidden rounded-full border"
          title={`Custom — ${value}`}
        >
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`${token} custom colour`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      {moved ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          title={`Reset ${token} to ${baseValue}`}
          aria-label={`Reset ${token}`}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <RotateCcw className="size-3" />
        </button>
      ) : (
        // Holds the column so rows do not shift as edits come and go.
        <span aria-hidden className="size-3 shrink-0" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shape                                                              */
/* ------------------------------------------------------------------ */

/** Radius in px for the slider. The registry authors rem; the control speaks px. */
function radiusPx(value: string): number {
  if (value.endsWith('rem')) return Math.round(parseFloat(value) * 16);
  if (value.endsWith('px')) return Math.round(parseFloat(value));
  return 0;
}

function RadiusRow({
  name,
  value,
  baseValue,
  onChange,
}: {
  name: string;
  value: string;
  baseValue: string;
  onChange: (next: string | null) => void;
}) {
  const moved = value !== baseValue;
  const px = radiusPx(value);

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[11px]">{name}</span>

      {/* A live corner beside the slider: the number is meaningless at a glance
          and the whole point of the control is the shape it produces. */}
      <span
        aria-hidden
        className="border-foreground/40 size-5 shrink-0 border-t-2 border-l-2"
        style={{ borderTopLeftRadius: value }}
      />

      <input
        type="range"
        min={0}
        max={32}
        step={1}
        value={px}
        onChange={(event) => onChange(`${event.target.value}px`)}
        aria-label={`${name} radius`}
        className="min-w-0 flex-1"
      />

      <span className="text-muted-foreground w-10 shrink-0 text-right font-mono text-[10px]">
        {px}px
      </span>

      {moved ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          title={`Reset ${name} to ${baseValue}`}
          aria-label={`Reset ${name} radius`}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <RotateCcw className="size-3" />
        </button>
      ) : (
        <span aria-hidden className="size-3 shrink-0" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

/**
 * The selected component, drawn from its own spec.
 *
 * Each case reads only the spec — no hardcoded colour or radius — so a change in
 * the controls below is visible here without a second definition to keep in
 * sync. The previews are deliberately small and unlabelled: this answers "what
 * does 44px and a 1rem radius look like", not "how does this component behave".
 */
function ComponentPreview({ system, spec }: { system: DesignSystem; spec: ComponentSpec }) {
  const fill = tokenColor(system, spec.fill);
  const text = tokenColor(system, spec.text);
  const border = spec.border ? tokenColor(system, spec.border) : 'transparent';
  const radius = system.radius[spec.radius] ?? '0';
  const font = `${system.typography.body.family}, ${system.typography.body.fallback}`;
  const surface = tokenColor(system, system.canvasToken);

  const box = {
    background: fill,
    color: text,
    borderRadius: radius,
    border: spec.border ? `1px solid ${border}` : undefined,
    fontFamily: font,
    fontWeight: system.typography.body.weight,
  } as const;

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-lg border p-4"
      style={{ background: surface }}
    >
      {spec.id === 'button' && (
        <span
          className="inline-flex items-center px-3 text-[12px]"
          style={{ ...box, height: spec.height, lineHeight: `${spec.height}px` }}
        >
          New Expense
        </span>
      )}

      {(spec.id === 'input' || spec.id === 'select') && (
        <span
          className="inline-flex w-48 items-center justify-between px-3 text-[12px]"
          style={{ ...box, height: spec.height }}
        >
          <span style={{ color: tokenColor(system, 'muted-foreground') || text, opacity: 0.6 }}>
            {spec.id === 'input' ? 'Search…' : 'All statuses'}
          </span>
          {spec.id === 'select' && <span aria-hidden>⌄</span>}
        </span>
      )}

      {spec.id === 'checkbox' && (
        <span className="flex items-center gap-2" style={{ fontFamily: font, color: text }}>
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: spec.height,
              height: spec.height,
              borderRadius: radius,
              background: tokenColor(system, spec.text),
              border: spec.border ? `1px solid ${border}` : undefined,
            }}
          >
            <span
              className="text-[10px] leading-none"
              style={{ color: tokenColor(system, 'on-primary') }}
            >
              ✓
            </span>
          </span>
          <span className="text-[12px]">Include receipts</span>
        </span>
      )}

      {spec.id === 'switch' && (
        // Both states, because the off state is where a muted track that is too
        // close to the surface disappears.
        <span className="flex items-center gap-3">
          <span
            className="relative inline-block"
            style={{
              width: spec.height * 1.8,
              height: spec.height,
              borderRadius: radius,
              background: tokenColor(system, spec.text),
            }}
          >
            <span
              className="absolute top-1/2 -translate-y-1/2 rounded-full"
              style={{
                right: 2,
                width: spec.height - 4,
                height: spec.height - 4,
                background: tokenColor(system, 'on-primary'),
              }}
            />
          </span>
          <span
            className="relative inline-block"
            style={{
              width: spec.height * 1.8,
              height: spec.height,
              borderRadius: radius,
              background: fill,
            }}
          >
            <span
              className="absolute top-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: 2,
                width: spec.height - 4,
                height: spec.height - 4,
                background: tokenColor(system, system.canvasToken),
              }}
            />
          </span>
        </span>
      )}

      {spec.id === 'tab' && (
        <span
          className="inline-flex items-center p-0.5"
          style={{ background: fill, borderRadius: radius, fontFamily: font }}
        >
          {['List', 'Board', 'Calendar'].map((label, index) => (
            <span
              key={label}
              className="inline-flex items-center px-2.5 text-[11px]"
              style={{
                height: spec.height - 4,
                borderRadius: radius,
                // The active tab lifts to the surface; the rail stays recessed.
                background: index === 0 ? tokenColor(system, system.canvasToken) : 'transparent',
                color: index === 0 ? tokenColor(system, system.inkToken) : text,
                fontWeight: index === 0 ? 600 : system.typography.body.weight,
              }}
            >
              {label}
            </span>
          ))}
        </span>
      )}

      {spec.id === 'chip' && (
        <span className="flex items-center gap-1.5">
          {['Draft', 'Approved', 'Rejected'].map((label, index) => (
            <span
              key={label}
              className="inline-flex items-center px-2 text-[10px] font-medium"
              style={{
                height: spec.height,
                borderRadius: radius,
                fontFamily: font,
                background:
                  index === 1
                    ? `${tokenColor(system, 'primary')}22`
                    : index === 2
                      ? `${tokenColor(system, 'destructive')}22`
                      : fill,
                color:
                  index === 1
                    ? tokenColor(system, 'primary')
                    : index === 2
                      ? tokenColor(system, 'destructive')
                      : text,
              }}
            >
              {label}
            </span>
          ))}
        </span>
      )}

      {spec.id === 'card' && (
        <span className="inline-block w-52" style={{ ...box, padding: spec.height }}>
          <span className="block text-[11px] opacity-60">Total value</span>
          <span className="block text-[15px] font-semibold">₩4,299,279</span>
        </span>
      )}

      {spec.id === 'table' && (
        <span className="inline-block w-full overflow-hidden" style={box}>
          {['Date', 'Kim Minsu', 'Lee Jiyeon'].map((label, index) => (
            <span
              key={label}
              className="flex items-center justify-between px-3 text-[11px]"
              style={{
                height: spec.height,
                background: index === 0 ? tokenColor(system, 'muted') : 'transparent',
                borderBottom: index === 0 ? `1px solid ${border}` : undefined,
                fontWeight: index === 0 ? 600 : system.typography.body.weight,
                opacity: index === 0 ? 0.9 : 1,
              }}
            >
              <span>{label}</span>
              <span className="font-mono">{index === 0 ? 'Amount' : '50,000'}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function ComponentsSection({
  system,
  base,
  selectedId,
  scope,
  onScope,
  blockPatch,
  hasBlock,
  onComponent,
  onBlock,
}: {
  system: DesignSystem;
  base: DesignSystem;
  /** Owned by the page: the canvas selects, this panel edits. */
  selectedId: string;
  /** Whether edits land on the system's spec or on the one clicked block. */
  scope: 'system' | 'block';
  onScope: (next: 'system' | 'block') => void;
  /** The clicked block's exception, if it has one. */
  blockPatch: ComponentPatch | undefined;
  /** False when nothing is selected on the canvas — block scope is unavailable. */
  hasBlock: boolean;
  onComponent: (id: string, fragment: ComponentPatch | null) => void;
  onBlock: (fragment: ComponentPatch | null) => void;
}) {
  const spec = system.components.find((entry) => entry.id === selectedId) ?? system.components[0];
  const shipped = base.components.find((entry) => entry.id === selectedId) ?? base.components[0];

  if (!spec || !shipped) return null;

  // In block scope the controls show the block's values, so an exception reads as
  // the current state rather than as an invisible layer over the spec.
  const shownSpec: ComponentSpec =
    scope === 'block' && blockPatch
      ? {
          ...spec,
          ...blockPatch,
          border: 'border' in blockPatch ? (blockPatch.border ?? null) : spec.border,
        }
      : spec;

  /** Where an edit goes, and what "reset" means, follow the scope together. */
  const write = (fragment: ComponentPatch) =>
    scope === 'block' ? onBlock(fragment) : onComponent(spec.id, fragment);

  const editedCount = system.components.filter((entry) =>
    isComponentEdited(system, base, entry.id),
  ).length;

  const tokenNames = system.colors.map((color) => color.name);
  const radiusKeys = Object.keys(system.radius);
  const moved = isComponentEdited(system, base, spec.id);

  return (
    <Section
      // The selected component names the section: with the chip row gone, the
      // canvas is what selects, and the header is the only place left that can
      // say which spec these controls are editing.
      title={`Component · ${spec.name}`}
      edited={editedCount}
      onReset={() => {
        for (const entry of system.components) onComponent(entry.id, null);
      }}
    >
      {/* The scope, stated rather than implied. A design system means one card
          definition for every card, and that is the default — but it has to be
          visible, or the first shared edit reads as a bug. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onScope('block')}
          disabled={!hasBlock}
          aria-pressed={scope === 'block'}
          title={hasBlock ? 'Edit only the block selected on the canvas' : 'Select a block first'}
          className={cn(
            'flex-1 rounded-md border px-2 py-1 text-[11px]',
            scope === 'block' ? 'border-primary font-medium' : 'text-muted-foreground',
            !hasBlock && 'opacity-40',
          )}
        >
          This block
        </button>
        <button
          type="button"
          onClick={() => onScope('system')}
          aria-pressed={scope === 'system'}
          className={cn(
            'flex-1 rounded-md border px-2 py-1 text-[11px]',
            scope === 'system' ? 'border-primary font-medium' : 'text-muted-foreground',
          )}
        >
          All {spec.name.toLowerCase()}s
        </button>
      </div>

      {scope === 'block' && (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          {blockPatch
            ? 'This block overrides the system. It will not follow later changes to the spec.'
            : 'Edits here apply to this block only — an exception to the system.'}
        </p>
      )}

      <ComponentPreview system={system} spec={shownSpec} />

      <Row label="Radius">
        <Picker
          value={shownSpec.radius}
          options={radiusKeys}
          edited={shownSpec.radius !== shipped.radius}
          onChange={(radius) => write({ radius })}
        />
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {system.radius[shownSpec.radius]}
        </span>
      </Row>

      <Row label="Fill">
        <Picker
          value={shownSpec.fill}
          options={tokenNames}
          edited={shownSpec.fill !== shipped.fill}
          onChange={(fill) => write({ fill })}
        />
        <span
          className="size-4 shrink-0 rounded border"
          style={{ background: tokenColor(system, shownSpec.fill) }}
        />
      </Row>

      <Row label="Text">
        <Picker
          value={shownSpec.text}
          options={tokenNames}
          edited={shownSpec.text !== shipped.text}
          onChange={(text) => write({ text })}
        />
        <span
          className="size-4 shrink-0 rounded border"
          style={{ background: tokenColor(system, shownSpec.text) }}
        />
      </Row>

      <Row label="Border">
        <Picker
          // `none` is a real choice here, so it is an option rather than a
          // separate toggle nobody would find.
          value={shownSpec.border ?? 'none'}
          options={['none', ...tokenNames]}
          edited={shownSpec.border !== shipped.border}
          onChange={(border) => onComponent(spec.id, { border: border === 'none' ? null : border })}
        />
        <span
          className="size-4 shrink-0 rounded border"
          style={{
            background: shownSpec.border ? tokenColor(system, shownSpec.border) : 'transparent',
          }}
        />
      </Row>

      <Row label={spec.heightLabel}>
        <input
          type="range"
          min={12}
          max={72}
          step={1}
          value={shownSpec.height}
          onChange={(event) => write({ height: Number(event.target.value) })}
          aria-label={`${spec.name} ${spec.heightLabel.toLowerCase()}`}
          className="min-w-0 flex-1"
        />
        <span className="text-muted-foreground w-10 shrink-0 text-right font-mono text-[10px]">
          {shownSpec.height}px
        </span>
      </Row>

      <div className="flex items-start gap-2">
        <p className="text-muted-foreground flex-1 text-[10px] leading-relaxed">{spec.notes}</p>
        {(scope === 'block' ? !!blockPatch : moved) && (
          <button
            type="button"
            onClick={() => (scope === 'block' ? onBlock(null) : onComponent(spec.id, null))}
            title={`Reset ${spec.name}`}
            aria-label={`Reset ${spec.name}`}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                          */
/* ------------------------------------------------------------------ */

export interface InspectorHandlers {
  onColor: (token: string, value: string | null) => void;
  onRadius: (key: string, value: string | null) => void;
  onSpacingBase: (base: number | null) => void;
  onTypography: (role: 'display' | 'body', fragment: TypePatch) => void;
  onComponent: (id: string, fragment: ComponentPatch | null) => void;
  onBlock: (fragment: ComponentPatch | null) => void;
  onResetAll: () => void;
}

export function DesignInspector({
  system,
  base,
  selectedComponentId,
  componentScope,
  onComponentScope,
  blockPatch,
  hasBlock,
  handlers,
}: {
  /** The system with edits folded in — what every control displays. */
  system: DesignSystem;
  /** The system as shipped, so a control can say it has moved. */
  base: DesignSystem;
  selectedComponentId: string;
  /** System-wide spec, or the one block selected on the canvas. */
  componentScope: 'system' | 'block';
  onComponentScope: (next: 'system' | 'block') => void;
  blockPatch: ComponentPatch | undefined;
  hasBlock: boolean;
  handlers: InspectorHandlers;
}) {
  const [view, setView] = useState<'component' | 'system'>('component');

  // A click on the canvas has to land somewhere visible: if the system view was
  // open, selecting a block would otherwise change nothing on screen and read as
  // a dead click.
  useEffect(() => {
    setView('component');
  }, [selectedComponentId]);

  const colorsEdited = system.colors.filter((color) =>
    isTokenEdited(system, base, color.name),
  ).length;

  const radiusEdited = Object.keys(system.radius).filter(
    (key) => system.radius[key] !== base.radius[key],
  ).length;

  const typeEdited =
    (system.typography.display.family !== base.typography.display.family ? 1 : 0) +
    (system.typography.display.weight !== base.typography.display.weight ? 1 : 0) +
    (system.typography.display.tracking !== base.typography.display.tracking ? 1 : 0) +
    (system.typography.body.family !== base.typography.body.family ? 1 : 0) +
    (system.typography.body.weight !== base.typography.body.weight ? 1 : 0) +
    (system.typography.body.tracking !== base.typography.body.tracking ? 1 : 0);

  const spacingEdited = system.spacingBase !== base.spacingBase ? 1 : 0;

  const spec = system.components.find((entry) => entry.id === selectedComponentId);

  /**
   * The tokens this component actually references.
   *
   * Deriving them beats a hand-written "Button" section: a component that gets a
   * new fill token gains the row automatically, and there is no second place
   * holding a stale copy of which colour belongs to what.
   */
  const usedTokens = spec
    ? [...new Set([spec.fill, spec.text, spec.border].filter((name): name is string => !!name))]
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Clicking a block on the canvas is a request to change that component, so
          that is what opens: its own properties and the colours it references,
          and nothing else. The system-wide values are a deliberate second step —
          they move every screen, not the one being looked at. */}
      <div className="flex shrink-0 items-center gap-1">
        {(['component', 'system'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            aria-pressed={view === option}
            className={cn(
              'rounded-md px-2 py-1 text-[10px] font-semibold tracking-wider uppercase',
              view === option ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option === 'component' ? (spec?.name ?? 'component') : 'system'}
          </button>
        ))}
      </div>

      {view === 'component' ? (
        <>
          <ComponentsSection
            system={system}
            base={base}
            selectedId={selectedComponentId}
            scope={componentScope}
            onScope={onComponentScope}
            blockPatch={blockPatch}
            hasBlock={hasBlock}
            onComponent={handlers.onComponent}
            onBlock={handlers.onBlock}
          />

          {/* The colours this component uses, editable here so a recolour does
              not mean hunting the token list for which one the button was on. */}
          <Section
            title="Colours used"
            edited={usedTokens.filter((name) => isTokenEdited(system, base, name)).length}
            onReset={() => {
              for (const name of usedTokens) handlers.onColor(name, null);
            }}
          >
            {usedTokens.map((name) => (
              <ColorRow
                key={name}
                token={name}
                value={tokenColor(system, name)}
                baseValue={tokenColor(base, name)}
                onChange={(next) => handlers.onColor(name, next)}
              />
            ))}
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              These are shared tokens — changing one moves every component that references it, which
              is the point of a token.
            </p>
          </Section>
        </>
      ) : (
        <>
          {/* ---- Typography ---- */}
          <Section
            title="Typography"
            edited={typeEdited}
            onReset={() => {
              handlers.onTypography('display', {
                family: base.typography.display.family,
                weight: base.typography.display.weight,
                tracking: base.typography.display.tracking,
              });
              handlers.onTypography('body', {
                family: base.typography.body.family,
                weight: base.typography.body.weight,
                tracking: base.typography.body.tracking,
              });
            }}
          >
            <p
              className="mb-1 truncate"
              style={{
                fontFamily: `${system.typography.display.family}, ${system.typography.display.fallback}`,
                fontWeight: system.typography.display.weight,
                letterSpacing: system.typography.display.tracking,
                fontSize: '1.25rem',
              }}
            >
              {system.name}
            </p>

            <Row label="Display">
              <Picker
                value={system.typography.display.family}
                options={FONT_CHOICES}
                edited={system.typography.display.family !== base.typography.display.family}
                onChange={(family) => handlers.onTypography('display', { family })}
              />
              <Picker
                value={system.typography.display.weight}
                options={WEIGHT_CHOICES}
                edited={system.typography.display.weight !== base.typography.display.weight}
                onChange={(weight) => handlers.onTypography('display', { weight })}
              />
            </Row>
            <Row label="Tracking">
              <Picker
                value={system.typography.display.tracking}
                options={TRACKING_CHOICES}
                edited={system.typography.display.tracking !== base.typography.display.tracking}
                onChange={(tracking) => handlers.onTypography('display', { tracking })}
              />
            </Row>

            <Row label="Body">
              <Picker
                value={system.typography.body.family}
                options={FONT_CHOICES}
                edited={system.typography.body.family !== base.typography.body.family}
                onChange={(family) => handlers.onTypography('body', { family })}
              />
              <Picker
                value={system.typography.body.weight}
                options={WEIGHT_CHOICES}
                edited={system.typography.body.weight !== base.typography.body.weight}
                onChange={(weight) => handlers.onTypography('body', { weight })}
              />
            </Row>

            <p
              className="text-muted-foreground text-[11px] leading-relaxed"
              style={{
                fontFamily: `${system.typography.body.family}, ${system.typography.body.fallback}`,
                fontWeight: system.typography.body.weight,
                letterSpacing: system.typography.body.tracking,
              }}
            >
              Body text at {system.typography.body.weight}. Display and body never swap roles.
            </p>
          </Section>

          {/* ---- Spacing ---- */}
          <Section
            title="Spacing"
            edited={spacingEdited}
            onReset={() => handlers.onSpacingBase(null)}
          >
            <Row label="Base step">
              {SPACING_BASE_CHOICES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handlers.onSpacingBase(option)}
                  aria-pressed={system.spacingBase === option}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px]',
                    system.spacingBase === option
                      ? 'border-primary font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {option}px
                </button>
              ))}
            </Row>

            {/* The scale as bars: the base step alone says nothing about the rhythm
            it produces, and the rhythm is the thing being chosen. */}
            <Row label="Scale">
              <div className="flex min-w-0 flex-1 items-end gap-1 overflow-hidden">
                {system.spacingScale.map((step, index) => (
                  <span
                    key={`${step}-${index}`}
                    title={`${step}px`}
                    className="bg-muted-foreground/30 h-4 shrink-0"
                    style={{ width: Math.max(step, 2) }}
                  />
                ))}
              </div>
            </Row>
          </Section>

          {/* ---- Shape ---- */}
          <Section
            title="Shape · border radius"
            edited={radiusEdited}
            onReset={() => {
              for (const key of Object.keys(system.radius)) handlers.onRadius(key, null);
            }}
          >
            {Object.entries(system.radius)
              // `pill` is 9999px by definition — a slider over it is a control that
              // can only produce a wrong answer.
              .filter(([key]) => key !== 'pill')
              .map(([key, value]) => (
                <RadiusRow
                  key={key}
                  name={key}
                  value={value}
                  baseValue={base.radius[key] ?? value}
                  onChange={(next) => handlers.onRadius(key, next)}
                />
              ))}
          </Section>

          {/* ---- Every other colour ---- */}
          <Section
            title="Colour"
            edited={colorsEdited}
            onReset={() => {
              for (const color of system.colors) handlers.onColor(color.name, null);
            }}
          >
            {system.colors.map((color) => (
              <ColorRow
                key={color.name}
                token={color.name}
                value={color.value}
                baseValue={tokenColor(base, color.name)}
                onChange={(next) => handlers.onColor(color.name, next)}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
