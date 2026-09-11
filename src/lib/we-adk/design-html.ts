/**
 * A design's blocks as a standalone html page.
 *
 * The 13 files in `version 1` are html because the screens behind them are
 * real, and `/api/prototype/[slug]` can just fetch the rendered page. A design
 * that Claude proposed has no page behind it — it is a list of blocks in the
 * browser — so its html is written here instead, from the same props the canvas
 * draws from.
 *
 * The document carries its own stylesheet and nothing else: no fonts to fetch,
 * no scripts, no links back to the dev server. It opens from disk, drops into a
 * deck, and reads the way the screen reads in the app.
 */
import {
  INVOICE_ROWS,
  sampleRowCells,
  type CanvasBlock,
  type PairEntry,
} from '@/lib/we-adk-mock/sketcher';
import { isPrototypeFile } from './prototype';

/**
 * Whether a design file is an html file.
 *
 * Every file in a version folder is: the baseline's are pages of the running
 * prototype, and a round names its own designs `*.html` too. The difference is
 * only where the markup comes from — the server renders the first, this module
 * writes the second — so nothing above this line needs to care which it has.
 */
export function isHtmlDesignFile(screenId: string, fileName?: string): boolean {
  return isPrototypeFile(screenId) || (fileName ?? '').endsWith('.html');
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `Approval queue` → `approval-queue`, for the file name and the title. */
export function designSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'design'
  );
}

export function designHtmlFileName(name: string): string {
  return `${designSlug(name)}.html`;
}

/* ------------------------------------------------------------------ */
/* Block-level styling, mirroring the canvas preview                   */
/* ------------------------------------------------------------------ */

const STAT_TONES: Record<string, string> = {
  neutral: 'tone-neutral',
  blue: 'tone-blue',
  green: 'tone-green',
  amber: 'tone-amber',
  red: 'tone-red',
};

const BADGE_TONES: Record<string, string> = {
  secondary: 'badge-secondary',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  muted: 'badge-muted',
};

/** Cells the app prints as a status chip rather than plain text. */
const STATUS_VARIANTS: Record<string, string> = {
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

const REFERENCE_CELL = /^[A-Z]{2,4}-\d{4}-\d{3,}$/;
const WARNING_CELL = /^(\d+d overdue|due today|\d+ remaining|\d+ without a receipt)$/i;
const NUMERIC_HEADER = /(amount|tax|charges|count|total|qty|unit price|share|progress|oldest)/i;

/**
 * A money or measure cell, which is right-aligned rather than left.
 *
 * The currencies are every one a generated screen can carry, not the three this
 * started with: the design guide takes its locale from the source, so a UK brief
 * produces £ and a Cambodian one ៛, and a symbol missing here left that column
 * ragged against the numbers beside it.
 */
function isNumericCell(cell: string): boolean {
  return /^[₩$€£¥៛฿₫₹]?-?[\d,.]+%?$/.test(cell.trim()) && /\d/.test(cell);
}

function buttonClass(variant: string | undefined, color: string | undefined): string {
  const family =
    variant === 'outline'
      ? 'outline'
      : variant === 'ghost' || variant === 'link'
        ? 'ghost'
        : variant === 'secondary'
          ? 'soft'
          : 'solid';
  const tone = !color || color === 'default' ? (variant === 'destructive' ? 'red' : 'base') : color;
  return `btn btn-${family} btn-${family}-${tone}`;
}

function fieldLabel(label: string | undefined, required?: boolean): string {
  if (!label) return '';
  return `<span class="field-label">${esc(label)}${required ? '<i class="req">*</i>' : ''}</span>`;
}

/** 0 or unset means full width on the canvas, so it does here too. */
function widthStyle(width: number | undefined): string {
  return width === undefined || width <= 0 ? ' style="width:100%"' : ` style="width:${width}px"`;
}

function alignClass(align: string | undefined): string {
  return align === 'center' ? ' align-center' : align === 'right' ? ' align-right' : '';
}

function pairs(block: CanvasBlock): PairEntry[] {
  return block.props.pairs ?? [];
}

/* ------------------------------------------------------------------ */
/* One block                                                           */
/* ------------------------------------------------------------------ */

function renderBlock(block: CanvasBlock): string {
  const { kind, props } = block;

  switch (kind) {
    case 'screenHeader': {
      const actions =
        props.showActions === false
          ? ''
          : `<div class="row gap-sm">${(props.buttons ?? [])
              .map(
                (button) =>
                  `<span class="${buttonClass(button.variant, button.color)}">${esc(button.label)}</span>`,
              )
              .join('')}</div>`;
      return `<header class="screen-header">
  <div class="min-w-0">
    ${props.subtitle ? `<p class="eyebrow">${esc(props.subtitle)}</p>` : ''}
    <h1>${esc(props.label)}</h1>
  </div>
  ${actions}
</header>`;
    }

    case 'heading': {
      const level = props.headingLevel ?? 2;
      const size = level === 1 ? 'h-lg' : level === 3 ? 'h-sm' : 'h-md';
      return `<p class="heading ${size}${alignClass(props.align)}">${esc(props.label)}</p>`;
    }

    case 'paragraph':
      return `<p class="paragraph${alignClass(props.align)}">${esc(props.label)}</p>`;

    case 'caption':
      return `<p class="caption">${esc(props.label)}</p>`;

    case 'divider':
      return '<hr class="divider" />';

    case 'spacer':
      return `<div class="spacer" style="height:${props.height ?? 24}px"></div>`;

    case 'input':
      return `<div class="field"${widthStyle(props.width)}>
  ${fieldLabel(props.label, props.required)}
  <div class="control">${esc(props.value || props.placeholder || '')}</div>
  ${props.helpText ? `<span class="help">${esc(props.helpText)}</span>` : ''}
</div>`;

    case 'textarea':
      return `<div class="field"${widthStyle(props.width)}>
  ${fieldLabel(props.label, props.required)}
  <div class="control control-area" style="min-height:${props.height ?? 80}px">${esc(
    props.value || props.placeholder || '',
  )}</div>
  ${props.helpText ? `<span class="help">${esc(props.helpText)}</span>` : ''}
</div>`;

    case 'select': {
      const options = props.options ?? [];
      const selected = options[props.activeIndex ?? 0] ?? 'Select…';
      return `<div class="field"${widthStyle(props.width)}>
  ${fieldLabel(props.label, props.required)}
  <div class="control control-select">${esc(selected)}<i class="chevron"></i></div>
</div>`;
    }

    case 'autocomplete':
      return `<div class="field"${widthStyle(props.width)}>
  ${fieldLabel(props.label)}
  <div class="control control-search"><i class="magnifier"></i>${esc(props.placeholder ?? 'Search…')}</div>
</div>`;

    case 'datePicker':
      return `<div class="field"${widthStyle(props.width)}>
  ${fieldLabel(props.label, props.required)}
  <div class="control">${esc(props.value ?? '')}</div>
</div>`;

    case 'dateRange': {
      const ranges = props.quickRanges ?? [];
      const active = props.activeIndex ?? 0;
      const chips =
        props.showQuickRanges === false || ranges.length === 0
          ? ''
          : `<div class="row gap-xs wrap">${ranges
              .map(
                (range, index) =>
                  `<span class="chip${index === active ? ' chip-active' : ''}">${esc(range)}</span>`,
              )
              .join('')}</div>`;
      return `<div class="stack">
  ${fieldLabel(props.label, props.required)}
  <div class="row gap-md wrap">
    <div class="field"${widthStyle(props.width)}><span class="help">Start</span><div class="control">${esc(
      props.startValue ?? '',
    )}</div></div>
    <div class="field"${widthStyle(props.width)}><span class="help">End</span><div class="control">${esc(
      props.endValue ?? '',
    )}</div></div>
  </div>
  ${chips}
</div>`;
    }

    case 'radioGroup': {
      const options = props.options ?? [];
      const selected = props.activeIndex ?? 0;
      return `<div class="stack">
  ${fieldLabel(props.label)}
  <div class="row gap-md wrap${props.direction === 'vertical' ? ' column' : ''}">
    ${options
      .map(
        (option, index) =>
          `<span class="choice"><i class="radio${index === selected ? ' on' : ''}"></i>${esc(option)}</span>`,
      )
      .join('')}
  </div>
</div>`;
    }

    case 'checkbox':
      return `<div class="stack">
  <span class="choice"><i class="box${props.checked ? ' on' : ''}"></i>${esc(props.label)}</span>
  ${props.helpText ? `<span class="help indent">${esc(props.helpText)}</span>` : ''}
</div>`;

    case 'switch':
      return `<div class="switch-row">
  <div class="min-w-0"><span class="text-sm">${esc(props.label)}</span>${
    props.helpText ? `<span class="help block">${esc(props.helpText)}</span>` : ''
  }</div>
  <i class="toggle${props.checked === true ? ' on' : ''}"></i>
</div>`;

    case 'segmented': {
      const options = props.options ?? [];
      const active = props.activeIndex ?? 0;
      return `<div class="stack">
  ${fieldLabel(props.label)}
  <div class="segmented">${options
    .map(
      (option, index) =>
        `<span class="${index === active ? 'segment segment-active' : 'segment'}">${esc(option)}</span>`,
    )
    .join('')}</div>
</div>`;
    }

    case 'buttonBar':
      return `<div class="row gap-xs wrap${alignClass(props.align)}">${(props.buttons ?? [])
        .map(
          (button) =>
            `<span class="${buttonClass(button.variant, button.color)}">${esc(button.label)}</span>`,
        )
        .join('')}</div>`;

    case 'filterBar':
      return `<div class="filter-bar">${(props.controls ?? [])
        .map((control) => {
          if (control.type === 'search') {
            return `<div class="control control-search grow"><i class="magnifier"></i>${esc(
              control.placeholder ?? 'Search…',
            )}</div>`;
          }
          if (control.type === 'select') {
            const options = control.options ?? [];
            return `<div class="control control-select auto">${esc(
              options[control.activeIndex ?? 0] ?? control.label ?? 'Select',
            )}<i class="chevron"></i></div>`;
          }
          if (control.type === 'dateRange') {
            return `<div class="control control-select auto muted">${esc(
              control.label ?? '2026-07-01 ~ 2026-07-31',
            )}<i class="chevron"></i></div>`;
          }
          if (control.type === 'checkbox') {
            return `<label class="choice small"><i class="box${
              control.checked ? ' on' : ''
            }"></i>${esc(control.label ?? '')}</label>`;
          }
          return `<div class="control grow muted">${esc(
            control.placeholder ?? control.label ?? 'Value',
          )}</div>`;
        })
        .join('')}</div>`;

    case 'table': {
      const columns = props.columns ?? [];
      const own = props.data;
      const rowCount = own
        ? Math.min(props.rows ?? own.length, own.length)
        : Math.min(props.rows ?? 6, INVOICE_ROWS.length);
      // A table without rows of its own borrows the sample invoices, matched to
      // whatever columns this screen named.
      const rows = own
        ? own.slice(0, rowCount)
        : INVOICE_ROWS.slice(0, rowCount).map((row) => sampleRowCells(columns, row));
      const totalRow =
        rows.length > 0 && /^total/i.test(rows[rows.length - 1]?.[0] ?? '')
          ? rows[rows.length - 1]
          : null;
      const bodyRows = totalRow ? rows.slice(0, -1) : rows;
      const pad = props.dense ? ' dense' : '';

      const cell = (value: string, columnIndex: number): string => {
        const trimmed = value.trim();
        if (!trimmed) {
          return /^select$/i.test(columns[columnIndex] ?? '') ? '<i class="box"></i>' : '';
        }
        if (REFERENCE_CELL.test(trimmed)) return `<span class="ref">${esc(trimmed)}</span>`;
        const tone = STATUS_VARIANTS[trimmed.toLowerCase()];
        if (tone) return `<span class="badge ${BADGE_TONES[tone]}">${esc(trimmed)}</span>`;
        if (WARNING_CELL.test(trimmed)) return `<span class="warn">${esc(trimmed)}</span>`;
        return columnIndex === 0 ? `<b>${esc(trimmed)}</b>` : esc(trimmed);
      };

      const head =
        props.showHeader === false
          ? ''
          : `<thead><tr>${columns
              .map(
                (column) =>
                  `<th class="${NUMERIC_HEADER.test(column) ? 'num' : ''}">${esc(column)}</th>`,
              )
              .join('')}</tr></thead>`;

      const body = bodyRows
        .map(
          (row, rowIndex) =>
            `<tr class="${props.striped && rowIndex % 2 === 1 ? 'striped' : ''}">${columns
              .map((column, columnIndex) => {
                const raw = row[columnIndex] ?? '';
                const numeric = isNumericCell(raw) || NUMERIC_HEADER.test(column);
                return `<td class="${columnIndex === 0 ? 'lead' : 'soft'}${
                  numeric ? ' num' : ''
                }">${cell(raw, columnIndex)}</td>`;
              })
              .join('')}</tr>`,
        )
        .join('');

      const foot = totalRow
        ? `<tfoot><tr>${columns
            .map((column, columnIndex) => {
              const raw = totalRow[columnIndex] ?? '';
              return `<td class="${
                isNumericCell(raw) || NUMERIC_HEADER.test(column) ? 'num' : ''
              }">${esc(raw)}</td>`;
            })
            .join('')}</tr></tfoot>`
        : '';

      return `<div class="stack">
  ${props.label ? `<p class="section-title">${esc(props.label)}</p>` : ''}
  <div class="card table-card">
    <div class="scroll-x">
      <table class="table${pad}">${head}<tbody>${body}</tbody>${foot}</table>
    </div>
  </div>
</div>`;
    }

    case 'statCards':
      return `<div class="stat-grid">${pairs(block)
        .map(
          (pair) => `<div class="stat ${STAT_TONES[pair.tone ?? 'neutral']}">
  <span class="stat-key">${esc(pair.key)}</span>
  <span class="stat-value">${esc(pair.value)}</span>
  ${pair.note ? `<span class="stat-note">${esc(pair.note)}</span>` : ''}
</div>`,
        )
        .join('')}</div>`;

    case 'keyValue':
      return `<div class="card pad">
  ${props.label ? `<p class="section-title mb">${esc(props.label)}</p>` : ''}
  <dl class="kv">${pairs(block)
    .map((pair) => `<div class="kv-row"><dt>${esc(pair.key)}</dt><dd>${esc(pair.value)}</dd></div>`)
    .join('')}</dl>
</div>`;

    case 'formGrid':
      return `<div class="card pad">
  ${props.label ? `<p class="section-title mb">${esc(props.label)}</p>` : ''}
  <div class="form-grid">${pairs(block)
    .map(
      (pair) =>
        `<div class="field"><span class="field-label">${esc(pair.key)}</span><div class="control">${esc(
          pair.value,
        )}</div></div>`,
    )
    .join('')}</div>
</div>`;

    case 'banner':
      return `<div class="banner banner-${esc(props.tone ?? 'info')}">
  <div class="min-w-0">
    <p class="banner-title">${esc(props.label)}</p>
    ${props.helpText ? `<p class="banner-body">${esc(props.helpText)}</p>` : ''}
  </div>
</div>`;

    case 'toggleList':
      return `<div class="card pad">
  ${props.label ? `<p class="section-title">${esc(props.label)}</p>` : ''}
  ${pairs(block)
    .map(
      (pair) => `<div class="switch-row bordered">
  <div class="min-w-0"><p class="text-sm strong">${esc(pair.key)}</p>${
    pair.value ? `<p class="help">${esc(pair.value)}</p>` : ''
  }</div>
  <i class="toggle${pair.checked === true ? ' on' : ''}"></i>
</div>`,
    )
    .join('')}
</div>`;

    case 'taskList':
      return `<div class="card">
  ${
    props.label
      ? `<div class="card-head"><p class="section-title">${esc(props.label)}</p><span class="badge badge-secondary">${
          pairs(block).length
        } items</span></div>`
      : ''
  }
  ${pairs(block)
    .map(
      (pair) => `<div class="list-row">
  <span class="tile ${STAT_TONES[pair.tone ?? 'neutral']}"></span>
  <div class="min-w-0 grow"><p class="text-sm strong">${esc(pair.key)}</p>${
    pair.value ? `<p class="help">${esc(pair.value)}</p>` : ''
  }</div>
  ${pair.note ? `<span class="help">${esc(pair.note)}</span>` : ''}
</div>`,
    )
    .join('')}
</div>`;

    case 'timeline':
      return `<div class="card pad">
  ${props.label ? `<p class="section-title mb">${esc(props.label)}</p>` : ''}
  <div class="stack gap-md">${pairs(block)
    .map(
      (pair) =>
        `<div class="timeline-row"><span class="dot"></span><div class="min-w-0"><p class="text-xs">${esc(
          pair.key,
        )}</p>${pair.value ? `<p class="help">${esc(pair.value)}</p>` : ''}</div></div>`,
    )
    .join('')}</div>
</div>`;

    case 'fileList':
      return `<div class="card">
  ${
    props.label
      ? `<div class="card-head"><p class="section-title">${esc(props.label)}</p><span class="badge badge-secondary">${
          pairs(block).length
        }</span></div>`
      : ''
  }
  ${pairs(block)
    .map(
      (pair) =>
        `<div class="list-row tight"><span class="mono grow">${esc(pair.key)}</span><span class="help">${esc(
          pair.value,
        )}</span></div>`,
    )
    .join('')}
</div>`;

    case 'metricBars':
      return `<div class="card pad">
  ${props.label ? `<p class="section-title mb">${esc(props.label)}</p>` : ''}
  <div class="stack gap-md">${pairs(block)
    .map(
      (pair) => `<div class="stack gap-xs">
  <div class="row between"><span class="text-xs strong">${esc(pair.key)}</span><span class="help">${esc(
    pair.value,
  )}</span></div>
  <div class="bar"><span style="width:${Math.max(0, Math.min(100, pair.progress ?? 0))}%"></span></div>
</div>`,
    )
    .join('')}</div>
</div>`;

    case 'emptyState':
      return `<div class="empty">
  <p class="text-sm strong">${esc(props.label)}</p>
  ${props.helpText ? `<p class="help">${esc(props.helpText)}</p>` : ''}
</div>`;

    case 'statusTabs': {
      const tabs = props.tabs ?? [];
      const active = props.activeIndex ?? 0;
      return `<div class="tabs">${tabs
        .map(
          (tab, index) =>
            `<span class="tab${index === active ? ' tab-active' : ''}">${esc(tab.label)}${
              tab.count > 0 ? `<span class="badge badge-warning">${tab.count}</span>` : ''
            }</span>`,
        )
        .join('')}</div>`;
    }

    case 'badgeRow':
      return `<div class="row gap-xs wrap">${(props.badges ?? [])
        .map(
          (badge) =>
            `<span class="badge ${BADGE_TONES[props.tone ?? 'secondary'] ?? 'badge-secondary'}">${esc(
              badge,
            )}</span>`,
        )
        .join('')}</div>`;

    case 'progressSummary':
      return `<div class="stack gap-xs">
  <div class="row between"><span class="text-sm">${esc(props.label)}</span><span class="text-sm">${
    props.progress ?? 0
  }%</span></div>
  <div class="bar tall"><span style="width:${Math.max(0, Math.min(100, props.progress ?? 0))}%"></span></div>
  ${props.helpText ? `<span class="help">${esc(props.helpText)}</span>` : ''}
</div>`;

    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* Stylesheet                                                          */
/* ------------------------------------------------------------------ */

const STYLESHEET = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f4f5f7;color:#18181b;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.page{max-width:1600px;margin:0 auto;padding:24px 28px 56px}
.surface{background:#fff;border:1px solid #e4e4e7;border-radius:14px;padding:32px;display:flex;flex-direction:column;gap:22px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.min-w-0{min-width:0}
.grow{flex:1 1 auto;min-width:0}
.block{display:block}
.row{display:flex;align-items:center}
.row.between{justify-content:space-between;gap:8px}
.row.wrap{flex-wrap:wrap}
.row.column{flex-direction:column;align-items:flex-start}
.gap-xs{gap:6px}.gap-sm{gap:8px}.gap-md{gap:12px}
.stack{display:flex;flex-direction:column;gap:6px}
.stack.gap-md{gap:12px}.stack.gap-xs{gap:6px}
.align-center{justify-content:center;text-align:center}
.align-right{justify-content:flex-end;text-align:right}
.text-xs{font-size:12px}.text-sm{font-size:14px}
.strong{font-weight:500}
.mb{margin-bottom:10px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Screen header */
.screen-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.screen-header h1{margin:4px 0 0;font-size:24px;font-weight:700;letter-spacing:-.01em}
.eyebrow{margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#71717a}

/* Text */
.heading{margin:0;font-weight:600}
.h-lg{font-size:20px}.h-md{font-size:16px}.h-sm{font-size:14px}
.paragraph{margin:0;font-size:14px;line-height:1.65;color:#52525b}
.caption,.help{font-size:11px;color:#71717a}
.help.indent{margin-left:24px}
.section-title{margin:0;font-size:14px;font-weight:600}
.divider{border:0;border-top:1px solid #e4e4e7;margin:0}
.spacer{border:1px dashed #d4d4d8;border-radius:6px}

/* Fields */
.field{display:flex;flex-direction:column;gap:5px;min-width:0}
.field-label{font-size:12px;color:#71717a}
.req{color:#dc2626;font-style:normal;margin-left:2px}
.control{display:flex;align-items:center;gap:6px;min-height:36px;padding:8px 12px;border:1px solid #e4e4e7;border-radius:8px;background:#fff;font-size:14px}
.control.muted,.muted{color:#71717a}
.control-area{align-items:flex-start;color:#71717a}
.control-select{justify-content:space-between}
.control.auto{flex:0 0 auto}
.control-search{color:#71717a}
.filter-bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.filter-bar .grow{flex:1 1 200px;max-width:320px}
.chevron{width:0;height:0;border:4px solid transparent;border-top-color:#a1a1aa;margin-top:3px;flex:0 0 auto}
.magnifier{width:12px;height:12px;border:1.6px solid #a1a1aa;border-radius:50%;position:relative;flex:0 0 auto}
.magnifier::after{content:"";position:absolute;right:-4px;bottom:-3px;width:5px;height:1.6px;background:#a1a1aa;transform:rotate(45deg)}
.choice{display:inline-flex;align-items:center;gap:8px;font-size:14px}
.choice.small{font-size:12px;color:#71717a}
.radio{width:14px;height:14px;border:1px solid #d4d4d8;border-radius:50%;flex:0 0 auto}
.radio.on{border-color:#18181b;box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 7px #18181b}
.box{width:16px;height:16px;border:1px solid #d4d4d8;border-radius:4px;flex:0 0 auto;display:inline-block;position:relative}
.box.on{background:#18181b;border-color:#18181b}
.box.on::after{content:"";position:absolute;left:4px;top:1px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(43deg)}
.toggle{width:34px;height:19px;border-radius:999px;background:#e4e4e7;flex:0 0 auto;position:relative;display:inline-block}
.toggle::after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.toggle.on{background:#18181b}
.toggle.on::after{left:17px}
.switch-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.switch-row.bordered{border-bottom:1px solid #f1f1f4;padding:12px 0}
.switch-row.bordered:last-child{border-bottom:0}
.switch-row p{margin:0}
.segmented{display:inline-flex;background:#f4f4f5;border-radius:8px;padding:2px;font-size:12px;width:fit-content}
.segment{padding:4px 10px;border-radius:6px;color:#71717a}
.segment-active{background:#fff;color:#18181b;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.chip{border:1px solid #e4e4e7;border-radius:8px;padding:4px 10px;font-size:12px;color:#71717a}
.chip-active{background:#18181b;border-color:#18181b;color:#fff}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:500;border:1px solid transparent;white-space:nowrap}
.btn-solid-base{background:#18181b;color:#fff}
.btn-solid-blue{background:#2563eb;color:#fff}
.btn-solid-green{background:#047857;color:#fff}
.btn-solid-amber{background:#f59e0b;color:#09090b}
.btn-solid-red{background:#dc2626;color:#fff}
.btn-solid-violet{background:#7c3aed;color:#fff}
.btn-solid-slate{background:#334155;color:#fff}
.btn-soft-base{background:#f4f4f5;color:#18181b}
.btn-soft-blue{background:#dbeafe;color:#1e40af}
.btn-soft-green{background:#d1fae5;color:#065f46}
.btn-soft-amber{background:#fef3c7;color:#78350f}
.btn-soft-red{background:#fee2e2;color:#991b1b}
.btn-soft-violet{background:#ede9fe;color:#5b21b6}
.btn-soft-slate{background:#e2e8f0;color:#1e293b}
.btn-outline-base{border-color:#e4e4e7;color:#18181b;background:#fff}
.btn-outline-blue{border-color:#2563eb;color:#1d4ed8;background:#fff}
.btn-outline-green{border-color:#047857;color:#047857;background:#fff}
.btn-outline-amber{border-color:#d97706;color:#b45309;background:#fff}
.btn-outline-red{border-color:#dc2626;color:#b91c1c;background:#fff}
.btn-outline-violet{border-color:#7c3aed;color:#6d28d9;background:#fff}
.btn-outline-slate{border-color:#475569;color:#334155;background:#fff}
.btn-ghost-base{color:#18181b}
.btn-ghost-blue{color:#1d4ed8}
.btn-ghost-green{color:#047857}
.btn-ghost-amber{color:#b45309}
.btn-ghost-red{color:#b91c1c}
.btn-ghost-violet{color:#6d28d9}
.btn-ghost-slate{color:#334155}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:500;line-height:1.5;white-space:nowrap}
.badge-secondary{background:#f4f4f5;color:#3f3f46}
.badge-muted{background:#fafafa;color:#71717a}
.badge-success{background:#d1fae5;color:#065f46}
.badge-warning{background:#fef3c7;color:#92400e}
.badge-danger{background:#fee2e2;color:#991b1b}
.badge-info{background:#dbeafe;color:#1e40af}

/* Cards, tables, lists */
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
.card.pad{padding:16px}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid #f1f1f4}
.scroll-x{overflow-x:auto}
.table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}
.table th{background:#fafafa;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:12px;font-weight:500;padding:10px 12px;white-space:nowrap}
.table td{border-bottom:1px solid #f1f1f4;padding:12px}
.table.dense td{padding:8px 12px}
.table tbody tr:last-child td{border-bottom:0}
.table tr.striped{background:#fafafa}
.table td.soft{color:#52525b}
.table td.num,.table th.num{text-align:right;font-variant-numeric:tabular-nums}
.table tfoot td{background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;font-weight:600}
.ref{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:500;color:#2563eb}
.warn{color:#b45309}
.kv-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:1px solid #f1f1f4;padding:8px 0}
.kv-row:last-child{border-bottom:0}
.kv-row dt{font-size:12px;color:#71717a;margin:0}
.kv-row dd{margin:0;font-size:14px;font-weight:500;text-align:right}
.kv{margin:0}
.form-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.list-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f1f1f4}
.list-row.tight{padding:10px 16px}
.list-row:last-child{border-bottom:0}
.list-row p{margin:0}
.tile{width:32px;height:32px;border-radius:9px;flex:0 0 auto}
.timeline-row{display:flex;gap:10px}
.timeline-row p{margin:0}
.dot{width:6px;height:6px;border-radius:50%;background:#d4d4d8;margin-top:6px;flex:0 0 auto}
.bar{height:6px;border-radius:999px;background:#f1f1f4;overflow:hidden}
.bar.tall{height:8px}
.bar span{display:block;height:100%;border-radius:999px;background:#18181b}
.empty{display:flex;flex-direction:column;align-items:center;gap:6px;border:1px dashed #d4d4d8;border-radius:10px;padding:40px 16px;text-align:center}
.empty p{margin:0}
.tabs{display:flex;flex-wrap:wrap;align-items:center;border-bottom:1px solid #e4e4e7}
.tab{display:inline-flex;align-items:center;gap:8px;padding:4px 16px 10px;margin-bottom:-1px;border-bottom:2px solid transparent;font-size:14px;color:#71717a}
.tab-active{border-bottom-color:#2563eb;color:#2563eb;font-weight:500}

/* Stat tiles */
.stat-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.stat{display:flex;flex-direction:column;gap:4px;border-radius:12px;padding:16px}
.stat-key{font-size:12px;font-weight:500;color:#71717a}
.stat-value{font-size:24px;font-weight:700;line-height:1.15;word-break:break-word;font-variant-numeric:tabular-nums}
.stat-note{font-size:11px;color:#71717a}
.tone-neutral{background:#f4f4f5}
.tone-blue{background:#eff6ff}.tone-blue .stat-value{color:#2563eb}
.tone-green{background:#ecfdf5}.tone-green .stat-value{color:#059669}
.tone-amber{background:#fffbeb}.tone-amber .stat-value{color:#d97706}
.tone-red{background:#fef2f2}.tone-red .stat-value{color:#dc2626}

/* Banners */
.banner{display:flex;gap:12px;border:1px solid;border-radius:10px;padding:12px 16px}
.banner p{margin:0}
.banner-title{font-size:14px;font-weight:500}
.banner-body{font-size:14px;opacity:.9;margin-top:2px}
.banner-info{border-color:#bfdbfe;background:#eff6ff;color:#1e40af}
.banner-success{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}
.banner-warning,.banner-amber{border-color:#fde68a;background:#fffbeb;color:#92400e}
.banner-danger,.banner-red{border-color:#fecaca;background:#fef2f2;color:#991b1b}

/* Page furniture */
.doc-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin-bottom:14px;font-size:12px;color:#71717a}
.doc-head .name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;color:#3f3f46}
.doc-foot{margin-top:18px;font-size:11px;color:#a1a1aa}
@media print{body{background:#fff}.surface{border:0;box-shadow:none;padding:0}.doc-head,.doc-foot{display:none}}
`;

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export interface DesignHtmlInput {
  /** Screen name — the document title and the heading of the export note. */
  name: string;
  blocks: CanvasBlock[];
  /** Route the screen is meant to live at, e.g. `/eacc/approvals`. */
  route?: string;
  /** Where this design came from — a task code, a meeting, a project. */
  origin?: string;
  /** Date stamped into the export note. */
  createdAt?: string;
}

/** The whole screen as one standalone html document — no external assets. */
export function designToHtml({ name, blocks, route, origin, createdAt }: DesignHtmlInput): string {
  const body = blocks
    .filter((block) => !block.hidden)
    .map((block) => renderBlock(block))
    .filter((html) => html.length > 0)
    .join('\n\n');

  const meta = [route, origin, createdAt].filter(Boolean).map((part) => esc(part));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(name)}</title>
<meta name="generator" content="WE-ADK" />
<style>${STYLESHEET}</style>
</head>
<body>
<div class="page">
  <div class="doc-head">
    <span class="name">${esc(designHtmlFileName(name))}</span>
    ${meta.map((part) => `<span>· ${part}</span>`).join('\n    ')}
  </div>
  <main class="surface">
${body}
  </main>
  <p class="doc-foot">Generated by WE-ADK from a design canvas. Static markup — the controls are drawn, not wired.</p>
</div>
</body>
</html>
`;
}

/** Hands the document to the browser as a download. Browser-only. */
export function downloadDesignHtml(name: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = designHtmlFileName(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has read the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the document in a new tab, for a quick look without saving it. */
export function openDesignHtml(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
