'use client';

import { ChevronDown, Download, Plus, RotateCcw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { Badge, Button, Card, Input, cn } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

type ExpenseStatus = 'Draft' | 'Submitted' | 'In approval' | 'Approved' | 'Rejected' | 'Returned';

interface ExpenseRow {
  id: string;
  date: string;
  user: string;
  department: string;
  category: string;
  purpose: string;
  amount: number;
  receipt: boolean;
  status: ExpenseStatus;
  note?: string;
}

const EXPENSES: ExpenseRow[] = [
  {
    id: 'pe-1',
    date: '2026-07-31',
    user: 'Kim Minsu',
    department: 'IT',
    category: 'Transport',
    purpose: 'Bus card recharge',
    amount: 50_000,
    receipt: true,
    status: 'Draft',
  },
  {
    id: 'pe-2',
    date: '2026-07-30',
    user: 'Lee Jiyeon',
    department: 'Finance',
    category: 'Meals',
    purpose: 'Team lunch',
    amount: 180_000,
    receipt: true,
    status: 'Submitted',
  },
  {
    id: 'pe-3',
    date: '2026-07-30',
    user: 'Park Seongmin',
    department: 'Operations',
    category: 'Transport',
    purpose: 'Taxi to airport',
    amount: 45_000,
    receipt: true,
    status: 'In approval',
  },
  {
    id: 'pe-4',
    date: '2026-07-29',
    user: 'Choi Dongwook',
    department: 'HR',
    category: 'Office',
    purpose: 'Printer paper',
    amount: 28_000,
    receipt: true,
    status: 'Approved',
  },
  {
    id: 'pe-5',
    date: '2026-07-28',
    user: 'Jung Minjae',
    department: 'Sales',
    category: 'Entertainment',
    purpose: 'Client dinner',
    amount: 320_000,
    receipt: false,
    status: 'Rejected',
    note: 'Receipt required for entertainment expenses over ₩100,000',
  },
  {
    id: 'pe-6',
    date: '2026-07-27',
    user: 'Yoo Namwon',
    department: 'R&D',
    category: 'Books',
    purpose: 'Tech conference book',
    amount: 42_000,
    receipt: true,
    status: 'Returned',
    note: 'Missing cost centre code — please update and resubmit',
  },
  {
    id: 'pe-7',
    date: '2026-07-26',
    user: 'Moon Namwon',
    department: 'Finance',
    category: 'Meals',
    purpose: 'Overtime meal',
    amount: 15_000,
    receipt: true,
    status: 'Returned',
    note: 'Amount exceeds overtime meal policy (₩12,000 max)',
  },
  {
    id: 'pe-8',
    date: '2026-07-25',
    user: 'Shin Hyunjung',
    department: 'Legal',
    category: 'Books',
    purpose: 'Legal reference',
    amount: 88_000,
    receipt: true,
    status: 'Approved',
  },
  {
    id: 'pe-9',
    date: '2026-07-24',
    user: 'Park Taehyuk',
    department: 'Finance',
    category: 'Transport',
    purpose: 'KTX to Busan',
    amount: 92_800,
    receipt: true,
    status: 'In approval',
  },
  {
    id: 'pe-10',
    date: '2026-07-23',
    user: 'Kim Minsu',
    department: 'IT',
    category: 'Office',
    purpose: 'USB hub',
    amount: 35_000,
    receipt: true,
    status: 'Draft',
  },
];

type Tab = 'all' | 'mine' | 'returned';

const STATUS_VARIANT: Record<
  ExpenseStatus,
  'secondary' | 'info' | 'success' | 'danger' | 'warning'
> = {
  Draft: 'secondary',
  Submitted: 'info',
  'In approval': 'info',
  Approved: 'success',
  Rejected: 'danger',
  Returned: 'warning',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Personal Expense',
  subtitle: 'eACC Cloud > Expense Management > Personal Expense',
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Expense Table',
  columns: [
    { key: 'date', label: 'Date', visible: true },
    { key: 'user', label: 'User', visible: true },
    { key: 'department', label: 'Department', visible: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'purpose', label: 'Purpose', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'receipt', label: 'Receipt', visible: true },
    { key: 'status', label: 'Status', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function PersonalExpensePage() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const header = useSectionConfig('expense-header', HEADER_DEFAULTS);
  const table = useSectionConfig('expense-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const returnedCount = EXPENSES.filter((e) => e.status === 'Returned').length;

  const filtered = EXPENSES.filter((e) => {
    const matchTab =
      tab === 'all' ||
      (tab === 'mine' && (e.user === 'Park Taehyuk' || e.user === 'Kim Minsu')) ||
      (tab === 'returned' && e.status === 'Returned');
    const matchSearch =
      !search ||
      e.user.toLowerCase().includes(search.toLowerCase()) ||
      e.purpose.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchTab && matchSearch && matchStatus;
  });

  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);

  const shownColumns = TABLE_DEFAULTS.columns
    .map((column) => column.key)
    .filter((key) => columnOn(table, key));
  const amountIndex = shownColumns.indexOf('amount');
  const beforeAmount = amountIndex === -1 ? shownColumns.length : amountIndex;
  const afterAmount = shownColumns.length - beforeAmount - (amountIndex === -1 ? 0 : 1);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <EditableSection id="expense-header" defaults={HEADER_DEFAULTS}>
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
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/eacc/personal-expense/new">
                <Plus className="size-3.5" />
                New Expense
              </Link>
            </Button>
          </div>
        </div>
      </EditableSection>

      {/* Tabs + filters */}
      <div className="flex flex-col gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-0 border-b">
          {(
            [
              { id: 'all', label: 'All expenses' },
              { id: 'mine', label: 'My expenses' },
              { id: 'returned', label: 'Returned to me', count: returnedCount },
            ] as { id: Tab; label: string; count?: number }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-4 pb-2.5 pt-1 text-sm transition-colors flex items-center gap-2',
                tab === t.id
                  ? 'border-blue-600 font-medium text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  {t.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, category, purpose…"
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="all">All statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="In approval">In approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Returned">Returned</option>
            </select>
            <ChevronDown className="text-muted-foreground size-3.5" />
          </div>

          {(search || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
            >
              <X className="size-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Returned banner */}
      {tab === 'returned' && filtered.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {filtered.length} expense{filtered.length > 1 ? 's' : ''} returned to you
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              Review the notes below, make the required changes, and resubmit.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <EditableSection id="expense-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  {columnOn(table, 'date') && (
                    <th className="py-2.5 pr-3 pl-4">{th('date', 'Date')}</th>
                  )}
                  {columnOn(table, 'user') && <th className="px-3 py-2.5">{th('user', 'User')}</th>}
                  {columnOn(table, 'department') && (
                    <th className="px-3 py-2.5">{th('department', 'Department')}</th>
                  )}
                  {columnOn(table, 'category') && (
                    <th className="px-3 py-2.5">{th('category', 'Category')}</th>
                  )}
                  {columnOn(table, 'purpose') && (
                    <th className="px-3 py-2.5">{th('purpose', 'Purpose')}</th>
                  )}
                  {columnOn(table, 'amount') && (
                    <th className="px-3 py-2.5 text-right">{th('amount', 'Amount (₩)')}</th>
                  )}
                  {columnOn(table, 'receipt') && (
                    <th className="px-3 py-2.5 text-center">{th('receipt', 'Receipt')}</th>
                  )}
                  {columnOn(table, 'status') && (
                    <th className="py-2.5 pr-4">{th('status', 'Status')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  // A returned expense renders two rows, so the fragment is the
                  // list child — that is where the key has to sit.
                  <Fragment key={row.id}>
                    <tr
                      className={cn(
                        'hover:bg-muted/40 transition-colors cursor-pointer',
                        row.status === 'Returned' ? 'border-b-0' : 'border-b last:border-0',
                        row.status === 'Returned' && 'bg-amber-50/50 dark:bg-amber-950/10',
                      )}
                    >
                      {columnOn(table, 'date') && (
                        <td className="text-muted-foreground py-3 pr-3 pl-4 text-sm tabular-nums">
                          {row.date}
                        </td>
                      )}
                      {columnOn(table, 'user') && (
                        <td className="px-3 py-3 text-sm font-medium">{row.user}</td>
                      )}
                      {columnOn(table, 'department') && (
                        <td className="text-muted-foreground px-3 py-3 text-sm">
                          {row.department}
                        </td>
                      )}
                      {columnOn(table, 'category') && (
                        <td className="text-muted-foreground px-3 py-3 text-sm">{row.category}</td>
                      )}
                      {columnOn(table, 'purpose') && (
                        <td className="max-w-[200px] truncate px-3 py-3 text-sm">{row.purpose}</td>
                      )}
                      {columnOn(table, 'amount') && (
                        <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                          {row.amount.toLocaleString()}
                        </td>
                      )}
                      {columnOn(table, 'receipt') && (
                        <td className="px-3 py-3 text-center">
                          {row.receipt ? (
                            <span className="text-xs font-medium text-emerald-600">✓</span>
                          ) : (
                            <span className="text-xs font-medium text-red-500">✗</span>
                          )}
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
                    {row.status === 'Returned' && row.note && (
                      <tr className="border-b bg-amber-50/50 last:border-0 dark:bg-amber-950/10">
                        <td colSpan={Math.max(1, shownColumns.length)} className="px-4 pb-3">
                          <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                            <RotateCcw className="mt-0.5 size-3 shrink-0" />
                            {row.note}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t">
                  <td
                    colSpan={Math.max(1, beforeAmount)}
                    className="text-muted-foreground py-2.5 pl-4 text-xs font-semibold"
                  >
                    Total ({filtered.length} expenses)
                  </td>
                  {columnOn(table, 'amount') && (
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      {totalAmount.toLocaleString()}
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
