'use client';

import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  cn,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import {
  BLOCK_CATALOG,
  BUTTON_COLORS,
  BUTTON_VARIANT_LABELS,
  BUTTON_VARIANTS,
  PROPERTY_SCHEMA,
  type BlockProps,
  type ButtonColor,
  type ButtonEntry,
  type ButtonVariant,
  type CanvasBlock,
  type FieldSpec,
  type FilterControl,
  type PairEntry,
  type TabEntry,
} from '@/lib/we-adk-mock/sketcher';
import { BUTTON_COLOR_SWATCH, buttonColorClass } from './button-styles';

/* ---------------------------- read helpers ---------------------------- */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function asBoolean(value: unknown): boolean {
  return value === true;
}
function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}
function asPairList(value: unknown): PairEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is PairEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { key?: unknown }).key === 'string' &&
      typeof (entry as { value?: unknown }).value === 'string',
  );
}
function asTabList(value: unknown): TabEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is TabEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { label?: unknown }).label === 'string' &&
      typeof (entry as { count?: unknown }).count === 'number',
  );
}
const CONTROL_TYPES: FilterControl['type'][] = [
  'search',
  'select',
  'dateRange',
  'checkbox',
  'text',
];

const CONTROL_LABELS: Record<FilterControl['type'], string> = {
  search: 'Search box',
  select: 'Dropdown',
  dateRange: 'Date range',
  checkbox: 'Checkbox',
  text: 'Text field',
};

function asControlList(value: unknown): FilterControl[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): FilterControl[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const candidate = entry as Partial<FilterControl>;
    const type = CONTROL_TYPES.includes(candidate.type as FilterControl['type'])
      ? (candidate.type as FilterControl['type'])
      : 'search';
    return [
      {
        type,
        label: typeof candidate.label === 'string' ? candidate.label : undefined,
        placeholder: typeof candidate.placeholder === 'string' ? candidate.placeholder : undefined,
        options: Array.isArray(candidate.options)
          ? candidate.options.filter((option): option is string => typeof option === 'string')
          : undefined,
        activeIndex: typeof candidate.activeIndex === 'number' ? candidate.activeIndex : undefined,
        checked: candidate.checked === true ? true : undefined,
      },
    ];
  });
}

function asButtonList(value: unknown): ButtonEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ButtonEntry[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const candidate = entry as { label?: unknown; variant?: unknown; color?: unknown };
    if (typeof candidate.label !== 'string') return [];
    // Normalise anything unexpected (or a canvas saved before colours existed).
    const variant = BUTTON_VARIANTS.includes(candidate.variant as ButtonVariant)
      ? (candidate.variant as ButtonVariant)
      : 'outline';
    const color = BUTTON_COLORS.includes(candidate.color as ButtonColor)
      ? (candidate.color as ButtonColor)
      : 'default';
    return [{ label: candidate.label, variant, color }];
  });
}

function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(index, 1);
  if (moved === undefined) return list;
  next.splice(target, 0, moved);
  return next;
}

/* ---------------------------- sub-editors ---------------------------- */

function RowActions({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={t('misc.moveUp')}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
      >
        <ArrowUp className="size-3" />
      </button>
      <button
        type="button"
        aria-label={t('misc.moveDown')}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
      >
        <ArrowDown className="size-3" />
      </button>
      <button
        type="button"
        aria-label={t('misc.remove')}
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive p-0.5"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function StringListEditor({
  items,
  itemLabel,
  onChange,
}: {
  items: string[];
  itemLabel: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            value={item}
            onChange={(event) => {
              const next = [...items];
              next[index] = event.target.value;
              onChange(next);
            }}
            className="h-7 text-xs"
          />
          <RowActions
            index={index}
            length={items.length}
            onMove={(delta) => onChange(moveItem(items, index, delta))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 justify-start gap-1 text-xs"
        onClick={() => onChange([...items, `${itemLabel} ${items.length + 1}`])}
      >
        <Plus className="size-3" />
        Add {itemLabel.toLowerCase()}
      </Button>
    </div>
  );
}

function PairListEditor({
  items,
  keyHeader,
  valueHeader,
  onChange,
}: {
  items: PairEntry[];
  keyHeader: string;
  valueHeader: string;
  onChange: (next: PairEntry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground flex gap-1 text-[10px]">
        <span className="flex-1">{keyHeader}</span>
        <span className="flex-1">{valueHeader}</span>
        <span className="w-14" />
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            value={item.key}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, key: event.target.value };
              onChange(next);
            }}
            className="h-7 flex-1 text-xs"
          />
          <Input
            value={item.value}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, value: event.target.value };
              onChange(next);
            }}
            className="h-7 flex-1 text-xs"
          />
          <RowActions
            index={index}
            length={items.length}
            onMove={(delta) => onChange(moveItem(items, index, delta))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 justify-start gap-1 text-xs"
        onClick={() => onChange([...items, { key: 'Label', value: 'Value' }])}
      >
        <Plus className="size-3" />
        Add row
      </Button>
    </div>
  );
}

function TabListEditor({
  items,
  onChange,
}: {
  items: TabEntry[];
  onChange: (next: TabEntry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground flex gap-1 text-[10px]">
        <span className="flex-1">Label</span>
        <span className="w-14">Count</span>
        <span className="w-14" />
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            value={item.label}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, label: event.target.value };
              onChange(next);
            }}
            className="h-7 flex-1 text-xs"
          />
          <Input
            type="number"
            value={item.count}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, count: Number(event.target.value) || 0 };
              onChange(next);
            }}
            className="h-7 w-14 text-xs"
          />
          <RowActions
            index={index}
            length={items.length}
            onMove={(delta) => onChange(moveItem(items, index, delta))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 justify-start gap-1 text-xs"
        onClick={() => onChange([...items, { label: 'New tab', count: 0 }])}
      >
        <Plus className="size-3" />
        Add tab
      </Button>
    </div>
  );
}

/**
 * Edits a list of rows — a settings toggle, a task, a history entry, a metric.
 * They share the same shape (title, description, and one extra), so they share
 * one editor rather than four near-identical ones.
 */
function RowListEditor({
  items,
  row,
  onChange,
}: {
  items: PairEntry[];
  row: 'toggle' | 'task' | 'plain' | 'metric';
  onChange: (next: PairEntry[]) => void;
}) {
  const { t } = useLocale();
  const patch = (index: number, entry: Partial<PairEntry>) => {
    const current = items[index];
    if (!current) return;
    const next = [...items];
    next[index] = { ...current, ...entry };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1.5 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Input
              value={item.key}
              onChange={(event) => patch(index, { key: event.target.value })}
              placeholder={t('prop.title')}
              className="h-7 flex-1 text-xs"
            />
            <RowActions
              index={index}
              length={items.length}
              onMove={(delta) => onChange(moveItem(items, index, delta))}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>

          <Input
            value={item.value}
            onChange={(event) => patch(index, { value: event.target.value })}
            placeholder={row === 'metric' ? 'Amount' : 'Description'}
            className="h-7 text-xs"
          />

          {row === 'task' && (
            <div className="flex items-center gap-1.5">
              <Input
                value={item.note ?? ''}
                onChange={(event) => patch(index, { note: event.target.value })}
                placeholder={t('prop.meta')}
                className="h-7 flex-1 text-xs"
              />
              <Select
                value={item.tone ?? 'neutral'}
                onValueChange={(value) => patch(index, { tone: value as PairEntry['tone'] })}
              >
                <SelectTrigger size="sm" className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['neutral', 'blue', 'green', 'amber', 'red'] as const).map((tone) => (
                    <SelectItem key={tone} value={tone} className="text-xs">
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {row === 'toggle' && (
            <label className="text-muted-foreground flex items-center gap-2 text-[11px]">
              <Switch
                checked={item.checked === true}
                onCheckedChange={(checked) => patch(index, { checked })}
              />
              On by default
            </label>
          )}

          {row === 'metric' && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-10 shrink-0 text-[10px]">Bar %</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={item.progress ?? 0}
                onChange={(event) => patch(index, { progress: Number(event.target.value) || 0 })}
                className="h-7 flex-1 text-xs"
              />
            </div>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => onChange([...items, { key: 'New row', value: '' }])}
      >
        <Plus className="size-3" />
        Add row
      </Button>
    </div>
  );
}

/** Edits the controls inside a filter bar: what each one is, and what it says. */
function ControlListEditor({
  items,
  onChange,
}: {
  items: FilterControl[];
  onChange: (next: FilterControl[]) => void;
}) {
  const { t } = useLocale();
  const patch = (index: number, entry: Partial<FilterControl>) => {
    const current = items[index];
    if (!current) return;
    const next = [...items];
    next[index] = { ...current, ...entry };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1.5 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Select
              value={item.type}
              onValueChange={(value) => patch(index, { type: value as FilterControl['type'] })}
            >
              <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTROL_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {CONTROL_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RowActions
              index={index}
              length={items.length}
              onMove={(delta) => onChange(moveItem(items, index, delta))}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>

          <Input
            value={item.label ?? ''}
            onChange={(event) => patch(index, { label: event.target.value })}
            placeholder={t('prop.labelOptional')}
            className="h-7 text-xs"
          />

          {(item.type === 'search' || item.type === 'text') && (
            <Input
              value={item.placeholder ?? ''}
              onChange={(event) => patch(index, { placeholder: event.target.value })}
              placeholder={t('prop.placeholder')}
              className="h-7 text-xs"
            />
          )}

          {item.type === 'select' && (
            <Input
              value={(item.options ?? []).join(', ')}
              onChange={(event) =>
                patch(index, {
                  options: event.target.value
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean),
                })
              }
              placeholder={t('prop.optionsComma')}
              className="h-7 text-xs"
            />
          )}

          {item.type === 'checkbox' && (
            <label className="text-muted-foreground flex items-center gap-2 text-[11px]">
              <Switch
                checked={item.checked === true}
                onCheckedChange={(checked) => patch(index, { checked })}
              />
              Checked
            </label>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => onChange([...items, { type: 'search', placeholder: 'Search…' }])}
      >
        <Plus className="size-3" />
        Add filter
      </Button>
    </div>
  );
}

function ButtonListEditor({
  items,
  onChange,
}: {
  items: ButtonEntry[];
  onChange: (next: ButtonEntry[]) => void;
}) {
  const { t } = useLocale();
  const patch = (index: number, entry: Partial<ButtonEntry>) => {
    const current = items[index];
    if (!current) return;
    const next = [...items];
    next[index] = { ...current, ...entry };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1.5 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Input
              value={item.label}
              onChange={(event) => patch(index, { label: event.target.value })}
              placeholder={t('prop.buttonLabel')}
              className="h-7 flex-1 text-xs"
            />
            <RowActions
              index={index}
              length={items.length}
              onMove={(delta) => onChange(moveItem(items, index, delta))}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground w-8 shrink-0 text-[10px]">Type</span>
            <Select
              value={item.variant}
              onValueChange={(value) => patch(index, { variant: value as ButtonVariant })}
            >
              <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUTTON_VARIANTS.map((variant) => (
                  <SelectItem key={variant} value={variant} className="text-xs">
                    {BUTTON_VARIANT_LABELS[variant]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 justify-start gap-1 text-xs"
        onClick={() =>
          onChange([...items, { label: 'Button', variant: 'outline', color: 'default' }])
        }
      >
        <Plus className="size-3" />
        Add button
      </Button>
    </div>
  );
}

/* ---------------------------- field renderer ---------------------------- */

function FieldEditor({
  spec,
  block,
  onPatch,
}: {
  spec: FieldSpec;
  block: CanvasBlock;
  onPatch: (patch: BlockProps) => void;
}) {
  const raw: unknown = block.props[spec.key];
  const fieldId = `${block.id}-${String(spec.key)}`;

  switch (spec.type) {
    case 'text':
      return (
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId} className="text-muted-foreground text-xs font-normal">
            {spec.label}
          </Label>
          <Input
            id={fieldId}
            value={asString(raw)}
            placeholder={spec.placeholder}
            onChange={(event) => onPatch({ [spec.key]: event.target.value })}
            className="h-8"
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId} className="text-muted-foreground text-xs font-normal">
            {spec.label}
          </Label>
          <Textarea
            id={fieldId}
            rows={3}
            value={asString(raw)}
            onChange={(event) => onPatch({ [spec.key]: event.target.value })}
          />
        </div>
      );

    case 'number':
      return (
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId} className="text-muted-foreground text-xs font-normal">
            {spec.label}
          </Label>
          <Input
            id={fieldId}
            type="number"
            min={spec.min}
            max={spec.max}
            value={asNumber(raw)}
            onChange={(event) => onPatch({ [spec.key]: Number(event.target.value) || 0 })}
            className="h-8"
          />
          {spec.hint && <span className="text-muted-foreground text-[10px]">{spec.hint}</span>}
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor={fieldId} className="text-muted-foreground text-xs font-normal">
            {spec.label}
          </Label>
          <Switch
            id={fieldId}
            checked={asBoolean(raw)}
            onCheckedChange={(checked) => onPatch({ [spec.key]: checked })}
          />
        </div>
      );

    case 'segment': {
      const current = typeof raw === 'number' ? String(raw) : asString(raw);
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <div className="bg-muted flex rounded-md p-0.5">
            {spec.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onPatch({
                    [spec.key]: spec.key === 'headingLevel' ? Number(option) : option,
                  })
                }
                className={cn(
                  'flex-1 rounded px-2 py-1 text-xs capitalize',
                  current === option ? 'bg-background shadow-xs' : 'text-muted-foreground',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'stringList':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <StringListEditor
            items={asStringList(raw)}
            itemLabel={spec.itemLabel}
            onChange={(next) => {
              // Table rows are cells in column order, so removing or reordering
              // a column has to take its cells with it or the row shifts.
              if (spec.key === 'columns' && Array.isArray(block.props.data)) {
                const before = asStringList(raw);
                const rows = block.props.data;
                const moved = next.map((label, index) => {
                  const from = before.findIndex((old) => old === label);
                  // A renamed column keeps its position; a new one starts empty.
                  return from === -1 ? (before[index] === undefined ? -1 : index) : from;
                });
                onPatch({
                  [spec.key]: next,
                  data: rows.map((row) =>
                    moved.map((from) => (from === -1 ? '' : (row[from] ?? ''))),
                  ),
                });
                return;
              }
              onPatch({ [spec.key]: next });
            }}
          />
        </div>
      );

    case 'pairList':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <PairListEditor
            items={asPairList(raw)}
            keyHeader={spec.keyHeader}
            valueHeader={spec.valueHeader}
            onChange={(next) => onPatch({ [spec.key]: next })}
          />
        </div>
      );

    case 'tabList':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <TabListEditor
            items={asTabList(raw)}
            onChange={(next) => onPatch({ [spec.key]: next })}
          />
        </div>
      );

    case 'buttonList':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <ButtonListEditor
            items={asButtonList(raw)}
            onChange={(next) => onPatch({ [spec.key]: next })}
          />
        </div>
      );

    case 'rowList':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <RowListEditor
            items={asPairList(raw)}
            row={spec.row}
            onChange={(next) => onPatch({ [spec.key]: next })}
          />
        </div>
      );

    case 'controlList':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <ControlListEditor
            items={asControlList(raw)}
            onChange={(next) => onPatch({ [spec.key]: next })}
          />
        </div>
      );

    case 'optionIndex': {
      const source =
        spec.from === 'tabs'
          ? asTabList(block.props.tabs).map((tab) => tab.label)
          : spec.from === 'quickRanges'
            ? asStringList(block.props.quickRanges)
            : asStringList(block.props.options);
      if (source.length === 0) return null;
      const active = asNumber(raw);
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <div className="flex flex-wrap gap-1">
            {source.map((option, index) => (
              <button
                key={`${option}-${index}`}
                type="button"
                onClick={() => onPatch({ [spec.key]: index })}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  index === active
                    ? 'bg-primary text-primary-foreground border-transparent'
                    : 'border-input text-muted-foreground hover:bg-muted',
                )}
              >
                {option || `#${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

/* ---------------------------- inspector ---------------------------- */

export function PropertyInspector({
  block,
  onPatch,
  onRename,
  onDuplicate,
  onDelete,
}: {
  block: CanvasBlock | null;
  onPatch: (patch: BlockProps) => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();

  if (!block) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-1 px-4 py-10 text-center text-xs">
        <p>{t('canvas.nothingSelected')}</p>
        <p>{t('canvas.nothingSelectedHint')}</p>
      </div>
    );
  }

  const schema = PROPERTY_SCHEMA[block.kind];

  return (
    <div className="flex flex-col gap-4 px-3 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{BLOCK_CATALOG[block.kind].label}</Badge>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('misc.duplicateBlock')}
              onClick={onDuplicate}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t('misc.deleteBlock')}
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive p-1"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${block.id}-name`} className="text-muted-foreground text-xs font-normal">
            Layer name
          </Label>
          <Input
            id={`${block.id}-name`}
            value={block.name}
            onChange={(event) => onRename(event.target.value)}
            className="h-8"
          />
        </div>
      </div>

      {schema.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('canvas.noEditableProps')}</p>
      ) : (
        <div className="flex flex-col gap-4 border-t pt-4">
          {schema.map((spec) => (
            <FieldEditor
              key={String(spec.key) + spec.type}
              spec={spec}
              block={block}
              onPatch={onPatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
