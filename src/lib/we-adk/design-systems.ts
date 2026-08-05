/**
 * Design systems, as data.
 *
 * The Design tool takes the designs a Business round produced — wireframe
 * blocks, no styling opinion of their own — and pairs them with one of these.
 * A system here is the same thing a hand-written DESIGN.md is: the tokens an
 * agent needs (colour, type, spacing, shape, elevation) plus the rules prose
 * cannot be derived from them (when an accent fires, what reflows at which
 * breakpoint, what never to do).
 *
 * Kept as data rather than as markdown files so the picker can render swatches
 * and type previews from the same source the exported DESIGN.md is written
 * from — one definition, so the preview cannot drift from the hand-off.
 */

import type { CSSProperties } from 'react';

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

export interface ColorToken {
  /** Token name as it appears in the exported YAML — `bg`, `ink`, `primary`. */
  name: string;
  /**
   * `#rrggbb`. Hex rather than the oklch the app authors in, because these are
   * editable in the Design tab and `<input type="color">` speaks hex only — a
   * token the picker cannot round-trip is a token nobody can adjust.
   */
  value: string;
  /** What this colour is for. Answers "when do I reach for it?" */
  role: string;
}

export interface TypeRole {
  family: string;
  /** Fallback stack, for the systems whose display face is not freely licensed. */
  fallback: string;
  weight: number;
  /** CSS letter-spacing, as authored. */
  tracking: string;
  /** Sizes this role is used at, largest first — `clamp()` allowed. */
  sizes: string[];
  notes: string;
}

/**
 * One component's design-system-level geometry.
 *
 * Only the properties a system actually decides. Not content, not state logic —
 * those belong to the screen. Colours are token *names* rather than values so a
 * recolour flows through every component that references the token, which is the
 * whole reason tokens exist.
 */
export interface ComponentSpec {
  id: string;
  name: string;
  /** Key into the system's radius map. */
  radius: string;
  /** Token name for the fill. */
  fill: string;
  /** Token name for the border, or null for a borderless component. */
  border: string | null;
  /** Token name for the text and icons on it. */
  text: string;
  /** Control height, or row height for the table. In px. */
  height: number;
  /** What the height means for this component, for the control's label. */
  heightLabel: string;
  notes: string;
}

/** How an accent gets chosen. The thing multi-accent systems usually leave out. */
export type AccentRule =
  | { kind: 'none' }
  /** Accent per category — the mapping is fixed, so the same thing is always the same colour. */
  | { kind: 'semantic'; map: Record<string, string> }
  /** Accent by position in a list, cycling in a fixed order. */
  | { kind: 'cycle'; order: string[] };

export interface DesignSystem {
  id: string;
  name: string;
  /** One line for the picker card. */
  tagline: string;
  /** The voice statement a DESIGN.md opens with. */
  identity: string;
  colors: ColorToken[];
  /** Which colour token the page sits on, for the preview frame. */
  canvasToken: string;
  /** Which colour token body text uses, for the preview frame. */
  inkToken: string;
  /**
   * App CSS variable → this system's token name.
   *
   * The screen canvas re-themes a real design preview by setting these as inline
   * custom properties on a wrapper: the previews are built from Tailwind classes
   * that already resolve through `--background`, `--primary` and friends, so
   * overriding the variables restyles the screen without touching the preview
   * component. Every system must map the full set or a screen previews half in
   * one look and half in another.
   */
  vars: Record<string, string>;
  accents: AccentRule;
  typography: { display: TypeRole; body: TypeRole };
  /** Base step in px; the scale is multiples of it. */
  spacingBase: number;
  spacingScale: number[];
  /** Radius per surface class, so a card and a chip cannot disagree by accident. */
  radius: Record<string, string>;
  /** The components the system has an opinion about. */
  components: ComponentSpec[];
  elevation: Record<string, string>;
  layout: {
    maxWidth: string;
    gutter: string;
    columns: number;
    /** Breakpoint → what actually reflows. Not just the px value. */
    reflow: { at: string; behaviour: string }[];
  };
  ux: string[];
  dos: string[];
  donts: string[];
  /** Where the system is silent — so the agent asks instead of inventing. */
  gaps: string[];
}

/* ------------------------------------------------------------------ */
/* Component specs                                                     */
/* ------------------------------------------------------------------ */

/**
 * The component set every system defines, built from that system's own token
 * names and density.
 *
 * A factory rather than nine hand-written literals per system: the set of
 * components is the same question asked of each system, and spelling it out
 * three times is how one system quietly ends up missing the switch.
 */
function componentSet(o: {
  /** Token names, in this system's vocabulary. */
  surface: string;
  canvas: string;
  ink: string;
  inkMuted: string;
  border: string;
  muted: string;
  primary: string;
  onPrimary: string;
  /** Radius keys for controls and for panels. */
  controlRadius: string;
  panelRadius: string;
  /** Height of a text input or button. */
  controlHeight: number;
  /** Height of a table row — the density decision. */
  rowHeight: number;
}): ComponentSpec[] {
  return [
    {
      id: 'button',
      name: 'Button',
      radius: o.controlRadius,
      fill: o.primary,
      border: null,
      text: o.onPrimary,
      height: o.controlHeight,
      heightLabel: 'Height',
      notes: 'One solid button per view. Everything else is outline or ghost.',
    },
    {
      id: 'input',
      name: 'Input field',
      radius: o.controlRadius,
      fill: o.surface,
      border: o.border,
      text: o.ink,
      height: o.controlHeight,
      heightLabel: 'Height',
      notes: 'Placeholder is muted ink, never a label substitute.',
    },
    {
      id: 'select',
      name: 'Select box',
      radius: o.controlRadius,
      fill: o.surface,
      border: o.border,
      text: o.ink,
      height: o.controlHeight,
      heightLabel: 'Height',
      notes: 'Matches the input exactly — a select that reads differently looks broken beside one.',
    },
    {
      id: 'checkbox',
      name: 'Checkbox',
      radius: 'sm',
      fill: o.surface,
      border: o.border,
      text: o.primary,
      height: 16,
      heightLabel: 'Box size',
      notes: 'Checked state fills with primary; the tick uses on-primary.',
    },
    {
      id: 'switch',
      name: 'Switch',
      radius: 'pill',
      fill: o.muted,
      border: null,
      text: o.primary,
      height: 20,
      heightLabel: 'Track height',
      notes: 'On is a primary track. Off is muted — never red, which reads as an error.',
    },
    {
      id: 'tab',
      name: 'Tab / segmented',
      radius: o.controlRadius,
      fill: o.muted,
      border: null,
      text: o.inkMuted,
      height: 28,
      heightLabel: 'Height',
      notes: 'The active tab lifts to the surface colour; the rail stays recessed.',
    },
    {
      id: 'chip',
      name: 'Status chip',
      radius: 'pill',
      fill: o.muted,
      border: null,
      text: o.ink,
      height: 20,
      heightLabel: 'Height',
      notes: 'Always carries a word. Colour alone is not a status.',
    },
    {
      id: 'card',
      name: 'Card',
      radius: o.panelRadius,
      fill: o.surface,
      border: o.border,
      text: o.ink,
      height: 16,
      heightLabel: 'Padding',
      notes: 'A border or a shadow, never both.',
    },
    {
      id: 'table',
      name: 'Table',
      radius: o.panelRadius,
      fill: o.surface,
      border: o.border,
      text: o.ink,
      height: o.rowHeight,
      heightLabel: 'Row height',
      notes: 'Sticky header, right-aligned figures, hairline rules — no zebra striping.',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* The systems                                                         */
/* ------------------------------------------------------------------ */

/**
 * What the WE-ADK and eACC screens are already built from: the shadcn
 * neutral tokens in globals.css. Listed first because picking it is the only
 * choice that changes nothing — the honest default.
 */
const weadkNeutral: DesignSystem = {
  id: 'weadk-neutral',
  name: 'WE-ADK Neutral',
  tagline: 'The tokens the app already ships. Picking it changes nothing.',
  identity:
    'A white canvas with near-black ink and no chrome of its own. Colour is reserved for state — a status chip, a spend bar going red — so a screen reads as structure first. This is the house style: it never competes with the content it frames.',
  canvasToken: 'background',
  inkToken: 'foreground',
  colors: [
    { name: 'background', value: '#ffffff', role: 'Page canvas.' },
    { name: 'foreground', value: '#0a0a0a', role: 'Body and heading ink.' },
    { name: 'card', value: '#ffffff', role: 'Raised surfaces — cards, popovers, the active nav tab.' },
    { name: 'muted', value: '#f5f5f5', role: 'Recessed tracks: sidebar rail, progress trough, hover fill.' },
    {
      name: 'muted-foreground',
      value: '#737373',
      role: 'Secondary text — labels, captions, inactive nav.',
    },
    { name: 'primary', value: '#262626', role: 'The one committing action per view.' },
    { name: 'on-primary', value: '#fafafa', role: 'Text and icons on a primary fill.' },
    { name: 'border', value: '#e5e5e5', role: 'Every hairline. Never a shadow where a border will do.' },
    { name: 'destructive', value: '#dc2626', role: 'Deletes, over-budget, failed runs.' },
    { name: 'ring', value: '#a1a1a1', role: 'Keyboard focus. Always visible, never removed.' },
  ],
  vars: {
    background: 'background',
    foreground: 'foreground',
    card: 'card',
    'card-foreground': 'foreground',
    popover: 'card',
    'popover-foreground': 'foreground',
    primary: 'primary',
    'primary-foreground': 'on-primary',
    secondary: 'muted',
    'secondary-foreground': 'foreground',
    muted: 'muted',
    'muted-foreground': 'muted-foreground',
    accent: 'muted',
    'accent-foreground': 'foreground',
    destructive: 'destructive',
    border: 'border',
    input: 'border',
    ring: 'ring',
  },
  accents: {
    kind: 'semantic',
    map: {
      Business: 'violet-500',
      Design: 'amber-500',
      Developer: 'sky-500',
      QA: 'emerald-500',
      Healthy: 'emerald-500',
      Warning: 'amber-500',
      Over: 'red-500',
    },
  },
  typography: {
    display: {
      family: 'system-ui',
      fallback: '-apple-system, "Segoe UI", sans-serif',
      weight: 600,
      tracking: '-0.01em',
      sizes: ['1.125rem', '1rem', '0.875rem'],
      notes:
        'Headings are small and tight — this is a tool, not a landing page. Nothing above 1.125rem inside the app shell.',
    },
    body: {
      family: 'system-ui',
      fallback: '-apple-system, "Segoe UI", sans-serif',
      weight: 400,
      tracking: '0',
      sizes: ['0.875rem', '0.8125rem', '0.75rem', '0.625rem'],
      notes:
        'Dense by design. 13px is the workspace default; 10px uppercase tracked-wide is the section-label voice.',
    },
  },
  spacingBase: 4,
  spacingScale: [2, 4, 6, 8, 12, 16, 24, 32, 48],
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.625rem',
    xl: '0.875rem',
    pill: '9999px',
  },
  components: componentSet({
    surface: 'card',
    canvas: 'background',
    ink: 'foreground',
    inkMuted: 'muted-foreground',
    border: 'border',
    muted: 'muted',
    primary: 'primary',
    onPrimary: 'on-primary',
    controlRadius: 'md',
    panelRadius: 'lg',
    controlHeight: 32,
    rowHeight: 36,
  }),
  elevation: {
    flat: 'none — a border carries the separation',
    raised: '0 1px 2px rgb(0 0 0 / 0.04)',
    overlay: '0 8px 24px rgb(0 0 0 / 0.12)',
  },
  layout: {
    maxWidth: 'none — the workspace fills the viewport',
    gutter: '1.5rem',
    columns: 12,
    reflow: [
      { at: '<640px', behaviour: 'Sidebar collapses to icons. Spend tracker and Archive drop out of the top bar.' },
      { at: '640–1024px', behaviour: 'Sidebar stays at 13rem. Content goes single-column; tables scroll in place.' },
      { at: '>1024px', behaviour: 'Full three-pane layout: rail, content, inspector.' },
    ],
  },
  ux: [
    'One primary action per view; everything else is outline or ghost.',
    'Destructive actions confirm in a dialog that names what is being destroyed.',
    'Every async surface has a loading and an empty state — never a blank pane.',
    'Focus is always visible. globals.css backstops any control that forgets its own ring.',
    'Anything that navigates or toggles shows a pointer cursor.',
  ],
  dos: [
    'Reach for a border before a shadow.',
    'Use the accent map — a tool keeps its colour everywhere it appears.',
    'Let long strings truncate; the layout must not grow to fit a name.',
  ],
  donts: [
    'No new hex values. If a token is missing, add it to globals.css.',
    'No decorative colour. Colour means state or identity, nothing else.',
    'No heading larger than 1.125rem inside the app shell.',
  ],
  gaps: [
    'Dark mode is defined for tokens but several screens still hardcode light hex.',
    'No charting palette beyond the five chart tokens.',
    'No motion spec — transitions are ad-hoc `transition-colors`.',
  ],
};

/**
 * The Adora system, as published at duply.ai/adora/design-md, with the two
 * things that reference is missing filled in: a fallback for the unlicensed
 * display face, and a rule for which accent fires when.
 */
const adora: DesignSystem = {
  id: 'adora',
  name: 'Adora',
  tagline: 'Warm off-white, indigo ink, four-colour accents. Playful but precise.',
  identity:
    'A warm off-white canvas with deep indigo ink and electric violet actions. Playful optimism held in check by precision: pill navigation, generously curved white cards, and a four-colour accent palette used semantically, never decoratively.',
  canvasToken: 'canvas',
  inkToken: 'ink',
  colors: [
    { name: 'canvas', value: '#f9f9f7', role: 'Page background. Warm, never pure white.' },
    { name: 'surface', value: '#ffffff', role: 'Cards and raised panels — the white that lifts off the canvas.' },
    { name: 'ink', value: '#21164c', role: 'Headings and body. Deep indigo, not black.' },
    { name: 'ink-muted', value: '#6b6486', role: 'Secondary text, captions, inactive nav.' },
    { name: 'primary', value: '#6d3bff', role: 'Electric violet. The committing action.' },
    { name: 'accent-violet', value: '#6d3bff', role: 'Accent 1.' },
    { name: 'accent-pink', value: '#ff5fa2', role: 'Accent 2.' },
    { name: 'accent-cyan', value: '#2fd3e1', role: 'Accent 3.' },
    { name: 'accent-lime', value: '#b6e33a', role: 'Accent 4. Decorative fills only — fails contrast as text.' },
    { name: 'hairline', value: '#e6e4de', role: 'Borders on the warm canvas.' },
    { name: 'muted', value: '#f1efe9', role: 'Recessed tracks and hover fills on the warm canvas.' },
    { name: 'on-primary', value: '#ffffff', role: 'Text and icons on a violet fill.' },
  ],
  vars: {
    background: 'canvas',
    foreground: 'ink',
    card: 'surface',
    'card-foreground': 'ink',
    popover: 'surface',
    'popover-foreground': 'ink',
    primary: 'primary',
    'primary-foreground': 'on-primary',
    secondary: 'muted',
    'secondary-foreground': 'ink',
    muted: 'muted',
    'muted-foreground': 'ink-muted',
    accent: 'muted',
    'accent-foreground': 'ink',
    destructive: 'accent-pink',
    border: 'hairline',
    input: 'hairline',
    ring: 'primary',
  },
  accents: {
    kind: 'cycle',
    order: ['accent-violet', 'accent-pink', 'accent-cyan', 'accent-lime'],
  },
  typography: {
    display: {
      family: 'PolySans',
      fallback: '"Plus Jakarta Sans", system-ui, sans-serif',
      weight: 600,
      tracking: '-0.03em',
      sizes: ['clamp(2.5rem, 5vw, 4rem)', '2rem', '1.5rem', '1.25rem'],
      notes:
        'Display only — never body. PolySans is not freely licensed, so the fallback matters: without it the voice silently collapses to the body face.',
    },
    body: {
      family: 'Plus Jakarta Sans',
      fallback: 'system-ui, -apple-system, sans-serif',
      weight: 500,
      tracking: '0',
      sizes: ['1.125rem', '1rem', '0.875rem', '0.75rem'],
      notes: 'Weight 500, not 400 — the system reads under-set at regular.',
    },
  },
  spacingBase: 4,
  spacingScale: [4, 8, 12, 16, 24, 32, 48, 64, 96],
  radius: {
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    pill: '9999px',
  },
  components: componentSet({
    surface: 'surface',
    canvas: 'canvas',
    ink: 'ink',
    inkMuted: 'ink-muted',
    border: 'hairline',
    muted: 'muted',
    primary: 'primary',
    onPrimary: 'on-primary',
    controlRadius: 'md',
    panelRadius: 'lg',
    // Roomier than the house style: this system is generous by identity, and a
    // 32px control under a 1.5rem card radius looks like a mistake.
    controlHeight: 44,
    rowHeight: 52,
  }),
  elevation: {
    flat: 'none — the white-on-warm contrast is the separation',
    raised: '0 2px 8px rgb(33 22 76 / 0.06)',
    overlay: '0 16px 48px rgb(33 22 76 / 0.14)',
  },
  layout: {
    maxWidth: '72rem',
    gutter: '1.5rem',
    columns: 12,
    reflow: [
      {
        at: '<640px',
        behaviour: 'Nav pill becomes a bottom sheet. Feature grids go 1-up. Display type drops to the clamp floor.',
      },
      { at: '640–1024px', behaviour: 'Feature grids go 2-up. Nav pill stays, loses its labels.' },
      { at: '>1024px', behaviour: 'Feature grids 3-up. Floating nav pill centred, max-width container.' },
    ],
  },
  ux: [
    'The floating nav pill stays fixed and centred; it never scrolls away.',
    'Accents cycle in fixed order across a set — the third card is always cyan, so the page reads the same twice.',
    'Cards are white on warm canvas with no border. Contrast does the separating.',
    'One violet button per section. A second one is a design error, not a choice.',
  ],
  dos: [
    'Pair every display face declaration with the fallback stack.',
    'Use lime for fills and illustration only — it fails contrast as text on canvas.',
    'Keep display and body roles strictly separate.',
  ],
  donts: [
    'No accent picked for looks. Position in the set decides it.',
    'No pure white page background — the warmth is the identity.',
    'No PolySans below 1.25rem.',
  ],
  gaps: [
    'Contrast ratios are asserted, not measured — cyan and lime on canvas need checking at small sizes.',
    'No dark mode. Every value here is light-only.',
    'No form, table, or data-density guidance — this is a marketing-surface system applied to an app.',
  ],
};

/** A denser, cooler variant for the eACC surfaces — same bones, enterprise voice. */
const eaccEnterprise: DesignSystem = {
  id: 'eacc-enterprise',
  name: 'eACC Enterprise',
  tagline: 'Cool grey, blue actions, table-first density. For data-heavy screens.',
  identity:
    'A cool grey shell around white data surfaces, with a single blue for action. Built for screens that are mostly table: tight rows, quiet borders, and no colour that is not carrying meaning. Reads as trustworthy rather than friendly.',
  canvasToken: 'canvas',
  inkToken: 'ink',
  colors: [
    { name: 'canvas', value: '#fafafa', role: 'Shell background — sidebar rail and top bar.' },
    { name: 'surface', value: '#ffffff', role: 'Data surfaces: tables, cards, the active nav tab.' },
    { name: 'ink', value: '#111827', role: 'Primary text and figures.' },
    { name: 'ink-muted', value: '#6b7280', role: 'Column headers, captions, inactive nav.' },
    { name: 'primary', value: '#2563eb', role: 'Actions and links. The only blue.' },
    { name: 'hairline', value: '#e5e7eb', role: 'Table rules and panel borders.' },
    { name: 'positive', value: '#059669', role: 'Reconciled, passed, within budget.' },
    { name: 'caution', value: '#d97706', role: 'Pending review, approaching a limit.' },
    { name: 'negative', value: '#dc2626', role: 'Rejected, failed, over budget.' },
    { name: 'muted', value: '#f3f4f6', role: 'Column header fill, hover rows, progress troughs.' },
    { name: 'on-primary', value: '#ffffff', role: 'Text and icons on a blue fill.' },
  ],
  vars: {
    background: 'surface',
    foreground: 'ink',
    card: 'surface',
    'card-foreground': 'ink',
    popover: 'surface',
    'popover-foreground': 'ink',
    primary: 'primary',
    'primary-foreground': 'on-primary',
    secondary: 'canvas',
    'secondary-foreground': 'ink',
    muted: 'muted',
    'muted-foreground': 'ink-muted',
    accent: 'canvas',
    'accent-foreground': 'ink',
    destructive: 'negative',
    border: 'hairline',
    input: 'hairline',
    ring: 'primary',
  },
  accents: {
    kind: 'semantic',
    map: {
      Positive: 'positive',
      Caution: 'caution',
      Negative: 'negative',
      Neutral: 'ink-muted',
    },
  },
  typography: {
    display: {
      family: 'Inter',
      fallback: 'system-ui, -apple-system, sans-serif',
      weight: 600,
      tracking: '-0.01em',
      sizes: ['1.25rem', '1.125rem', '1rem'],
      notes: 'Section headings only. Page identity comes from the breadcrumb, not from large type.',
    },
    body: {
      family: 'Inter',
      fallback: 'system-ui, -apple-system, sans-serif',
      weight: 400,
      tracking: '0',
      sizes: ['0.875rem', '0.8125rem', '0.75rem'],
      notes: 'Tabular numerals mandatory in any column of figures — proportional digits make totals unscannable.',
    },
  },
  spacingBase: 4,
  spacingScale: [2, 4, 6, 8, 12, 16, 20, 24, 32],
  radius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.5rem',
    pill: '9999px',
  },
  components: componentSet({
    surface: 'surface',
    canvas: 'canvas',
    ink: 'ink',
    inkMuted: 'ink-muted',
    border: 'hairline',
    muted: 'muted',
    primary: 'primary',
    onPrimary: 'on-primary',
    controlRadius: 'sm',
    panelRadius: 'md',
    // Density is the point on a finance surface — 36px rows, tight controls.
    controlHeight: 28,
    rowHeight: 36,
  }),
  elevation: {
    flat: 'none — borders everywhere',
    raised: '0 1px 2px rgb(0 0 0 / 0.05)',
    overlay: '0 10px 32px rgb(0 0 0 / 0.10)',
  },
  layout: {
    maxWidth: 'none — tables want the width',
    gutter: '1.5rem',
    columns: 12,
    reflow: [
      { at: '<640px', behaviour: 'Sidebar becomes a drawer. Tables become stacked key/value cards, not h-scroll.' },
      { at: '640–1024px', behaviour: 'Sidebar to icons. Tables scroll horizontally with the first column pinned.' },
      { at: '>1024px', behaviour: 'Sidebar at 14rem, full table width, inspector on demand.' },
    ],
  },
  ux: [
    'The header row is sticky in every scrolling table.',
    'Figures right-align, labels left-align, always.',
    'Status is a chip with a word in it — never colour alone.',
    'Bulk actions appear in a bar only once a row is selected.',
  ],
  dos: [
    'Use tabular numerals for every figure.',
    'Keep row height at 36px; density is the point.',
    'Show units and currency on the value, not only in the header.',
  ],
  donts: [
    'No zebra striping — a hairline rule is enough and survives dark mode.',
    'No second accent blue.',
    'No colour-only status.',
  ],
  gaps: [
    'No dark mode values.',
    'No empty-state or first-run guidance for tables.',
    'No print stylesheet, which a finance surface will eventually want.',
  ],
};

export const DESIGN_SYSTEMS: DesignSystem[] = [weadkNeutral, adora, eaccEnterprise];

/** What an unknown id falls back to. Named rather than `DESIGN_SYSTEMS[0]` so
 *  callers get a system, not a maybe-system. */
export const DEFAULT_DESIGN_SYSTEM = weadkNeutral;

export const DEFAULT_DESIGN_SYSTEM_ID = weadkNeutral.id;

export function findDesignSystem(id: string): DesignSystem | undefined {
  return DESIGN_SYSTEMS.find((system) => system.id === id);
}

/** The colour a token name resolves to, for previews. */
export function tokenColor(system: DesignSystem, name: string): string {
  return system.colors.find((color) => color.name === name)?.value ?? 'transparent';
}

/* ------------------------------------------------------------------ */
/* Overrides                                                           */
/* ------------------------------------------------------------------ */

/**
 * The edits the Design tab can make to a system.
 *
 * Deliberately a patch rather than a whole system: a round tunes a shipped
 * system, it does not author a new one. Keeping it sparse means an untouched
 * system stays byte-identical to its definition, and "has this been changed"
 * is answerable without diffing every field.
 *
 * Scope is on purpose too — colour, type, spacing, radius. Not the UX rules or
 * the reflow table, which are decisions the system made and a round has no
 * business quietly reversing.
 */
export interface SystemPatch {
  /** Token name → `#rrggbb`. */
  colors?: Record<string, string>;
  /** Radius key → CSS length. */
  radius?: Record<string, string>;
  /** Base spacing step in px. */
  spacingBase?: number;
  display?: TypePatch;
  body?: TypePatch;
  /** Component id → the fields edited on it. */
  components?: Record<string, ComponentPatch>;
}

export type ComponentPatch = Partial<
  Pick<ComponentSpec, 'radius' | 'fill' | 'border' | 'text' | 'height'>
>;

export type TypePatch = { family?: string; fallback?: string; weight?: number; tracking?: string };

/** Families the type controls offer. Web-safe plus the faces the systems name. */
export const FONT_CHOICES = [
  'system-ui',
  'Inter',
  'Plus Jakarta Sans',
  'PolySans',
  'Georgia',
  'IBM Plex Mono',
] as const;

export const WEIGHT_CHOICES = [400, 500, 600, 700] as const;

export const TRACKING_CHOICES = ['-0.03em', '-0.02em', '-0.01em', '0', '0.02em'] as const;

export const SPACING_BASE_CHOICES = [2, 4, 8] as const;

/** Whether a patch says anything at all. */
export function isPatched(patch: SystemPatch | undefined): boolean {
  if (!patch) return false;
  return (
    Object.keys(patch.colors ?? {}).length > 0 ||
    Object.keys(patch.radius ?? {}).length > 0 ||
    patch.spacingBase !== undefined ||
    Object.keys(patch.display ?? {}).length > 0 ||
    Object.keys(patch.body ?? {}).length > 0 ||
    Object.keys(patch.components ?? {}).length > 0
  );
}

function patchedType(role: TypeRole, patch: TypePatch | undefined): TypeRole {
  if (!patch) return role;
  return {
    ...role,
    family: patch.family ?? role.family,
    fallback: patch.fallback ?? role.fallback,
    weight: patch.weight ?? role.weight,
    tracking: patch.tracking ?? role.tracking,
  };
}

/**
 * The system as it currently stands, with the round's edits folded in.
 *
 * Returns the same object when nothing is patched, so an untouched system keeps
 * referential identity and the memoised markdown does not churn.
 */
export function withOverrides(
  system: DesignSystem,
  patch: SystemPatch | undefined,
): DesignSystem {
  if (!isPatched(patch) || !patch) return system;
  return {
    ...system,
    colors: system.colors.map((color) => {
      const next = patch.colors?.[color.name];
      return next ? { ...color, value: next } : color;
    }),
    radius: { ...system.radius, ...(patch.radius ?? {}) },
    spacingBase: patch.spacingBase ?? system.spacingBase,
    spacingScale:
      patch.spacingBase === undefined
        ? system.spacingScale
        : // The scale is multiples of the base, so rebasing it keeps the ratios
          // the system chose instead of leaving a 4px scale under an 8px base.
          system.spacingScale.map((step) =>
            Math.round((step / system.spacingBase) * patch.spacingBase!),
          ),
    typography: {
      display: patchedType(system.typography.display, patch.display),
      body: patchedType(system.typography.body, patch.body),
    },
    components: system.components.map((component) => {
      const fragment = patch.components?.[component.id];
      // `border` is nullable, so a spread would drop an explicit null back to
      // the shipped value — it has to be checked for presence, not truthiness.
      if (!fragment) return component;
      return {
        ...component,
        ...fragment,
        border: 'border' in fragment ? (fragment.border ?? null) : component.border,
      };
    }),
  };
}

/** Whether any field of a component has moved off what the system ships. */
export function isComponentEdited(
  system: DesignSystem,
  base: DesignSystem,
  id: string,
): boolean {
  const next = system.components.find((entry) => entry.id === id);
  const shipped = base.components.find((entry) => entry.id === id);
  if (!next || !shipped) return false;
  return (
    next.radius !== shipped.radius ||
    next.fill !== shipped.fill ||
    next.border !== shipped.border ||
    next.text !== shipped.text ||
    next.height !== shipped.height
  );
}

/** Whether a token has been moved off the value the system ships. */
export function isTokenEdited(system: DesignSystem, base: DesignSystem, name: string): boolean {
  return tokenColor(system, name) !== tokenColor(base, name);
}

/**
 * The inline custom properties that re-theme a design preview.
 *
 * The previews render through the app's own Tailwind tokens, so setting the
 * variables on a wrapper is all it takes — no per-system preview component, and
 * anything edited in the inspector shows up in the canvas immediately.
 *
 * `--radius` carries the shape too: the theme derives `radius-sm/md/lg/xl` from
 * it with `calc()`, so one variable moves every corner in the preview.
 */
export function cssVarStyle(system: DesignSystem): CSSProperties {
  const style: Record<string, string> = {};
  for (const [cssVar, token] of Object.entries(system.vars)) {
    style[`--${cssVar}`] = tokenColor(system, token);
  }
  style['--radius'] = system.radius.lg ?? '0.625rem';
  style.fontFamily = `${system.typography.body.family}, ${system.typography.body.fallback}`;
  return style as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* DESIGN.md                                                          */
/* ------------------------------------------------------------------ */

/** What the round contributes to the hand-off: which version, and its screens. */
export interface DesignMdSource {
  projectName: string;
  version: number;
  versionStatus: string;
  screens: { name: string; route?: string }[];
}

function yamlBlock(system: DesignSystem): string {
  const lines: string[] = ['```yaml', `name: ${system.name}`, 'colors:'];
  for (const color of system.colors) {
    lines.push(`  ${color.name}: '${color.value}' # ${color.role}`);
  }

  lines.push('accents:');
  if (system.accents.kind === 'cycle') {
    lines.push(`  rule: cycle # nth item of a set takes the nth colour, wrapping`);
    lines.push(`  order: [${system.accents.order.join(', ')}]`);
  } else if (system.accents.kind === 'semantic') {
    lines.push('  rule: semantic # the mapping is fixed; never pick for looks');
    for (const [key, value] of Object.entries(system.accents.map)) {
      lines.push(`  ${key}: ${value}`);
    }
  } else {
    lines.push('  rule: none # this system has no accent palette');
  }

  lines.push('typography:');
  for (const [role, type] of [
    ['display', system.typography.display],
    ['body', system.typography.body],
  ] as const) {
    lines.push(`  ${role}:`);
    lines.push(`    family: '${type.family}'`);
    lines.push(`    fallback: '${type.fallback}'`);
    lines.push(`    weight: ${type.weight}`);
    lines.push(`    tracking: '${type.tracking}'`);
    lines.push(`    sizes: [${type.sizes.map((size) => `'${size}'`).join(', ')}]`);
  }

  lines.push(`spacing:`);
  lines.push(`  base: ${system.spacingBase}px`);
  lines.push(`  scale: [${system.spacingScale.join(', ')}]`);

  lines.push('radius:');
  for (const [key, value] of Object.entries(system.radius)) {
    lines.push(`  ${key}: '${value}'`);
  }

  lines.push('elevation:');
  for (const [key, value] of Object.entries(system.elevation)) {
    lines.push(`  ${key}: '${value}'`);
  }

  lines.push('components:');
  for (const component of system.components) {
    lines.push(`  ${component.id}:`);
    lines.push(`    radius: ${component.radius}`);
    lines.push(`    fill: ${component.fill}`);
    lines.push(`    border: ${component.border ?? 'none'}`);
    lines.push(`    text: ${component.text}`);
    lines.push(`    ${component.heightLabel.toLowerCase().replace(/ /g, '_')}: ${component.height}px`);
  }

  lines.push('layout:');
  lines.push(`  maxWidth: '${system.layout.maxWidth}'`);
  lines.push(`  gutter: '${system.layout.gutter}'`);
  lines.push(`  columns: ${system.layout.columns}`);
  lines.push('```');
  return lines.join('\n');
}

/**
 * The hand-off file: the chosen system's tokens and rules, with the round's
 * screens named as the surfaces to build. This is what an agent is handed —
 * so it states the source round too, because a design system without the list
 * of screens it applies to is only half an instruction.
 */
export function designSystemToMarkdown(system: DesignSystem, source?: DesignMdSource): string {
  const parts: string[] = [];

  parts.push(`# ${system.name} — DESIGN.md`);
  parts.push(system.identity);

  if (source) {
    parts.push(
      [
        '## Source',
        '',
        `Applied to **${source.projectName}**, version ${source.version} (${source.versionStatus}) from Business › Main.`,
        '',
        source.screens.length === 0
          ? '_This round has no designs yet — there is nothing to style._'
          : source.screens
              .map((screen) => `- ${screen.name}${screen.route ? ` — \`${screen.route}\`` : ''}`)
              .join('\n'),
      ].join('\n'),
    );
  }

  parts.push(['## Tokens', '', yamlBlock(system)].join('\n'));

  parts.push(
    [
      '## Colour',
      '',
      ...system.colors.map((color) => `- \`${color.name}\` \`${color.value}\` — ${color.role}`),
    ].join('\n'),
  );

  parts.push(
    [
      '## Accent rule',
      '',
      system.accents.kind === 'cycle'
        ? `Accents cycle in fixed order: ${system.accents.order.join(' → ')}, wrapping. Position in the set decides the colour, so the same page renders the same way twice. Never pick an accent for looks.`
        : system.accents.kind === 'semantic'
          ? `Accents are semantic, not decorative. The mapping is fixed:\n\n${Object.entries(
              system.accents.map,
            )
              .map(([key, value]) => `- ${key} → \`${value}\``)
              .join('\n')}`
          : 'This system has no accent palette. Colour carries state only.',
    ].join('\n'),
  );

  parts.push(
    [
      '## Type',
      '',
      `**Display** — ${system.typography.display.family}, fallback \`${system.typography.display.fallback}\`, weight ${system.typography.display.weight}, tracking ${system.typography.display.tracking}. Sizes: ${system.typography.display.sizes.join(', ')}. ${system.typography.display.notes}`,
      '',
      `**Body** — ${system.typography.body.family}, fallback \`${system.typography.body.fallback}\`, weight ${system.typography.body.weight}, tracking ${system.typography.body.tracking}. Sizes: ${system.typography.body.sizes.join(', ')}. ${system.typography.body.notes}`,
      '',
      'Display and body roles never swap.',
    ].join('\n'),
  );

  parts.push(
    [
      '## Layout',
      '',
      `Max width ${system.layout.maxWidth}, ${system.layout.gutter} gutter, ${system.layout.columns}-column grid. Spacing is multiples of ${system.spacingBase}px: ${system.spacingScale.join(', ')}.`,
      '',
      '### Reflow',
      '',
      ...system.layout.reflow.map((entry) => `- **${entry.at}** — ${entry.behaviour}`),
    ].join('\n'),
  );

  parts.push(
    [
      '## Shape and elevation',
      '',
      ...Object.entries(system.radius).map(([key, value]) => `- radius \`${key}\` — ${value}`),
      '',
      ...Object.entries(system.elevation).map(([key, value]) => `- elevation \`${key}\` — ${value}`),
    ].join('\n'),
  );

  parts.push(
    [
      '## Components',
      '',
      'Geometry and token references per component. Colours are token names, not',
      'values — recolouring a token moves every component that references it.',
      '',
      ...system.components.map(
        (component) =>
          `- **${component.name}** — radius \`${component.radius}\` (${
            system.radius[component.radius] ?? '?'
          }), fill \`${component.fill}\`, border \`${component.border ?? 'none'}\`, text \`${
            component.text
          }\`, ${component.heightLabel.toLowerCase()} ${component.height}px. ${component.notes}`,
      ),
    ].join('\n'),
  );

  parts.push(['## UX rules', '', ...system.ux.map((rule) => `- ${rule}`)].join('\n'));

  parts.push(
    [
      "## Do's and don'ts",
      '',
      '**Do**',
      '',
      ...system.dos.map((entry) => `- ${entry}`),
      '',
      "**Don't**",
      '',
      ...system.donts.map((entry) => `- ${entry}`),
    ].join('\n'),
  );

  parts.push(
    [
      '## Known gaps',
      '',
      'Where this system is silent. Ask rather than invent:',
      '',
      ...system.gaps.map((gap) => `- ${gap}`),
    ].join('\n'),
  );

  return `${parts.join('\n\n')}\n`;
}
