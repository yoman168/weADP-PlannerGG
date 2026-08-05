/**
 * Sketcher canvas model — block catalog, per-kind defaults and the property
 * schema that drives the inspector. Mock data only: nothing here talks to an
 * API, and canvases persist to localStorage so edits survive a reload.
 */

/* ------------------------------------------------------------------ */
/* Sample data used by the data/table previews                         */
/* ------------------------------------------------------------------ */

export interface InvoiceRow {
  status: 'Draft' | 'In progress' | 'Submitted';
  createdAt: string;
  supplierName: string;
  supplierBizNo: string;
  supplierCeo: string;
  amount: number;
  taxInvoiceNo: string;
}

export const INVOICE_ROWS: InvoiceRow[] = [
  {
    status: 'Draft',
    createdAt: '2026-07-27',
    supplierName: 'LG Vendor',
    supplierBizNo: '111',
    supplierCeo: '',
    amount: 2_080_579,
    taxInvoiceNo: 'Invoice',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-27',
    supplierName: 'Visionlyu Co., Ltd.',
    supplierBizNo: '2208195788',
    supplierCeo: '',
    amount: 100,
    taxInvoiceNo: 'Invoice',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-23',
    supplierName: 'Visionlyu Co., Ltd.',
    supplierBizNo: '2208195788',
    supplierCeo: '',
    amount: 654,
    taxInvoiceNo: 'Invoice',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-23',
    supplierName: 'Visionlyu Co., Ltd.',
    supplierBizNo: '2208195788',
    supplierCeo: 'Ttukttak Kim',
    amount: 943.21,
    taxInvoiceNo: 'Tax invoice',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-06',
    supplierName: 'iBeeree Inc...',
    supplierBizNo: '2148733800',
    supplierCeo: 'Gwangcheon Jeong',
    amount: -319_000,
    taxInvoiceNo: 'Revised tax...',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-03',
    supplierName: 'Financial Settlement Assoc...',
    supplierBizNo: '1298208745',
    supplierCeo: 'Byungmin Chae',
    amount: 220_000,
    taxInvoiceNo: 'Tax invoice',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-03',
    supplierName: 'Haedong Camtech',
    supplierBizNo: '6201170567',
    supplierCeo: 'Dongwoo Bang',
    amount: 341_000,
    taxInvoiceNo: 'Tax invoice',
  },
  {
    status: 'Draft',
    createdAt: '2026-07-03',
    supplierName: 'The Office Garden Co...',
    supplierBizNo: '1058633625',
    supplierCeo: 'Byungwan Yoo',
    amount: 728_200,
    taxInvoiceNo: 'Tax invoice',
  },
];

/**
 * Sample cells for a table that carries no data of its own.
 *
 * The default table block has the seven invoice columns, so its cells could be
 * read positionally — but a proposed screen names its own columns, and reading
 * position by position then prints the vendor under "Bill Date". Matching the
 * header instead keeps a sample table honest whatever it is a table of; a column
 * nothing matches is left blank rather than filled with the wrong field.
 */
const SAMPLE_FIELDS: { test: RegExp; read: (row: InvoiceRow) => string }[] = [
  { test: /^select$/i, read: () => '' },
  { test: /(status|state)/i, read: (row) => row.status },
  { test: /(date|created|issued|due)/i, read: (row) => row.createdAt },
  {
    test: /(supplier|vendor|partner|merchant|company|customer|client|payee)/i,
    read: (row) => row.supplierName,
  },
  { test: /(biz|business|registration|tax id)/i, read: (row) => row.supplierBizNo },
  {
    test: /(ceo|owner|representative|approver|assignee|requester|manager|user|member)/i,
    read: (row) => row.supplierCeo || '—',
  },
  {
    test: /(amount|total|charge|price|sum|balance|remaining|krw)/i,
    read: (row) => new Intl.NumberFormat('en-US').format(row.amount),
  },
  {
    test: /(invoice|receipt|reference|document|no\.?$|number|code|id$)/i,
    read: (row) => row.taxInvoiceNo,
  },
  { test: /(type|category|kind)/i, read: (row) => row.taxInvoiceNo },
];

export function sampleRowCells(columns: string[], row: InvoiceRow): string[] {
  return columns.map(
    (column) => SAMPLE_FIELDS.find((field) => field.test.test(column))?.read(row) ?? '—',
  );
}

/* ------------------------------------------------------------------ */
/* Block model                                                         */
/* ------------------------------------------------------------------ */

export type BlockKind =
  | 'screenHeader'
  | 'heading'
  | 'paragraph'
  | 'caption'
  | 'divider'
  | 'spacer'
  | 'input'
  | 'textarea'
  | 'select'
  | 'autocomplete'
  | 'datePicker'
  | 'dateRange'
  | 'radioGroup'
  | 'checkbox'
  | 'switch'
  | 'segmented'
  | 'buttonBar'
  | 'filterBar'
  | 'formGrid'
  | 'table'
  | 'statCards'
  | 'keyValue'
  | 'emptyState'
  | 'statusTabs'
  | 'badgeRow'
  | 'banner'
  | 'toggleList'
  | 'taskList'
  | 'timeline'
  | 'fileList'
  | 'metricBars'
  | 'progressSummary';

/** One control inside a filter bar — the row of filters every list screen has. */
export interface FilterControl {
  type: 'search' | 'select' | 'dateRange' | 'checkbox' | 'text';
  label?: string;
  placeholder?: string;
  options?: string[];
  activeIndex?: number;
  checked?: boolean;
}

export interface PairEntry {
  key: string;
  value: string;
  /** Tile colour, for screens whose summary cards are colour-coded. */
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
  /** Small line under the value, e.g. "+8.2%", or the meta of a list row. */
  note?: string;
  /** Settings rows: the state of the row's switch. */
  checked?: boolean;
  /** Metric rows: how full the bar is, 0-100. */
  progress?: number;
}
export interface TabEntry {
  label: string;
  count: number;
}
/** Button style families, matching the variants the shared Button component supports. */
export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';

/** Optional colour override layered on top of the variant. 'default' keeps the theme colour. */
export type ButtonColor = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate';

export const BUTTON_VARIANTS: ButtonVariant[] = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
];

export const BUTTON_COLORS: ButtonColor[] = [
  'default',
  'blue',
  'green',
  'amber',
  'red',
  'violet',
  'slate',
];

export const BUTTON_VARIANT_LABELS: Record<ButtonVariant, string> = {
  default: 'Solid',
  secondary: 'Soft',
  destructive: 'Destructive',
  outline: 'Outline',
  ghost: 'Ghost',
  link: 'Link',
};

export interface ButtonEntry {
  label: string;
  variant: ButtonVariant;
  color?: ButtonColor;
}

/** Every editable property a block can carry. All optional — schema decides what shows. */
export interface BlockProps {
  label?: string;
  /** Small line above a screen title, e.g. the breadcrumb the app shows. */
  subtitle?: string;
  placeholder?: string;
  helpText?: string;
  value?: string;
  startValue?: string;
  endValue?: string;
  required?: boolean;
  checked?: boolean;
  /** 0 = full width */
  width?: number;
  height?: number;
  align?: string;
  direction?: string;
  headingLevel?: number;
  options?: string[];
  quickRanges?: string[];
  showQuickRanges?: boolean;
  activeIndex?: number;
  columns?: string[];
  rows?: number;
  /**
   * The rows to draw, one array of cells per row, aligned to `columns`. A block
   * that carries the screen's own data reads as that screen; without it the
   * table falls back to generic sample rows.
   */
  data?: string[][];
  striped?: boolean;
  dense?: boolean;
  showHeader?: boolean;
  showActions?: boolean;
  buttons?: ButtonEntry[];
  pairs?: PairEntry[];
  controls?: FilterControl[];
  tabs?: TabEntry[];
  badges?: string[];
  tone?: string;
  progress?: number;
}

export interface CanvasBlock {
  id: string;
  kind: BlockKind;
  /** Layer name, renameable independently of the visible label. */
  name: string;
  hidden: boolean;
  props: BlockProps;
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export type IconKey =
  | 'heading'
  | 'text'
  | 'caption'
  | 'divider'
  | 'spacer'
  | 'input'
  | 'textarea'
  | 'select'
  | 'search'
  | 'calendar'
  | 'range'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'segment'
  | 'button'
  | 'table'
  | 'stat'
  | 'keyValue'
  | 'empty'
  | 'tabs'
  | 'badge'
  | 'progress'
  | 'pattern';

export interface BlockDefinition {
  kind: BlockKind;
  label: string;
  icon: IconKey;
  defaults: BlockProps;
}

export const BLOCK_CATALOG: Record<BlockKind, BlockDefinition> = {
  screenHeader: {
    kind: 'screenHeader',
    label: 'Screen header',
    icon: 'heading',
    defaults: {
      label: 'Screen title',
      subtitle: '',
      showActions: true,
      buttons: [
        { label: 'Download', variant: 'outline' },
        { label: 'Register', variant: 'default' },
      ],
    },
  },
  heading: {
    kind: 'heading',
    label: 'Heading',
    icon: 'heading',
    defaults: { label: 'Section heading', headingLevel: 2, align: 'left' },
  },
  paragraph: {
    kind: 'paragraph',
    label: 'Paragraph',
    icon: 'text',
    defaults: { label: 'Describe this section for the reader.', align: 'left' },
  },
  caption: {
    kind: 'caption',
    label: 'Caption',
    icon: 'caption',
    defaults: { label: 'Supporting caption text' },
  },
  divider: { kind: 'divider', label: 'Divider', icon: 'divider', defaults: {} },
  spacer: { kind: 'spacer', label: 'Spacer', icon: 'spacer', defaults: { height: 24 } },
  input: {
    kind: 'input',
    label: 'Input field',
    icon: 'input',
    defaults: {
      label: 'Input field',
      placeholder: 'Enter a value',
      value: '',
      required: false,
      width: 240,
    },
  },
  textarea: {
    kind: 'textarea',
    label: 'Text area',
    icon: 'textarea',
    defaults: {
      label: 'Note',
      placeholder: 'Write a note…',
      value: '',
      height: 80,
    },
  },
  select: {
    kind: 'select',
    label: 'Select box',
    icon: 'select',
    defaults: {
      label: 'Select box',
      options: ['Option A', 'Option B', 'Option C'],
      activeIndex: 0,
      required: false,
      width: 200,
    },
  },
  autocomplete: {
    kind: 'autocomplete',
    label: 'Autocomplete search',
    icon: 'search',
    defaults: { label: 'Search', placeholder: 'Type to search…', width: 260 },
  },
  datePicker: {
    kind: 'datePicker',
    label: 'Date picker',
    icon: 'calendar',
    defaults: { label: 'Date', value: '2026-07-30', required: false, width: 170 },
  },
  dateRange: {
    kind: 'dateRange',
    label: 'Date range',
    icon: 'range',
    defaults: {
      label: 'Date range',
      startValue: '2026-06-01',
      endValue: '2026-07-28',
      showQuickRanges: true,
      quickRanges: ['1 week', '1 month', '3 months', '1 year'],
      activeIndex: 1,
      required: false,
      width: 170,
    },
  },
  radioGroup: {
    kind: 'radioGroup',
    label: 'Radio group',
    icon: 'radio',
    defaults: {
      label: 'Choose one',
      options: ['Option A', 'Option B'],
      activeIndex: 0,
      direction: 'horizontal',
    },
  },
  checkbox: {
    kind: 'checkbox',
    label: 'Checkbox',
    icon: 'checkbox',
    defaults: { label: 'I agree to the terms', checked: false },
  },
  switch: {
    kind: 'switch',
    label: 'Switch',
    icon: 'switch',
    defaults: { label: 'Enable notifications', checked: true },
  },
  segmented: {
    kind: 'segmented',
    label: 'Segmented toggle',
    icon: 'segment',
    defaults: { label: 'View', options: ['List', 'Board', 'Calendar'], activeIndex: 0 },
  },
  buttonBar: {
    kind: 'buttonBar',
    label: 'Button bar',
    icon: 'button',
    defaults: {
      align: 'left',
      buttons: [
        { label: 'Save', variant: 'default' },
        { label: 'Cancel', variant: 'outline' },
      ],
    },
  },
  filterBar: {
    kind: 'filterBar',
    label: 'Filter bar',
    icon: 'search',
    defaults: {
      controls: [
        { type: 'search', placeholder: 'Search…' },
        { type: 'select', label: 'Status', options: ['All statuses', 'Draft', 'Approved'] },
      ],
    },
  },
  formGrid: {
    kind: 'formGrid',
    label: 'Field grid',
    icon: 'keyValue',
    defaults: {
      label: 'Details',
      pairs: [
        { key: 'Title', value: 'July week 5' },
        { key: 'Period', value: '2026-07-27 ~ 2026-07-31' },
        { key: 'Cost centre', value: 'Finance & Accounting' },
        { key: 'Payout account', value: 'KB 123456-01-789012' },
      ],
    },
  },
  table: {
    kind: 'table',
    label: 'Results table',
    icon: 'table',
    defaults: {
      label: 'Results',
      columns: [
        'Evidence status',
        'Created date',
        'Supplier name',
        'Supplier biz. no.',
        'Supplier CEO',
        'Amount',
        'Tax invoice',
      ],
      rows: 6,
      showHeader: true,
      striped: false,
      dense: false,
    },
  },
  statCards: {
    kind: 'statCards',
    label: 'Stat cards',
    icon: 'stat',
    defaults: {
      pairs: [
        { key: 'Total', value: '269' },
        { key: 'Draft', value: '259' },
        { key: 'Approved', value: '10' },
      ],
    },
  },
  keyValue: {
    kind: 'keyValue',
    label: 'Key-value list',
    icon: 'keyValue',
    defaults: {
      label: 'Details',
      pairs: [
        { key: 'Supplier', value: 'Visionlyu Co., Ltd.' },
        { key: 'Business no.', value: '2208195788' },
        { key: 'Amount', value: '943.21' },
      ],
    },
  },
  emptyState: {
    kind: 'emptyState',
    label: 'Empty state',
    icon: 'empty',
    defaults: { label: 'No records found', helpText: 'Adjust your filters and search again.' },
  },
  statusTabs: {
    kind: 'statusTabs',
    label: 'Status tabs',
    icon: 'tabs',
    defaults: {
      tabs: [
        { label: 'Draft', count: 259 },
        { label: 'Unsubmitted', count: 10 },
        { label: 'In approval', count: 0 },
        { label: 'Approved', count: 0 },
        { label: 'Rejected', count: 0 },
        { label: 'All', count: 269 },
      ],
      activeIndex: 0,
    },
  },
  badgeRow: {
    kind: 'badgeRow',
    label: 'Badge row',
    icon: 'badge',
    defaults: { badges: ['Draft', 'Urgent', 'Reviewed'], tone: 'secondary' },
  },
  banner: {
    kind: 'banner',
    label: 'Banner',
    icon: 'badge',
    defaults: {
      label: 'Returned to you',
      helpText: 'Add the missing receipt and resubmit.',
      tone: 'amber',
    },
  },
  toggleList: {
    kind: 'toggleList',
    label: 'Settings rows',
    icon: 'switch',
    defaults: {
      label: 'Policy',
      pairs: [
        {
          key: 'Close the month automatically',
          value: 'Locks the period once every cost centre reports complete.',
          checked: true,
        },
        {
          key: 'Require evidence before approval',
          value: 'A charge with no receipt cannot be approved.',
          checked: true,
        },
      ],
    },
  },
  taskList: {
    kind: 'taskList',
    label: 'Task list',
    icon: 'tabs',
    defaults: {
      label: 'What needs me',
      pairs: [
        {
          key: '8 items blocking the close',
          value: 'Missing evidence in Operations and R&D',
          note: 'Due 2026-08-05',
          tone: 'red',
        },
        {
          key: '12 corporate card charges to approve',
          value: 'July 2026 · ₩3,684,900',
          note: 'Due 2026-08-02',
          tone: 'amber',
        },
      ],
    },
  },
  timeline: {
    kind: 'timeline',
    label: 'History',
    icon: 'progress',
    defaults: {
      label: 'History',
      pairs: [
        { key: 'Created the receipt', value: 'Kim Minsu · 2026-07-31 14:22' },
        { key: 'Attached receipt-scan.pdf', value: 'Kim Minsu · 2026-07-31 14:24' },
      ],
    },
  },
  fileList: {
    kind: 'fileList',
    label: 'Attachments',
    icon: 'empty',
    defaults: {
      label: 'Evidence',
      pairs: [
        { key: 'receipt-scan.pdf', value: '412 KB' },
        { key: 'card-slip.jpg', value: '188 KB' },
      ],
    },
  },
  metricBars: {
    kind: 'metricBars',
    label: 'Metric bars',
    icon: 'progress',
    defaults: {
      label: 'Spend by category',
      pairs: [
        { key: 'Software', value: '₩16,564,000', progress: 34 },
        { key: 'Travel', value: '₩13,154,500', progress: 27 },
      ],
    },
  },
  progressSummary: {
    kind: 'progressSummary',
    label: 'Progress summary',
    icon: 'progress',
    defaults: { label: 'Completion', progress: 64, helpText: '172 of 269 processed' },
  },
};

export interface PatternDefinition {
  id: string;
  label: string;
  blocks: { kind: BlockKind; props?: BlockProps }[];
}

export const PATTERN_CATALOG: PatternDefinition[] = [
  {
    id: 'listPage',
    label: 'List page',
    blocks: [
      { kind: 'screenHeader', props: { label: 'Purchase Tax Invoice' } },
      { kind: 'statusTabs' },
      { kind: 'dateRange' },
      { kind: 'table' },
    ],
  },
  {
    id: 'detailPage',
    label: 'Detail page',
    blocks: [
      { kind: 'screenHeader', props: { label: 'Invoice detail' } },
      { kind: 'keyValue' },
      { kind: 'divider' },
      { kind: 'table', props: { label: 'Line items', rows: 3 } },
      { kind: 'buttonBar' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    blocks: [
      { kind: 'screenHeader', props: { label: 'Dashboard', showActions: false } },
      { kind: 'statCards' },
      { kind: 'progressSummary' },
      { kind: 'table', props: { label: 'Recent activity', rows: 4 } },
    ],
  },
];

export type PaletteEntry =
  { type: 'block'; kind: BlockKind } | { type: 'pattern'; patternId: string };

export interface PaletteGroup {
  label: string;
  entries: PaletteEntry[];
  defaultExpanded?: boolean;
}

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    label: 'Screen patterns',
    entries: PATTERN_CATALOG.map((pattern) => ({ type: 'pattern', patternId: pattern.id })),
  },
  {
    label: 'Screen skeleton',
    entries: [
      { type: 'block', kind: 'screenHeader' },
      { type: 'block', kind: 'divider' },
      { type: 'block', kind: 'spacer' },
    ],
  },
  {
    label: 'Text',
    entries: [
      { type: 'block', kind: 'heading' },
      { type: 'block', kind: 'paragraph' },
      { type: 'block', kind: 'caption' },
    ],
  },
  {
    label: 'Input',
    defaultExpanded: true,
    entries: [
      { type: 'block', kind: 'filterBar' },
      { type: 'block', kind: 'input' },
      { type: 'block', kind: 'textarea' },
      { type: 'block', kind: 'select' },
      { type: 'block', kind: 'autocomplete' },
      { type: 'block', kind: 'datePicker' },
      { type: 'block', kind: 'dateRange' },
      { type: 'block', kind: 'radioGroup' },
      { type: 'block', kind: 'checkbox' },
      { type: 'block', kind: 'switch' },
      { type: 'block', kind: 'segmented' },
      { type: 'block', kind: 'buttonBar' },
    ],
  },
  {
    label: 'Data',
    entries: [
      { type: 'block', kind: 'table' },
      { type: 'block', kind: 'statCards' },
      { type: 'block', kind: 'keyValue' },
      { type: 'block', kind: 'formGrid' },
      { type: 'block', kind: 'taskList' },
      { type: 'block', kind: 'metricBars' },
      { type: 'block', kind: 'fileList' },
      { type: 'block', kind: 'timeline' },
      { type: 'block', kind: 'emptyState' },
    ],
  },
  {
    label: 'Status & summary',
    entries: [
      { type: 'block', kind: 'statusTabs' },
      { type: 'block', kind: 'banner' },
      { type: 'block', kind: 'badgeRow' },
      { type: 'block', kind: 'toggleList' },
      { type: 'block', kind: 'progressSummary' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Property schema — drives the inspector                              */
/* ------------------------------------------------------------------ */

export type FieldSpec =
  | { key: keyof BlockProps; type: 'text'; label: string; placeholder?: string }
  | { key: keyof BlockProps; type: 'textarea'; label: string }
  | {
      key: keyof BlockProps;
      type: 'number';
      label: string;
      min?: number;
      max?: number;
      hint?: string;
    }
  | { key: keyof BlockProps; type: 'boolean'; label: string }
  | { key: keyof BlockProps; type: 'segment'; label: string; options: string[] }
  | { key: keyof BlockProps; type: 'stringList'; label: string; itemLabel: string }
  | {
      key: keyof BlockProps;
      type: 'pairList';
      label: string;
      keyHeader: string;
      valueHeader: string;
    }
  | { key: keyof BlockProps; type: 'tabList'; label: string }
  | { key: keyof BlockProps; type: 'buttonList'; label: string }
  | { key: keyof BlockProps; type: 'controlList'; label: string }
  | {
      key: keyof BlockProps;
      type: 'rowList';
      label: string;
      /** Which extra column the rows carry, beyond a title and a description. */
      row: 'toggle' | 'task' | 'plain' | 'metric';
    }
  | {
      key: keyof BlockProps;
      type: 'optionIndex';
      label: string;
      from: 'options' | 'tabs' | 'quickRanges';
    };

const WIDTH_FIELD: FieldSpec = {
  key: 'width',
  type: 'number',
  label: 'Width (px)',
  min: 0,
  max: 720,
  hint: '0 = full width',
};
const ALIGN_FIELD: FieldSpec = {
  key: 'align',
  type: 'segment',
  label: 'Align',
  options: ['left', 'center', 'right'],
};

export const PROPERTY_SCHEMA: Record<BlockKind, FieldSpec[]> = {
  screenHeader: [
    { key: 'label', type: 'text', label: 'Title' },
    { key: 'subtitle', type: 'text', label: 'Breadcrumb / subtitle' },
    { key: 'showActions', type: 'boolean', label: 'Show action buttons' },
    { key: 'buttons', type: 'buttonList', label: 'Action buttons' },
  ],
  heading: [
    { key: 'label', type: 'text', label: 'Text' },
    { key: 'headingLevel', type: 'segment', label: 'Level', options: ['1', '2', '3'] },
    ALIGN_FIELD,
  ],
  paragraph: [{ key: 'label', type: 'textarea', label: 'Text' }, ALIGN_FIELD],
  caption: [{ key: 'label', type: 'text', label: 'Text' }],
  divider: [],
  spacer: [{ key: 'height', type: 'number', label: 'Height (px)', min: 4, max: 200 }],
  input: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'placeholder', type: 'text', label: 'Placeholder' },
    { key: 'value', type: 'text', label: 'Default value' },
    { key: 'helpText', type: 'text', label: 'Help text' },
    { key: 'required', type: 'boolean', label: 'Required' },
    WIDTH_FIELD,
  ],
  textarea: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'placeholder', type: 'text', label: 'Placeholder' },
    { key: 'value', type: 'textarea', label: 'Default value' },
    { key: 'height', type: 'number', label: 'Height (px)', min: 40, max: 400 },
    WIDTH_FIELD,
  ],
  select: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'options', type: 'stringList', label: 'Options', itemLabel: 'Option' },
    { key: 'activeIndex', type: 'optionIndex', label: 'Selected', from: 'options' },
    { key: 'required', type: 'boolean', label: 'Required' },
    WIDTH_FIELD,
  ],
  autocomplete: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'placeholder', type: 'text', label: 'Placeholder' },
    WIDTH_FIELD,
  ],
  datePicker: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'value', type: 'text', label: 'Value (YYYY-MM-DD)' },
    { key: 'required', type: 'boolean', label: 'Required' },
    WIDTH_FIELD,
  ],
  dateRange: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'startValue', type: 'text', label: 'Start date (YYYY-MM-DD)' },
    { key: 'endValue', type: 'text', label: 'End date (YYYY-MM-DD)' },
    { key: 'required', type: 'boolean', label: 'Required' },
    { key: 'showQuickRanges', type: 'boolean', label: 'Show quick-range chips' },
    { key: 'quickRanges', type: 'stringList', label: 'Quick range items', itemLabel: 'Range' },
    { key: 'activeIndex', type: 'optionIndex', label: 'Active range', from: 'quickRanges' },
    WIDTH_FIELD,
  ],
  radioGroup: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'options', type: 'stringList', label: 'Options', itemLabel: 'Option' },
    { key: 'activeIndex', type: 'optionIndex', label: 'Selected', from: 'options' },
    { key: 'direction', type: 'segment', label: 'Direction', options: ['horizontal', 'vertical'] },
  ],
  checkbox: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'checked', type: 'boolean', label: 'Checked' },
    { key: 'helpText', type: 'text', label: 'Help text' },
  ],
  switch: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'checked', type: 'boolean', label: 'On' },
    { key: 'helpText', type: 'text', label: 'Help text' },
  ],
  segmented: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'options', type: 'stringList', label: 'Segments', itemLabel: 'Segment' },
    { key: 'activeIndex', type: 'optionIndex', label: 'Active', from: 'options' },
  ],
  buttonBar: [{ key: 'buttons', type: 'buttonList', label: 'Buttons' }, ALIGN_FIELD],
  filterBar: [{ key: 'controls', type: 'controlList', label: 'Filters' }],
  formGrid: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'pairList', label: 'Fields', keyHeader: 'Field', valueHeader: 'Value' },
  ],
  banner: [
    { key: 'label', type: 'text', label: 'Title' },
    { key: 'helpText', type: 'textarea', label: 'Message' },
    {
      key: 'tone',
      type: 'segment',
      label: 'Tone',
      options: ['info', 'success', 'warning', 'danger'],
    },
  ],
  toggleList: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'rowList', label: 'Rows', row: 'toggle' },
  ],
  taskList: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'rowList', label: 'Tasks', row: 'task' },
  ],
  timeline: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'rowList', label: 'Entries', row: 'plain' },
  ],
  fileList: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'rowList', label: 'Files', row: 'plain' },
  ],
  metricBars: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'rowList', label: 'Rows', row: 'metric' },
  ],
  table: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'columns', type: 'stringList', label: 'Columns', itemLabel: 'Column' },
    { key: 'rows', type: 'number', label: 'Visible rows', min: 1, max: 8 },
    { key: 'showHeader', type: 'boolean', label: 'Show header row' },
    { key: 'striped', type: 'boolean', label: 'Striped rows' },
    { key: 'dense', type: 'boolean', label: 'Dense spacing' },
  ],
  statCards: [
    { key: 'pairs', type: 'pairList', label: 'Cards', keyHeader: 'Label', valueHeader: 'Value' },
  ],
  keyValue: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'pairs', type: 'pairList', label: 'Rows', keyHeader: 'Key', valueHeader: 'Value' },
  ],
  emptyState: [
    { key: 'label', type: 'text', label: 'Title' },
    { key: 'helpText', type: 'text', label: 'Help text' },
  ],
  statusTabs: [
    { key: 'tabs', type: 'tabList', label: 'Tabs' },
    { key: 'activeIndex', type: 'optionIndex', label: 'Active tab', from: 'tabs' },
  ],
  badgeRow: [
    { key: 'badges', type: 'stringList', label: 'Badges', itemLabel: 'Badge' },
    {
      key: 'tone',
      type: 'segment',
      label: 'Tone',
      options: ['secondary', 'success', 'warning', 'danger', 'info'],
    },
  ],
  progressSummary: [
    { key: 'label', type: 'text', label: 'Label' },
    { key: 'progress', type: 'number', label: 'Percent', min: 0, max: 100 },
    { key: 'helpText', type: 'text', label: 'Help text' },
  ],
};

/* ------------------------------------------------------------------ */
/* Factories & initial canvas                                          */
/* ------------------------------------------------------------------ */

let idCounter = 0;

export function nextBlockId(): string {
  idCounter += 1;
  return `blk-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlock(kind: BlockKind, overrides?: BlockProps): CanvasBlock {
  const definition = BLOCK_CATALOG[kind];
  return {
    id: nextBlockId(),
    kind,
    name: definition.label,
    hidden: false,
    props: { ...definition.defaults, ...overrides },
  };
}

export function createPatternBlocks(patternId: string): CanvasBlock[] {
  const pattern = PATTERN_CATALOG.find((entry) => entry.id === patternId);
  if (!pattern) return [];
  return pattern.blocks.map((entry) => createBlock(entry.kind, entry.props));
}

export function initialCanvas(): CanvasBlock[] {
  return createPatternBlocks('listPage');
}

export const CANVAS_STORAGE_KEY = 'we-adk:sketcher:canvas';

/** Storage key for one Builder screen's canvas. */
export function screenStorageKey(screenId: string): string {
  return `${CANVAS_STORAGE_KEY}:${screenId}`;
}

export function isCanvasBlockArray(value: unknown): value is CanvasBlock[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { kind?: unknown }).kind === 'string',
    )
  );
}

/**
 * Blocks for a Builder screen: whatever the user last saved, otherwise `seed`
 * if the caller has a layout for this screen, otherwise the seed pattern.
 * Browser-only (reads localStorage).
 */
export function loadScreenBlocks(
  screenId: string,
  seedPattern: string,
  seed?: () => CanvasBlock[] | null,
): CanvasBlock[] {
  try {
    const raw = window.localStorage.getItem(screenStorageKey(screenId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isCanvasBlockArray(parsed)) return parsed;
    }
  } catch {
    // Unreadable storage — fall through to the seed layout.
  }
  return seed?.() ?? createPatternBlocks(seedPattern);
}

/**
 * Widths a screen is looked at in. `full` is not a device — it is the window
 * itself, with `width: 0` meaning "no cap", which is what a screen opened in
 * its own browser tab should do rather than float in a 1024px card.
 */
export const DEVICE_PRESETS = [
  { id: 'full', label: 'Full width', width: 0 },
  { id: 'desktop', label: 'Desktop', width: 1440 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', width: 390 },
] as const;

export type DevicePresetId = (typeof DEVICE_PRESETS)[number]['id'];

/* ------------------------------------------------------------------ */
/* AI chat (mock, deterministic command parser)                        */
/* ------------------------------------------------------------------ */

export interface ChatEntry {
  from: 'me' | 'ai';
  text: string;
}

export const INITIAL_CHAT: ChatEntry[] = [
  {
    from: 'ai',
    text: 'I run on your local Claude Code install. In **Edit** I change this canvas directly — try:\n· "add a checkbox under the tabs"\n· "make the table dense and drop the CEO column"\n· "build me a dashboard instead"\n\nSwitch to **Ask** to talk about the screen instead of editing it.',
  },
];

export const AI_MESSAGE_SEED = '';
