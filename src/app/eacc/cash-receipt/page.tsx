'use client';

import { ChevronDown, Download, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
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

type ReceiptStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

interface ReceiptRow {
  id: string;
  receiptNo: string;
  date: string;
  supplier: string;
  bizNo: string;
  purpose: string;
  amount: number;
  taxAmount: number;
  status: ReceiptStatus;
  submittedBy: string;
}

const RECEIPTS: ReceiptRow[] = [
  {
    id: 'r-1',
    receiptNo: 'RCP-2026-00187',
    date: '2026-07-31',
    supplier: 'Stationery World Co.',
    bizNo: '1108734521',
    purpose: 'Office supplies',
    amount: 128_000,
    taxAmount: 11_636,
    status: 'Draft',
    submittedBy: 'Kim Minsu',
  },
  {
    id: 'r-2',
    receiptNo: 'RCP-2026-00186',
    date: '2026-07-30',
    supplier: 'Korea Telecom',
    bizNo: '1028611944',
    purpose: 'Phone bill July',
    amount: 45_000,
    taxAmount: 4_090,
    status: 'Submitted',
    submittedBy: 'Lee Jiyeon',
  },
  {
    id: 'r-3',
    receiptNo: 'RCP-2026-00185',
    date: '2026-07-30',
    supplier: 'Kakao Mobility',
    bizNo: '2648733920',
    purpose: 'Taxi — client visit',
    amount: 23_400,
    taxAmount: 2_127,
    status: 'Approved',
    submittedBy: 'Park Seongmin',
  },
  {
    id: 'r-4',
    receiptNo: 'RCP-2026-00184',
    date: '2026-07-29',
    supplier: 'GS25 Convenience',
    bizNo: '1218854032',
    purpose: 'Team refreshments',
    amount: 87_300,
    taxAmount: 7_936,
    status: 'Draft',
    submittedBy: 'Choi Dongwook',
  },
  {
    id: 'r-5',
    receiptNo: 'RCP-2026-00183',
    date: '2026-07-28',
    supplier: 'Woori Printing',
    bizNo: '2048711620',
    purpose: 'Presentation printing',
    amount: 54_000,
    taxAmount: 4_909,
    status: 'Approved',
    submittedBy: 'Jung Minjae',
  },
  {
    id: 'r-6',
    receiptNo: 'RCP-2026-00182',
    date: '2026-07-28',
    supplier: 'Financial Settlement Assoc.',
    bizNo: '1298208745',
    purpose: 'Registration fee',
    amount: 220_000,
    taxAmount: 20_000,
    status: 'Submitted',
    submittedBy: 'Yoo Namwon',
  },
  {
    id: 'r-7',
    receiptNo: 'RCP-2026-00181',
    date: '2026-07-27',
    supplier: 'Haedong Camtech',
    bizNo: '6201170567',
    purpose: 'Equipment rental',
    amount: 341_000,
    taxAmount: 31_000,
    status: 'Approved',
    submittedBy: 'Shin Hyunjung',
  },
  {
    id: 'r-8',
    receiptNo: 'RCP-2026-00180',
    date: '2026-07-26',
    supplier: 'The Office Garden Co.',
    bizNo: '1058633625',
    purpose: 'Cleaning service',
    amount: 728_200,
    taxAmount: 66_200,
    status: 'Rejected',
    submittedBy: 'Park Taehyuk',
  },
  {
    id: 'r-9',
    receiptNo: 'RCP-2026-00179',
    date: '2026-07-25',
    supplier: 'Visionlyu Co., Ltd.',
    bizNo: '2208195788',
    purpose: 'Software license',
    amount: 100_000,
    taxAmount: 9_090,
    status: 'Draft',
    submittedBy: 'Moon Namwon',
  },
  {
    id: 'r-10',
    receiptNo: 'RCP-2026-00178',
    date: '2026-07-24',
    supplier: 'LG Vendor',
    bizNo: '111',
    purpose: 'Parts purchase',
    amount: 2_080_579,
    taxAmount: 189_143,
    status: 'Approved',
    submittedBy: 'Kim Minsu',
  },
];

const STATUS_VARIANT: Record<ReceiptStatus, 'secondary' | 'info' | 'success' | 'danger'> = {
  Draft: 'secondary',
  Submitted: 'info',
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
  title: 'Cash Receipt',
  subtitle: 'eACC Cloud > Tax & Receipts > Cash Receipt',
};

const FILTERS_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Filters',
  filters: [
    { key: 'search', label: 'Search', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'date-range', label: 'Date Range', visible: true },
    { key: 'submitted-by', label: 'Submitted By', visible: true },
  ],
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Receipt Table',
  columns: [
    { key: 'receiptNo', label: 'Receipt No.', visible: true },
    { key: 'date', label: 'Date', visible: true },
    { key: 'supplier', label: 'Supplier', visible: true },
    { key: 'bizNo', label: 'Business No.', visible: true },
    { key: 'purpose', label: 'Purpose', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'taxAmount', label: 'Tax', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'submittedBy', label: 'Submitted By', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CashReceiptPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // What the screen looks like right now: its defaults, plus any edits.
  const header = useSectionConfig('receipt-header', HEADER_DEFAULTS);
  const filters = useSectionConfig('receipt-filters', FILTERS_DEFAULTS);
  const table = useSectionConfig('receipt-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const filtered = RECEIPTS.filter((r) => {
    const matchSearch =
      !search ||
      r.receiptNo.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier.toLowerCase().includes(search.toLowerCase()) ||
      r.submittedBy.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);

  const shownColumns = TABLE_DEFAULTS.columns
    .map((column) => column.key)
    .filter((key) => columnOn(table, key));
  const amountIndex = shownColumns.indexOf('amount');
  const beforeAmount = amountIndex === -1 ? shownColumns.length : amountIndex;
  const afterAmount = shownColumns.length - beforeAmount - (amountIndex === -1 ? 0 : 1);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <EditableSection id="receipt-header" defaults={HEADER_DEFAULTS}>
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
              <Link href="/eacc/cash-receipt/new">
                <Plus className="size-3.5" />
                New Receipt
              </Link>
            </Button>
          </div>
        </div>
      </EditableSection>

      {/* Filters */}
      <EditableSection id="receipt-filters" defaults={FILTERS_DEFAULTS}>
        <div className="flex flex-wrap items-center gap-3">
          {filterOn(filters, 'search') && (
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receipt no, supplier…"
                className="h-9 pl-8 text-sm"
              />
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
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}

          {/* Date range pickers (static) */}
          {filterOn(filters, 'date-range') && (
            <div className="bg-background text-muted-foreground flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
              2026-07-01 ~ 2026-07-31
              <ChevronDown className="size-3.5" />
            </div>
          )}

          {search || statusFilter !== 'all' ? (
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
              Clear
            </Button>
          ) : null}
        </div>
      </EditableSection>

      {/* Table */}
      <EditableSection id="receipt-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                  {columnOn(table, 'receiptNo') && (
                    <th className="py-2.5 pr-3 pl-4">{th('receiptNo', 'Receipt No.')}</th>
                  )}
                  {columnOn(table, 'date') && <th className="px-3 py-2.5">{th('date', 'Date')}</th>}
                  {columnOn(table, 'supplier') && (
                    <th className="px-3 py-2.5">{th('supplier', 'Supplier')}</th>
                  )}
                  {columnOn(table, 'bizNo') && (
                    <th className="px-3 py-2.5">{th('bizNo', 'Business No.')}</th>
                  )}
                  {columnOn(table, 'purpose') && (
                    <th className="px-3 py-2.5">{th('purpose', 'Purpose')}</th>
                  )}
                  {columnOn(table, 'amount') && (
                    <th className="px-3 py-2.5 text-right">{th('amount', 'Amount (₩)')}</th>
                  )}
                  {columnOn(table, 'taxAmount') && (
                    <th className="px-3 py-2.5 text-right">{th('taxAmount', 'Tax')}</th>
                  )}
                  {columnOn(table, 'status') && (
                    <th className="px-3 py-2.5">{th('status', 'Status')}</th>
                  )}
                  {columnOn(table, 'submittedBy') && (
                    <th className="py-2.5 pr-4">{th('submittedBy', 'Submitted By')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0 cursor-pointer"
                  >
                    {columnOn(table, 'receiptNo') && (
                      <td className="py-3 pr-3 pl-4 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                        {row.receiptNo}
                      </td>
                    )}
                    {columnOn(table, 'date') && (
                      <td className="text-muted-foreground px-3 py-3 text-sm tabular-nums">
                        {row.date}
                      </td>
                    )}
                    {columnOn(table, 'supplier') && (
                      <td className="px-3 py-3 text-sm font-medium">{row.supplier}</td>
                    )}
                    {columnOn(table, 'bizNo') && (
                      <td className="text-muted-foreground px-3 py-3 font-mono text-xs">
                        {row.bizNo}
                      </td>
                    )}
                    {columnOn(table, 'purpose') && (
                      <td className="text-muted-foreground max-w-[160px] truncate px-3 py-3 text-sm">
                        {row.purpose}
                      </td>
                    )}
                    {columnOn(table, 'amount') && (
                      <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                        {row.amount.toLocaleString()}
                      </td>
                    )}
                    {columnOn(table, 'taxAmount') && (
                      <td className="text-muted-foreground px-3 py-3 text-right text-sm tabular-nums">
                        {row.taxAmount.toLocaleString()}
                      </td>
                    )}
                    {columnOn(table, 'status') && (
                      <td className="px-3 py-3">
                        <Badge variant={STATUS_VARIANT[row.status]} className="text-[11px]">
                          {row.status}
                        </Badge>
                      </td>
                    )}
                    {columnOn(table, 'submittedBy') && (
                      <td className="text-muted-foreground py-3 pr-4 text-sm">{row.submittedBy}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Spans follow the columns that are switched on, so hiding one
                    does not knock the total out of its column. */}
                <tr className="bg-muted/30 border-t">
                  <td
                    colSpan={Math.max(1, beforeAmount)}
                    className="text-muted-foreground py-2.5 pl-4 text-xs font-semibold"
                  >
                    Total ({filtered.length} items)
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
