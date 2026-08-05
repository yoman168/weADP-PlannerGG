/**
 * Which component spec a canvas block is governed by.
 *
 * The Business blocks and the design system's components are two vocabularies
 * for the same things: a `datePicker` block and an `autocomplete` block are both
 * an input field as far as a design system is concerned, so they answer to the
 * same spec. Mapping them here rather than in the canvas keeps the click target
 * and the exported DESIGN.md agreeing about what governs what.
 *
 * `null` means the block carries no component of its own — its look comes from
 * typography and spacing, so clicking it should point at those, not invent a
 * component to blame.
 */

import type { BlockKind } from '@/lib/we-adk-mock/sketcher';

export type ComponentTarget = string | null;

const MAP: Record<BlockKind, ComponentTarget> = {
  // Text and rhythm — no component.
  heading: null,
  paragraph: null,
  caption: null,
  divider: null,
  spacer: null,

  // The header's action buttons are the reason it maps to button rather than
  // card: the title is type, but the thing anyone recolours is the button.
  screenHeader: 'button',
  buttonBar: 'button',

  input: 'input',
  textarea: 'input',
  autocomplete: 'input',
  datePicker: 'input',
  dateRange: 'input',

  select: 'select',
  checkbox: 'checkbox',
  radioGroup: 'checkbox',

  switch: 'switch',
  toggleList: 'switch',

  segmented: 'tab',
  statusTabs: 'tab',

  badgeRow: 'chip',

  table: 'table',
  taskList: 'table',
  fileList: 'table',
  timeline: 'table',

  // Everything that is a panel with content in it. A filter bar is a card full
  // of inputs, but the box itself is what its own spec governs.
  filterBar: 'card',
  formGrid: 'card',
  statCards: 'card',
  keyValue: 'card',
  emptyState: 'card',
  banner: 'card',
  metricBars: 'card',
  progressSummary: 'card',
};

export function componentForBlock(kind: BlockKind): ComponentTarget {
  return MAP[kind] ?? null;
}
