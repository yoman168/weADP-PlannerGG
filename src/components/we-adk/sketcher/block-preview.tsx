'use client';

import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  FileText,
  Inbox,
  Info,
  Paperclip,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge, Button, Card, Input, Progress, Separator, Switch, cn } from '@/components/ui';
import {
  INVOICE_ROWS,
  sampleRowCells,
  type CanvasBlock,
  type InvoiceRow,
} from '@/lib/we-adk-mock/sketcher';
import { buttonColorClass } from './button-styles';

type BadgeVariant = 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'default';

const TONE_TO_VARIANT: Record<string, BadgeVariant> = {
  secondary: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

/** Cell extractors matching the default column order of the table block. */
/** Tile colours for summary cards, matching the eACC screens. */
const STAT_TONE_BG: Record<string, string> = {
  neutral: 'bg-muted/40',
  blue: 'bg-blue-50 dark:bg-blue-950/30',
  green: 'bg-emerald-50 dark:bg-emerald-950/30',
  amber: 'bg-amber-50 dark:bg-amber-950/30',
  red: 'bg-red-50 dark:bg-red-950/30',
};

const STAT_TONE_TEXT: Record<string, string> = {
  neutral: '',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

/** Banner colours, matching the notices the screens use. */
const BANNER_TONE: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  amber:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300',
  red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300',
};

const BANNER_ICON: Record<string, ReactNode> = {
  info: <Info className="size-4" />,
  success: <CircleCheck className="size-4" />,
  warning: <RotateCcw className="size-4" />,
  amber: <RotateCcw className="size-4" />,
  danger: <TriangleAlert className="size-4" />,
  red: <TriangleAlert className="size-4" />,
};

/** The icon tile beside a task row. */
const TASK_TONE: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

/** Cells the app renders as a status chip rather than plain text. */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'secondary',
  submitted: 'info',
  'in review': 'info',
  'in approval': 'info',
  approved: 'success',
  shipped: 'success',
  complete: 'success',
  rejected: 'danger',
  returned: 'warning',
  blocked: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'secondary',
  active: 'secondary',
  invited: 'warning',
  accountant: 'success',
  approver: 'info',
  member: 'secondary',
  admin: 'warning',
  attached: 'success',
  'corporate card': 'info',
  'personal expense': 'secondary',
  'cash receipt': 'success',
  'tax invoice': 'warning',
};

/** Document references — the app prints these in blue mono. */
const REFERENCE_CELL = /^[A-Z]{2,4}-\d{4}-\d{3,}$/;

/** Overdue / remaining notes are amber in the app. */
const WARNING_CELL = /^(\d+d overdue|due today|\d+ remaining|\d+ without a receipt)$/i;

/** Columns whose values are money or counts, so the whole column right-aligns. */
const NUMERIC_HEADER = /(amount|tax|charges|count|total|qty|unit price|share|progress|oldest)/i;

/** Money and counts read right-aligned, the way the real tables set them. */
function isNumericCell(cell: string): boolean {
  return /^[₩$€]?-?[\d,.]+%?$/.test(cell.trim()) && /\d/.test(cell);
}

function widthStyle(width: number | undefined): { width?: string } {
  if (width === undefined || width <= 0) return { width: '100%' };
  return { width: `${width}px` };
}

function alignClass(align: string | undefined): string {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
}

function justifyClass(align: string | undefined): string {
  if (align === 'center') return 'justify-center';
  if (align === 'right') return 'justify-end';
  return 'justify-start';
}

function FieldLabel({ label, required }: { label: string | undefined; required?: boolean }) {
  if (!label) return null;
  return (
    <span className="text-muted-foreground text-xs">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </span>
  );
}

/**
 * Renders one canvas block purely from its editable props, so every change in
 * the inspector shows up here immediately.
 */
export function BlockPreview({ block }: { block: CanvasBlock }) {
  const { kind, props } = block;

  switch (kind) {
    /*
     * The canvas normally lifts this block out and draws it *around* the rest,
     * so this case is for the places that render a screen's blocks as a plain
     * list — a thumbnail, the design canvas, a second shell someone added by
     * hand. Drawing nothing there would leave a block that cannot be seen or
     * picked, so it draws as the nav it stands for.
     */
    case 'appShell': {
      const groups: { label: string; items: string[] }[] = [];
      for (const pair of props.pairs ?? []) {
        const heading = (pair.key ?? '').trim();
        const item = (pair.value ?? '').trim();
        if (!item) continue;
        const last = groups[groups.length - 1];
        if (last && last.label === heading) last.items.push(item);
        else groups.push({ label: heading, items: [item] });
      }
      return (
        <Card className="gap-0 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-md text-[10px] font-bold">
              {(props.label ?? 'A').trim().charAt(0).toUpperCase() || 'A'}
            </span>
            <p className="text-sm font-semibold">{props.label ?? 'App'}</p>
            <Badge variant="outline" className="ml-auto text-[10px]">
              App shell
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {groups.map((group, index) => (
              <div key={`${group.label}-${index}`} className="min-w-0">
                {group.label && (
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    {group.label}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">{group.items.join(' · ')}</p>
              </div>
            ))}
          </div>
        </Card>
      );
    }

    case 'screenHeader':
      return (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            {props.subtitle && (
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {props.subtitle}
              </p>
            )}
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{props.label}</h2>
          </div>
          {props.showActions !== false && (
            <div className="flex gap-2">
              {(props.buttons ?? []).map((button, index) => (
                <Button
                  key={`${button.label}-${index}`}
                  size="sm"
                  variant={button.variant}
                  // Part of the design being previewed, not a real control.
                  tabIndex={-1}
                  className={buttonColorClass(button.color, button.variant)}
                >
                  {button.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      );

    case 'heading': {
      const level = props.headingLevel ?? 2;
      const sizeClass = level === 1 ? 'text-xl' : level === 3 ? 'text-sm' : 'text-base';
      return (
        <p className={cn('font-semibold', sizeClass, alignClass(props.align))}>{props.label}</p>
      );
    }

    case 'paragraph':
      return (
        <p className={cn('text-muted-foreground text-sm leading-relaxed', alignClass(props.align))}>
          {props.label}
        </p>
      );

    case 'caption':
      return <p className={cn('text-muted-foreground text-xs')}>{props.label}</p>;

    case 'divider':
      return <Separator />;

    case 'spacer':
      return (
        <div
          className="border-border/60 flex items-center justify-center rounded border border-dashed"
          style={{ height: `${props.height ?? 24}px` }}
        >
          <span className="text-muted-foreground/60 text-[10px]">{props.height ?? 24}px</span>
        </div>
      );

    case 'input':
      return (
        <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
          <FieldLabel label={props.label} required={props.required} />
          <Input
            readOnly
            value={props.value ?? ''}
            placeholder={props.placeholder}
            className="h-9"
          />
          {props.helpText && (
            <span className="text-muted-foreground text-[10px]">{props.helpText}</span>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
          <FieldLabel label={props.label} required={props.required} />
          <div
            className="border-input bg-background text-muted-foreground rounded-md border px-3 py-2 text-sm"
            style={{ minHeight: `${props.height ?? 80}px` }}
          >
            {props.value || props.placeholder}
          </div>
          {props.helpText && (
            <span className="text-muted-foreground text-[10px]">{props.helpText}</span>
          )}
        </div>
      );

    case 'select': {
      const options = props.options ?? [];
      const selected = options[props.activeIndex ?? 0] ?? 'Select…';
      return (
        <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
          <FieldLabel label={props.label} required={props.required} />
          <div className="border-input bg-background flex h-9 items-center justify-between rounded-md border px-3 text-sm">
            {selected}
            <ChevronDown className="text-muted-foreground size-3.5" />
          </div>
        </div>
      );
    }

    case 'autocomplete':
      return (
        <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
          <FieldLabel label={props.label} />
          <div className="border-input bg-background flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <Search className="text-muted-foreground size-3.5" />
            <span className="text-muted-foreground">{props.placeholder}</span>
          </div>
        </div>
      );

    case 'datePicker':
      return (
        <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
          <FieldLabel label={props.label} required={props.required} />
          <Input readOnly value={props.value ?? ''} className="h-8" />
        </div>
      );

    case 'dateRange': {
      const ranges = props.quickRanges ?? [];
      const activeRange = props.activeIndex ?? 0;
      return (
        <div className="flex flex-col gap-3">
          <FieldLabel label={props.label} required={props.required} />
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
              <span className="text-muted-foreground text-[10px]">Start</span>
              <Input readOnly value={props.startValue ?? ''} className="h-8" />
            </div>
            <div className="flex flex-col gap-1" style={widthStyle(props.width)}>
              <span className="text-muted-foreground text-[10px]">End</span>
              <Input readOnly value={props.endValue ?? ''} className="h-8" />
            </div>
          </div>
          {props.showQuickRanges !== false && ranges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ranges.map((range, index) => (
                <span
                  key={`${range}-${index}`}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs',
                    index === activeRange
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : 'border-input text-muted-foreground',
                  )}
                >
                  {range}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'radioGroup': {
      const options = props.options ?? [];
      const selected = props.activeIndex ?? 0;
      return (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={props.label} />
          <div
            className={cn(
              'flex gap-4 text-sm',
              props.direction === 'vertical' && 'flex-col gap-1.5',
            )}
          >
            {options.map((option, index) => (
              <span key={`${option}-${index}`} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                    index === selected ? 'border-primary' : 'border-input',
                  )}
                >
                  {index === selected && <span className="bg-primary size-1.5 rounded-full" />}
                </span>
                {option}
              </span>
            ))}
          </div>
        </div>
      );
    }

    case 'checkbox':
      return (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded border',
                props.checked ? 'bg-primary border-primary' : 'border-input',
              )}
            >
              {props.checked && (
                <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none">
                  <path
                    d="M2.5 6.2 4.7 8.4 9.5 3.6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            {props.label}
          </span>
          {props.helpText && (
            <span className="text-muted-foreground ml-6 text-[10px]">{props.helpText}</span>
          )}
        </div>
      );

    case 'switch':
      return (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm">{props.label}</span>
            {props.helpText && (
              <span className="text-muted-foreground text-[10px]">{props.helpText}</span>
            )}
          </div>
          <Switch checked={props.checked === true} />
        </div>
      );

    case 'segmented': {
      const options = props.options ?? [];
      const active = props.activeIndex ?? 0;
      return (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={props.label} />
          <div className="bg-muted inline-flex w-fit rounded-md p-0.5 text-xs">
            {options.map((option, index) => (
              <span
                key={`${option}-${index}`}
                className={cn(
                  'rounded-sm px-2.5 py-1',
                  index === active ? 'bg-background shadow-xs' : 'text-muted-foreground',
                )}
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      );
    }

    case 'buttonBar':
      return (
        <div className={cn('flex flex-wrap gap-1.5', justifyClass(props.align))}>
          {(props.buttons ?? []).map((button, index) => (
            <Button
              key={`${button.label}-${index}`}
              size="sm"
              variant={button.variant}
              tabIndex={-1}
              className={buttonColorClass(button.color, button.variant)}
            >
              {button.label}
            </Button>
          ))}
        </div>
      );

    case 'filterBar': {
      // The row of filters a list screen carries, laid out the way the app lays
      // it out: search first, then dropdowns, then the odd checkbox.
      const controls = props.controls ?? [];
      return (
        <div className="flex flex-wrap items-center gap-3">
          {controls.map((control, index) => {
            if (control.type === 'search') {
              return (
                <div key={index} className="relative max-w-xs min-w-[180px] flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <div className="border-input bg-background text-muted-foreground flex h-9 items-center rounded-md border pl-8 text-sm">
                    {control.placeholder ?? 'Search…'}
                  </div>
                </div>
              );
            }
            if (control.type === 'select') {
              const options = control.options ?? [];
              return (
                <div
                  key={index}
                  className="bg-background flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm"
                >
                  {options[control.activeIndex ?? 0] ?? control.label ?? 'Select'}
                  <ChevronDown className="text-muted-foreground size-3.5" />
                </div>
              );
            }
            if (control.type === 'dateRange') {
              return (
                <div
                  key={index}
                  className="bg-background text-muted-foreground flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm"
                >
                  {control.label ?? '2026-07-01 ~ 2026-07-31'}
                  <ChevronDown className="size-3.5" />
                </div>
              );
            }
            if (control.type === 'checkbox') {
              return (
                <label
                  key={index}
                  className="text-muted-foreground flex items-center gap-2 text-xs"
                >
                  <span
                    className={cn(
                      'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                      control.checked ? 'bg-primary border-primary' : 'border-input',
                    )}
                  >
                    {control.checked && (
                      <svg viewBox="0 0 12 12" className="size-2.5 text-white" fill="none">
                        <path
                          d="M2.5 6.2 4.7 8.4 9.5 3.6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </span>
                  {control.label}
                </label>
              );
            }
            return (
              <div
                key={index}
                className="border-input bg-background text-muted-foreground flex h-9 max-w-xs min-w-[160px] flex-1 items-center rounded-md border px-3 text-sm"
              >
                {control.placeholder ?? control.label ?? 'Value'}
              </div>
            );
          })}
        </div>
      );
    }

    case 'table': {
      const columns = props.columns ?? [];
      // A block that carries its screen's rows draws those; anything else falls
      // back to the generic invoice sample, which is what a fresh block gets.
      const own = props.data;
      const rowCount = own
        ? Math.min(props.rows ?? own.length, own.length)
        : Math.min(props.rows ?? 6, INVOICE_ROWS.length);
      const source = own ? own.slice(0, rowCount) : INVOICE_ROWS.slice(0, rowCount);
      const cellPad = props.dense ? 'px-3 py-2' : 'px-3 py-3';

      // The screens end a list with a totals row; drawing it in a footer keeps
      // the canvas reading like the table it stands for.
      const rows = own ? (source as string[][]) : [];
      const totalRow =
        own && rows.length > 0 && /^total/i.test(rows[rows.length - 1]?.[0] ?? '')
          ? rows[rows.length - 1]
          : null;
      const bodyRows = totalRow ? rows.slice(0, -1) : rows;

      const cell = (value: string, columnIndex: number) => {
        const trimmed = value.trim();
        // A selection column is empty in the data but drawn as a checkbox.
        if (!trimmed) {
          return /^select$/i.test(columns[columnIndex] ?? '') ? (
            <span className="border-input block size-4 rounded-[4px] border" />
          ) : null;
        }
        if (REFERENCE_CELL.test(trimmed)) {
          return (
            <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
              {trimmed}
            </span>
          );
        }
        const tone = STATUS_VARIANTS[trimmed.toLowerCase()];
        if (tone) {
          return (
            <Badge variant={tone} className="text-[11px]">
              {trimmed}
            </Badge>
          );
        }
        if (WARNING_CELL.test(trimmed)) {
          return <span className="text-amber-600 dark:text-amber-400">{trimmed}</span>;
        }
        return columnIndex === 0 ? <span className="font-medium">{trimmed}</span> : trimmed;
      };

      return (
        <div className="flex flex-col gap-2">
          {props.label && <p className="text-sm font-semibold">{props.label}</p>}
          <Card className="gap-0 overflow-hidden py-0 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                {props.showHeader !== false && (
                  <thead className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                    <tr>
                      {columns.map((column, index) => (
                        <th
                          key={`${column}-${index}`}
                          className={cn(
                            'font-medium whitespace-nowrap',
                            cellPad,
                            'py-2.5',
                            NUMERIC_HEADER.test(column) && 'text-right',
                          )}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {(own ? bodyRows : (source as InvoiceRow[])).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={cn(
                        'hover:bg-muted/40 border-b transition-colors last:border-0',
                        props.striped && rowIndex % 2 === 1 && 'bg-muted/30',
                      )}
                    >
                      {columns.map((column, columnIndex) => {
                        const raw = own
                          ? ((row as string[])[columnIndex] ?? '')
                          : (sampleRowCells(columns, row as InvoiceRow)[columnIndex] ?? '—');
                        const numeric = isNumericCell(raw) || NUMERIC_HEADER.test(column);
                        return (
                          <td
                            key={`${column}-${columnIndex}`}
                            className={cn(
                              cellPad,
                              columnIndex === 0 ? '' : 'text-muted-foreground',
                              numeric && 'text-right tabular-nums',
                              isNumericCell(raw) && 'font-medium',
                            )}
                          >
                            {cell(raw, columnIndex)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {totalRow && (
                  <tfoot>
                    <tr className="bg-muted/30 border-t">
                      {columns.map((column, columnIndex) => {
                        const raw = totalRow[columnIndex] ?? '';
                        return (
                          <td
                            key={`total-${columnIndex}`}
                            className={cn(
                              cellPad,
                              'py-2.5 text-xs font-semibold',
                              (isNumericCell(raw) || NUMERIC_HEADER.test(column)) &&
                                'text-right text-sm tabular-nums',
                            )}
                          >
                            {raw}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      );
    }

    case 'statCards': {
      const cards = props.pairs ?? [];
      return (
        // Tiles wrap by the room they have rather than a fixed column count —
        // the canvas column changes width as panels open, and currency does not
        // survive a 60px tile.
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {cards.map((pair, index) => (
            <div
              key={`${pair.key}-${index}`}
              className={cn('rounded-xl p-4', STAT_TONE_BG[pair.tone ?? 'neutral'])}
            >
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium">{pair.key}</span>
                <span
                  className={cn(
                    // Currency is long; wrapping beats cutting it off.
                    'text-2xl leading-tight font-bold break-words tabular-nums',
                    STAT_TONE_TEXT[pair.tone ?? 'neutral'],
                  )}
                >
                  {pair.value}
                </span>
                {pair.note && (
                  <span className="text-muted-foreground text-[11px]">{pair.note}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'keyValue':
      return (
        <Card className="gap-0 p-4 shadow-sm">
          {props.label && <p className="mb-2 text-sm font-semibold">{props.label}</p>}
          <dl className="flex flex-col">
            {(props.pairs ?? []).map((pair, index) => (
              <div
                key={`${pair.key}-${index}`}
                className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0"
              >
                <dt className="text-muted-foreground shrink-0 text-xs">{pair.key}</dt>
                <dd className="min-w-0 truncate text-sm font-medium">{pair.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      );

    case 'formGrid':
      // The two-column field grid a detail page opens with.
      return (
        <Card className="gap-0 p-4 shadow-sm">
          {props.label && <p className="mb-3 text-sm font-semibold">{props.label}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {(props.pairs ?? []).map((pair, index) => (
              <div key={`${pair.key}-${index}`} className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">{pair.key}</span>
                <div className="border-input bg-background flex h-9 items-center rounded-md border px-3 text-sm">
                  {pair.value}
                </div>
              </div>
            ))}
          </div>
        </Card>
      );

    case 'banner': {
      const tone = props.tone ?? 'info';
      return (
        <div className={cn('flex gap-3 rounded-lg border px-4 py-3', BANNER_TONE[tone])}>
          <span className="mt-0.5 shrink-0">{BANNER_ICON[tone]}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{props.label}</p>
            {props.helpText && <p className="mt-0.5 text-sm opacity-90">{props.helpText}</p>}
          </div>
        </div>
      );
    }

    case 'toggleList':
      // Settings rows: what the switch does, and whether it is on.
      return (
        <Card className="gap-0 p-4 shadow-sm">
          {props.label && <p className="mb-1 text-sm font-semibold">{props.label}</p>}
          {(props.pairs ?? []).map((pair, index) => (
            <div
              key={`${pair.key}-${index}`}
              className="flex items-start justify-between gap-4 border-b py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{pair.key}</p>
                {pair.value && <p className="text-muted-foreground text-xs">{pair.value}</p>}
              </div>
              <Switch checked={pair.checked === true} className="pointer-events-none" />
            </div>
          ))}
        </Card>
      );

    case 'taskList':
      return (
        <Card className="gap-0 py-0 shadow-sm">
          {props.label && (
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">{props.label}</p>
              <Badge variant="secondary" className="text-[10px]">
                {(props.pairs ?? []).length} items
              </Badge>
            </div>
          )}
          {(props.pairs ?? []).map((pair, index) => (
            <div
              key={`${pair.key}-${index}`}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  TASK_TONE[pair.tone ?? 'neutral'],
                )}
              >
                <TriangleAlert className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pair.key}</p>
                {pair.value && (
                  <p className="text-muted-foreground truncate text-xs">{pair.value}</p>
                )}
              </div>
              {pair.note && (
                <span className="text-muted-foreground shrink-0 text-xs">{pair.note}</span>
              )}
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </div>
          ))}
        </Card>
      );

    case 'timeline':
      return (
        <Card className="gap-0 p-4 shadow-sm">
          {props.label && <p className="mb-3 text-sm font-semibold">{props.label}</p>}
          <div className="flex flex-col gap-3">
            {(props.pairs ?? []).map((pair, index) => (
              <div key={`${pair.key}-${index}`} className="flex gap-2.5">
                <span className="bg-muted mt-1.5 size-1.5 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="text-xs">{pair.key}</p>
                  {pair.value && <p className="text-muted-foreground text-[11px]">{pair.value}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      );

    case 'fileList':
      return (
        <Card className="gap-0 py-0 shadow-sm">
          {props.label && (
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">{props.label}</p>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Paperclip className="size-2.5" />
                {(props.pairs ?? []).length}
              </Badge>
            </div>
          )}
          {(props.pairs ?? []).map((pair, index) => (
            <div
              key={`${pair.key}-${index}`}
              className="flex items-center gap-2 border-b px-4 py-2.5 last:border-0"
            >
              <FileText className="text-muted-foreground size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{pair.key}</span>
              <span className="text-muted-foreground shrink-0 text-[11px]">{pair.value}</span>
            </div>
          ))}
        </Card>
      );

    case 'metricBars':
      return (
        <Card className="gap-0 p-4 shadow-sm">
          {props.label && <p className="mb-3 text-sm font-semibold">{props.label}</p>}
          <div className="flex flex-col gap-3">
            {(props.pairs ?? []).map((pair, index) => (
              <div key={`${pair.key}-${index}`} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{pair.key}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {pair.value}
                  </span>
                </div>
                <Progress value={pair.progress ?? 0} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      );

    case 'emptyState':
      return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <Inbox className="text-muted-foreground size-7" />
          <p className="text-sm font-medium">{props.label}</p>
          {props.helpText && <p className="text-muted-foreground text-xs">{props.helpText}</p>}
        </div>
      );

    case 'statusTabs': {
      const tabs = props.tabs ?? [];
      const active = props.activeIndex ?? 0;
      return (
        <div className="flex flex-wrap items-center border-b">
          {tabs.map((tab, index) => (
            <span
              key={`${tab.label}-${index}`}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-4 pt-1 pb-2.5 text-sm',
                index === active
                  ? 'border-blue-600 font-medium text-blue-600'
                  : 'text-muted-foreground border-transparent',
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  {tab.count}
                </Badge>
              )}
            </span>
          ))}
        </div>
      );
    }

    case 'badgeRow':
      return (
        <div className="flex flex-wrap gap-1.5">
          {(props.badges ?? []).map((badge, index) => (
            <Badge
              key={`${badge}-${index}`}
              variant={TONE_TO_VARIANT[props.tone ?? 'secondary'] ?? 'secondary'}
            >
              {badge}
            </Badge>
          ))}
        </div>
      );

    case 'progressSummary':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>{props.label}</span>
            <span className="tabular-nums">{props.progress ?? 0}%</span>
          </div>
          <Progress value={props.progress ?? 0} />
          {props.helpText && (
            <span className="text-muted-foreground text-xs">{props.helpText}</span>
          )}
        </div>
      );

    default:
      return null;
  }
}
