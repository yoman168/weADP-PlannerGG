/**
 * Contract between the Sketcher AI route (which shells out to the local
 * Claude Code CLI) and the canvas. Claude never mutates state directly — it
 * returns a list of operations that the client validates and applies, so an
 * unexpected response can never corrupt the canvas.
 */
import { z } from 'zod';
import {
  BLOCK_CATALOG,
  BUTTON_COLORS,
  BUTTON_VARIANTS,
  PATTERN_CATALOG,
  PROPERTY_SCHEMA,
  type BlockKind,
  type ButtonColor,
  type ButtonVariant,
  type CanvasBlock,
  type FieldSpec,
} from '@/lib/we-adk-mock/sketcher';

const BLOCK_KINDS = Object.keys(BLOCK_CATALOG) as [BlockKind, ...BlockKind[]];
const PATTERN_IDS = PATTERN_CATALOG.map((pattern) => pattern.id) as [string, ...string[]];

const buttonEntrySchema = z.object({
  label: z.string(),
  variant: z.enum(BUTTON_VARIANTS as [ButtonVariant, ...ButtonVariant[]]).default('outline'),
  color: z.enum(BUTTON_COLORS as [ButtonColor, ...ButtonColor[]]).default('default'),
});
const pairEntrySchema = z.object({ key: z.string(), value: z.string() });
const tabEntrySchema = z.object({ label: z.string(), count: z.number() });

/**
 * Numbers arrive from a language model, so accept "6", tolerate semantic widths
 * like "full", and drop anything unparseable instead of failing the whole
 * operation (the block then just keeps its default for that one prop).
 */
const looseNumber = z.preprocess((value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (/^(full|auto|100%)$/.test(text)) return 0;
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}, z.number().optional());

const looseInt = z.preprocess((value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : undefined;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}, z.number().int().optional());

/**
 * Mirrors BlockProps — every field optional so a patch can be partial.
 */
export const blockPropsSchema = z
  .object({
    label: z.string(),
    placeholder: z.string(),
    helpText: z.string(),
    value: z.string(),
    startValue: z.string(),
    endValue: z.string(),
    required: z.boolean(),
    checked: z.boolean(),
    width: looseNumber,
    height: looseNumber,
    align: z.string(),
    direction: z.string(),
    headingLevel: looseNumber,
    options: z.array(z.string()),
    quickRanges: z.array(z.string()),
    showQuickRanges: z.boolean(),
    activeIndex: looseNumber,
    columns: z.array(z.string()),
    rows: looseNumber,
    striped: z.boolean(),
    dense: z.boolean(),
    showHeader: z.boolean(),
    showActions: z.boolean(),
    buttons: z.array(buttonEntrySchema),
    pairs: z.array(pairEntrySchema),
    tabs: z.array(tabEntrySchema),
    badges: z.array(z.string()),
    tone: z.string(),
    progress: looseNumber,
  })
  .partial();

export const canvasOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    kind: z.enum(BLOCK_KINDS),
    index: looseInt,
    name: z.string().optional(),
    props: blockPropsSchema.optional(),
  }),
  z.object({
    op: z.literal('addPattern'),
    patternId: z.enum(PATTERN_IDS),
    index: looseInt,
  }),
  z.object({ op: z.literal('remove'), id: z.string() }),
  z.object({ op: z.literal('update'), id: z.string(), props: blockPropsSchema }),
  z.object({ op: z.literal('rename'), id: z.string(), name: z.string() }),
  z.object({ op: z.literal('move'), id: z.string(), index: looseInt }),
  z.object({ op: z.literal('setHidden'), id: z.string(), hidden: z.boolean() }),
  z.object({ op: z.literal('clear') }),
  z.object({ op: z.literal('reset') }),
]);

export const aiResponseSchema = z.object({
  reply: z.string(),
  operations: z.array(canvasOperationSchema).default([]),
});

export type CanvasOperation = z.infer<typeof canvasOperationSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;

/** Loose envelope: validate operations one by one so a single bad op can't discard the batch. */
const looseEnvelopeSchema = z.object({
  reply: z.string().optional(),
  operations: z.array(z.unknown()).optional(),
});

export interface ParsedAiResult {
  reply: string;
  operations: CanvasOperation[];
  /** Operations Claude sent that failed validation, with the reason, for surfacing to the user. */
  skipped: { raw: unknown; reason: string }[];
}

export function parseAiResult(input: unknown): ParsedAiResult | null {
  const envelope = looseEnvelopeSchema.safeParse(input);
  if (!envelope.success) return null;

  const operations: CanvasOperation[] = [];
  const skipped: { raw: unknown; reason: string }[] = [];
  for (const candidate of envelope.data.operations ?? []) {
    const parsed = canvasOperationSchema.safeParse(candidate);
    if (parsed.success) operations.push(parsed.data);
    else {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join('.') ?? '';
      skipped.push({
        raw: candidate,
        reason: `${path ? `${path}: ` : ''}${issue?.message ?? 'invalid'}`,
      });
    }
  }
  return { reply: envelope.data.reply ?? 'Done.', operations, skipped };
}

export const aiRequestSchema = z.object({
  instruction: z.string().min(1).max(2000),
  blocks: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      name: z.string(),
      hidden: z.boolean(),
      props: z.record(z.unknown()),
    }),
  ),
});

/** Renders a field's JSON type, so the model never has to guess (e.g. width is px, not "full"). */
function describeFieldType(spec: FieldSpec): string {
  switch (spec.type) {
    case 'text':
    case 'textarea':
      return 'string';
    case 'number':
      return `number${spec.hint ? ` — ${spec.hint}` : ''}`;
    case 'boolean':
      return 'boolean';
    case 'segment':
      return `string, one of ${spec.options.map((option) => `"${option}"`).join(' | ')}`;
    case 'stringList':
      return 'string[]';
    case 'pairList':
      return '{ key: string, value: string }[]';
    case 'tabList':
      return '{ label: string, count: number }[]';
    case 'buttonList':
      return `{ label: string, variant: ${BUTTON_VARIANTS.map((v) => `"${v}"`).join('|')}, color: ${BUTTON_COLORS.map((c) => `"${c}"`).join('|')} }[]`;
    case 'optionIndex':
      return `number — 0-based index into ${String(spec.from)}`;
    default:
      return 'string';
  }
}

/**
 * Compact, always-in-sync description of what Claude is allowed to build,
 * generated from the same catalog and property schema the inspector uses.
 */
export function describeCatalog(): string {
  const blocks = Object.values(BLOCK_CATALOG)
    .map((definition) => {
      const specs = PROPERTY_SCHEMA[definition.kind];
      const propList =
        specs.length > 0
          ? specs.map((spec) => `${String(spec.key)}: ${describeFieldType(spec)}`).join('; ')
          : 'none';
      return `- ${definition.kind} ("${definition.label}") props → ${propList}`;
    })
    .join('\n');
  const patterns = PATTERN_CATALOG.map(
    (pattern) =>
      `- ${pattern.id} ("${pattern.label}") → ${pattern.blocks.map((b) => b.kind).join(' + ')}`,
  ).join('\n');
  return `BLOCK KINDS:\n${blocks}\n\nPATTERNS:\n${patterns}`;
}

export function describeCanvas(blocks: CanvasBlock[]): string {
  if (blocks.length === 0) return 'The canvas is currently empty.';
  return blocks
    .map(
      (block, index) =>
        `${index}. id=${block.id} kind=${block.kind} name="${block.name}"${block.hidden ? ' (hidden)' : ''} props=${JSON.stringify(block.props)}`,
    )
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Meeting notes → whole screen sets (Sketcher's headline feature)     */
/* ------------------------------------------------------------------ */

export const generatedScreenSchema = z.object({
  name: z.string().min(1).max(80),
  route: z.string().max(120).optional(),
  rationale: z.string().max(400).optional(),
  blocks: z
    .array(
      z.object({
        kind: z.enum(BLOCK_KINDS),
        props: blockPropsSchema.optional(),
      }),
    )
    .min(1)
    .max(12),
});

export type GeneratedScreen = z.infer<typeof generatedScreenSchema>;

const looseGenerateEnvelope = z.object({
  reply: z.string().optional(),
  screens: z.array(z.unknown()).optional(),
});

export interface ParsedGeneration {
  reply: string;
  screens: GeneratedScreen[];
  skipped: string[];
}

/** Validates screen-by-screen so one malformed proposal can't discard the rest. */
export function parseGeneratedScreens(input: unknown): ParsedGeneration | null {
  const envelope = looseGenerateEnvelope.safeParse(input);
  if (!envelope.success) return null;

  const screens: GeneratedScreen[] = [];
  const skipped: string[] = [];
  for (const candidate of envelope.data.screens ?? []) {
    const parsed = generatedScreenSchema.safeParse(candidate);
    if (parsed.success) screens.push(parsed.data);
    else {
      const issue = parsed.error.issues[0];
      skipped.push(`${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'invalid'}`);
    }
  }
  return { reply: envelope.data.reply ?? 'Proposed screens from the notes.', screens, skipped };
}
