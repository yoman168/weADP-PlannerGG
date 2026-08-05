'use client';

import { CheckSquare2, ChevronDown, Download, Plus, Search, Square, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Input, cn } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  filterOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

type CardStatus = 'Draft' | 'In review' | 'Approved' | 'Rejected';

interface CardRow {
  id: string;
  date: string;
  user: string;
  department: string;
  merchant: string;
  category: string;
  amount: number;
  cardNo: string;
  status: CardStatus;
  month: string;
}

const CARD_ROWS: CardRow[] = [
  {
    id: 'cc-1',
    date: '2026-07-31',
    user: 'Kim Minsu',
    department: 'IT',
    merchant: '스타벅스',
    category: 'Food & Beverage',
    amount: 25_500,
    cardNo: '****9901',
    status: 'Draft',
    month: '2026-07',
  },
  {
    id: 'cc-2',
    date: '2026-07-31',
    user: 'Kim Minsu',
    department: 'IT',
    merchant: 'Amazon Web Services',
    category: 'Software',
    amount: 1_240_000,
    cardNo: '****9901',
    status: 'Draft',
    month: '2026-07',
  },
  {
    id: 'cc-3',
    date: '2026-07-30',
    user: 'Lee Jiyeon',
    department: 'Finance',
    merchant: '올리브영',
    category: 'Health',
    amount: 68_900,
    cardNo: '****3820',
    status: 'Draft',
    month: '2026-07',
  },
  {
    id: 'cc-4',
    date: '2026-07-30',
    user: 'Park Seongmin',
    department: 'Operations',
    merchant: 'Korea Gas Corp',
    category: 'Utilities',
    amount: 340_000,
    cardNo: '****5531',
    status: 'Draft',
    month: '2026-07',
  },
  {
    id: 'cc-5',
    date: '2026-07-29',
    user: 'Choi Dongwook',
    department: 'HR',
    merchant: 'GS25',
    category: 'Food & Beverage',
    amount: 12_400,
    cardNo: '****7742',
    status: 'Draft',
    month: '2026-07',
  },
  {
    id: 'cc-6',
    date: '2026-07-29',
    user: 'Jung Minjae',
    department: 'Sales',
    merchant: 'Kakao Mobility',
    category: 'Transport',
    amount: 58_000,
    cardNo: '****9214',
    status: 'In review',
    month: '2026-07',
  },
  {
    id: 'cc-7',
    date: '2026-07-28',
    user: 'Yoo Namwon',
    department: 'R&D',
    merchant: 'Notion Labs',
    category: 'Software',
    amount: 96_000,
    cardNo: '****6617',
    status: 'In review',
    month: '2026-07',
  },
  {
    id: 'cc-8',
    date: '2026-07-27',
    user: 'Shin Hyunjung',
    department: 'Legal',
    merchant: 'Korean Air',
    category: 'Travel',
    amount: 1_820_000,
    cardNo: '****2289',
    status: 'Approved',
    month: '2026-07',
  },
  {
    id: 'cc-9',
    date: '2026-07-26',
    user: 'Moon Namwon',
    department: 'Finance',
    merchant: 'E-Mart',
    category: 'Office Supplies',
    amount: 145_500,
    cardNo: '****3820',
    status: 'Approved',
    month: '2026-07',
  },
  {
    id: 'cc-10',
    date: '2026-07-25',
    user: 'Park Taehyuk',
    department: 'Finance',
    merchant: '교보문고',
    category: 'Books',
    amount: 35_800,
    cardNo: '****0047',
    status: 'Rejected',
    month: '2026-07',
  },
  {
    id: 'cc-11',
    date: '2026-06-30',
    user: 'Kim Minsu',
    department: 'IT',
    merchant: 'AWS',
    category: 'Software',
    amount: 985_000,
    cardNo: '****9901',
    status: 'Approved',
    month: '2026-06',
  },
  {
    id: 'cc-12',
    date: '2026-06-28',
    user: 'Lee Jiyeon',
    department: 'Finance',
    merchant: 'Zoom',
    category: 'Software',
    amount: 75_000,
    cardNo: '****3820',
    status: 'Approved',
    month: '2026-06',
  },
];

const STATUS_VARIANT: Record<CardStatus, 'secondary' | 'info' | 'success' | 'danger'> = {
  Draft: 'secondary',
  'In review': 'info',
  Approved: 'success',
  Rejected: 'danger',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Corporate Card',
  subtitle: 'Corporate Card > Corporate Card',
};

const FILTERS_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Filters',
  filters: [
    { key: 'search', label: 'Search', visible: true },
    { key: 'month', label: 'Month', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'department', label: 'Department', visible: true },
  ],
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Card Transaction Table',
  columns: [
    { key: 'select', label: 'Select', visible: true },
    { key: 'date', label: 'Date', visible: true },
    { key: 'user', label: 'User', visible: true },
    { key: 'department', label: 'Department', visible: true },
    { key: 'merchant', label: 'Merchant', visible: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'cardNo', label: 'Card No.', visible: true },
    { key: 'status', label: 'Status', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CorpCardPage() {
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('2026-07');
  const [statusFilter, setStatusFilter] = useState('Draft');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const header = useSectionConfig('corpcard-header', HEADER_DEFAULTS);
  const filters = useSectionConfig('corpcard-filters', FILTERS_DEFAULTS);
  const table = useSectionConfig('corpcard-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const filtered = CARD_ROWS.filter((r) => {
    const matchSearch =
      !search ||
      r.user.toLowerCase().includes(search.toLowerCase()) ||
      r.merchant.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase());
    const matchMonth = !monthFilter || r.month === monthFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchMonth && matchStatus;
  });

  const draftRows = filtered.filter((r) => r.status === 'Draft');
  const allDraftSelected = draftRows.length > 0 && draftRows.every((r) => selected.has(r.id));
  const someDraftSelected = draftRows.some((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allDraftSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(draftRows.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shownColumns = TABLE_DEFAULTS.columns
    .map((column) => column.key)
    .filter((key) => columnOn(table, key));
  const amountIndex = shownColumns.indexOf('amount');
  const beforeAmount = amountIndex === -1 ? shownColumns.length : amountIndex;
  const afterAmount = shownColumns.length - beforeAmount - (amountIndex === -1 ? 0 : 1);

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);
  const selectedAmount = filtered
    .filter((r) => selected.has(r.id))
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <EditableSection id="corpcard-header" defaults={HEADER_DEFAULTS}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {header.subtitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{header.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" />
              Export
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              New Charge
            </Button>
          </div>
        </div>
      </EditableSection>

      {/* Filters */}
      <EditableSection id="corpcard-filters" defaults={FILTERS_DEFAULTS}>
        <div className="flex flex-wrap items-center gap-3">
          {filterOn(filters, 'search') && (
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user, merchant…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}

          {filterOn(filters, 'month') && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-3 py-1.5">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="2026-07">July 2026</option>
                <option value="2026-06">June 2026</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}

          {filterOn(filters, 'status') && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-3 py-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="all">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="In review">In review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}
        </div>
      </EditableSection>

      {/* Bulk action bar */}
      {someDraftSelected && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selected.size} item{selected.size > 1 ? 's' : ''} selected ·{' '}
            <span className="font-bold">₩{selectedAmount.toLocaleString()}</span> total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setSelected(new Set())}
            >
              <X className="size-3.5" />
              Clear
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowBulkConfirm(true)}
            >
              <CheckSquare2 className="size-3.5" />
              Bulk Approve ({selected.size})
            </Button>
          </div>
        </div>
      )}

      {/* Bulk confirm toast */}
      {showBulkConfirm && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Bulk approved {selected.size} items for{' '}
            {monthFilter === '2026-07' ? 'July 2026' : 'June 2026'}.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowBulkConfirm(false);
              setSelected(new Set());
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Table */}
      <EditableSection id="corpcard-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                  {columnOn(table, 'select') && (
                    <th className="w-10 py-2.5 pr-2 pl-4">
                      <button
                        type="button"
                        onClick={toggleAll}
                        aria-label="Select every draft charge"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {allDraftSelected ? (
                          <CheckSquare2 className="size-4 text-blue-600" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </th>
                  )}
                  {columnOn(table, 'date') && <th className="px-3 py-2.5">{th('date', 'Date')}</th>}
                  {columnOn(table, 'user') && <th className="px-3 py-2.5">{th('user', 'User')}</th>}
                  {columnOn(table, 'department') && (
                    <th className="px-3 py-2.5">{th('department', 'Department')}</th>
                  )}
                  {columnOn(table, 'merchant') && (
                    <th className="px-3 py-2.5">{th('merchant', 'Merchant')}</th>
                  )}
                  {columnOn(table, 'category') && (
                    <th className="px-3 py-2.5">{th('category', 'Category')}</th>
                  )}
                  {columnOn(table, 'amount') && (
                    <th className="px-3 py-2.5 text-right">{th('amount', 'Amount (₩)')}</th>
                  )}
                  {columnOn(table, 'cardNo') && (
                    <th className="px-3 py-2.5">{th('cardNo', 'Card No.')}</th>
                  )}
                  {columnOn(table, 'status') && (
                    <th className="py-2.5 pr-4">{th('status', 'Status')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'hover:bg-muted/40 border-b transition-colors last:border-0 cursor-pointer',
                      selected.has(row.id) && 'bg-blue-50/60 dark:bg-blue-950/20',
                    )}
                    onClick={() => row.status === 'Draft' && toggleRow(row.id)}
                  >
                    {columnOn(table, 'select') && (
                      <td className="py-3 pr-2 pl-4">
                        {row.status === 'Draft' && (
                          <button
                            type="button"
                            aria-label={`Select the ${row.merchant} charge`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(row.id);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {selected.has(row.id) ? (
                              <CheckSquare2 className="size-4 text-blue-600" />
                            ) : (
                              <Square className="size-4" />
                            )}
                          </button>
                        )}
                      </td>
                    )}
                    {columnOn(table, 'date') && (
                      <td className="text-muted-foreground px-3 py-3 text-sm tabular-nums">
                        {row.date}
                      </td>
                    )}
                    {columnOn(table, 'user') && (
                      <td className="px-3 py-3 text-sm font-medium">{row.user}</td>
                    )}
                    {columnOn(table, 'department') && (
                      <td className="text-muted-foreground px-3 py-3 text-sm">{row.department}</td>
                    )}
                    {columnOn(table, 'merchant') && (
                      <td className="px-3 py-3 text-sm">{row.merchant}</td>
                    )}
                    {columnOn(table, 'category') && (
                      <td className="text-muted-foreground px-3 py-3 text-xs">{row.category}</td>
                    )}
                    {columnOn(table, 'amount') && (
                      <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                        {row.amount.toLocaleString()}
                      </td>
                    )}
                    {columnOn(table, 'cardNo') && (
                      <td className="text-muted-foreground px-3 py-3 font-mono text-xs">
                        {row.cardNo}
                      </td>
                    )}
                    {columnOn(table, 'status') && (
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_VARIANT[row.status]} className="text-[11px]">
                          {row.status}
                        </Badge>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t">
                  <td
                    colSpan={Math.max(1, beforeAmount)}
                    className="text-muted-foreground py-2.5 pl-4 text-xs font-semibold"
                  >
                    Total ({filtered.length} transactions)
                  </td>
                  {columnOn(table, 'amount') && (
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      ₩{totalAmount.toLocaleString()}
                    </td>
                  )}
                  {afterAmount > 0 && <td colSpan={afterAmount} />}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
