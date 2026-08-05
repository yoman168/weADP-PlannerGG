'use client';

import { ChevronDown, Download, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Input } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  filterOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data  (per July CR: CEO column removed)                         */
/* ------------------------------------------------------------------ */

type InvoiceStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
type InvoiceType = 'Tax invoice' | 'Invoice' | 'Revised tax invoice';

interface TaxInvoiceRow {
  id: string;
  date: string;
  supplierName: string;
  supplierBizNo: string;
  amount: number;
  taxAmount: number;
  invoiceType: InvoiceType;
  invoiceNo: string;
  status: InvoiceStatus;
  submittedBy: string;
}

const INVOICES: TaxInvoiceRow[] = [
  {
    id: 'ti-1',
    date: '2026-07-27',
    supplierName: 'LG Vendor',
    supplierBizNo: '111',
    amount: 2_080_579,
    taxAmount: 189_143,
    invoiceType: 'Invoice',
    invoiceNo: 'INV-2026-00834',
    status: 'Draft',
    submittedBy: 'Kim Minsu',
  },
  {
    id: 'ti-2',
    date: '2026-07-27',
    supplierName: 'Visionlyu Co., Ltd.',
    supplierBizNo: '2208195788',
    amount: 100,
    taxAmount: 9,
    invoiceType: 'Invoice',
    invoiceNo: 'INV-2026-00833',
    status: 'Draft',
    submittedBy: 'Lee Jiyeon',
  },
  {
    id: 'ti-3',
    date: '2026-07-23',
    supplierName: 'Visionlyu Co., Ltd.',
    supplierBizNo: '2208195788',
    amount: 654,
    taxAmount: 59,
    invoiceType: 'Invoice',
    invoiceNo: 'INV-2026-00822',
    status: 'Draft',
    submittedBy: 'Lee Jiyeon',
  },
  {
    id: 'ti-4',
    date: '2026-07-23',
    supplierName: 'Visionlyu Co., Ltd.',
    supplierBizNo: '2208195788',
    amount: 943,
    taxAmount: 85,
    invoiceType: 'Tax invoice',
    invoiceNo: 'TAX-2026-00819',
    status: 'Submitted',
    submittedBy: 'Park Seongmin',
  },
  {
    id: 'ti-5',
    date: '2026-07-06',
    supplierName: 'iBeeree Inc.',
    supplierBizNo: '2148733800',
    amount: -319_000,
    taxAmount: -29_000,
    invoiceType: 'Revised tax invoice',
    invoiceNo: 'RTAX-2026-00741',
    status: 'Approved',
    submittedBy: 'Choi Dongwook',
  },
  {
    id: 'ti-6',
    date: '2026-07-03',
    supplierName: 'Financial Settlement Assoc.',
    supplierBizNo: '1298208745',
    amount: 220_000,
    taxAmount: 20_000,
    invoiceType: 'Tax invoice',
    invoiceNo: 'TAX-2026-00718',
    status: 'Approved',
    submittedBy: 'Jung Minjae',
  },
  {
    id: 'ti-7',
    date: '2026-07-03',
    supplierName: 'Haedong Camtech',
    supplierBizNo: '6201170567',
    amount: 341_000,
    taxAmount: 31_000,
    invoiceType: 'Tax invoice',
    invoiceNo: 'TAX-2026-00717',
    status: 'Approved',
    submittedBy: 'Yoo Namwon',
  },
  {
    id: 'ti-8',
    date: '2026-07-03',
    supplierName: 'The Office Garden Co.',
    supplierBizNo: '1058633625',
    amount: 728_200,
    taxAmount: 66_200,
    invoiceType: 'Tax invoice',
    invoiceNo: 'TAX-2026-00716',
    status: 'Approved',
    submittedBy: 'Moon Namwon',
  },
  {
    id: 'ti-9',
    date: '2026-06-28',
    supplierName: 'Korea Software Inc.',
    supplierBizNo: '3012948570',
    amount: 1_500_000,
    taxAmount: 136_363,
    invoiceType: 'Tax invoice',
    invoiceNo: 'TAX-2026-00689',
    status: 'Approved',
    submittedBy: 'Park Taehyuk',
  },
  {
    id: 'ti-10',
    date: '2026-06-15',
    supplierName: 'Naver Corp',
    supplierBizNo: '2208200455',
    amount: 380_000,
    taxAmount: 34_545,
    invoiceType: 'Tax invoice',
    invoiceNo: 'TAX-2026-00602',
    status: 'Rejected',
    submittedBy: 'Shin Hyunjung',
  },
];

const STATUS_VARIANT: Record<InvoiceStatus, 'secondary' | 'info' | 'success' | 'danger'> = {
  Draft: 'secondary',
  Submitted: 'info',
  Approved: 'success',
  Rejected: 'danger',
};

const TYPE_COLORS: Record<InvoiceType, string> = {
  'Tax invoice': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Invoice: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'Revised tax invoice': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Purchase Tax Invoice',
  subtitle: 'Purchase Tax Invoice > Purchase Tax Invoice',
};

const FILTERS_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Filters',
  filters: [
    { key: 'search', label: 'Search', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'type', label: 'Invoice Type', visible: true },
    { key: 'date-range', label: 'Date Range', visible: true },
  ],
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Tax Invoice Table',
  columns: [
    { key: 'date', label: 'Date', visible: true },
    { key: 'supplierName', label: 'Supplier', visible: true },
    { key: 'supplierBizNo', label: 'Business No.', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'taxAmount', label: 'Tax (₩)', visible: true },
    { key: 'invoiceType', label: 'Type', visible: true },
    { key: 'invoiceNo', label: 'Invoice No.', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'submittedBy', label: 'Submitted By', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function TaxInvoicePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const header = useSectionConfig('taxinv-header', HEADER_DEFAULTS);
  const filters = useSectionConfig('taxinv-filters', FILTERS_DEFAULTS);
  const table = useSectionConfig('taxinv-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const filtered = INVOICES.filter((inv) => {
    const matchSearch =
      !search ||
      inv.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplierBizNo.includes(search) ||
      inv.invoiceNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchType = typeFilter === 'all' || inv.invoiceType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalAmount = filtered.reduce((sum, inv) => sum + inv.amount, 0);
  const totalTax = filtered.reduce((sum, inv) => sum + inv.taxAmount, 0);

  const shownColumns = TABLE_DEFAULTS.columns
    .map((column) => column.key)
    .filter((key) => columnOn(table, key));
  const amountIndex = shownColumns.indexOf('amount');
  const beforeAmount = amountIndex === -1 ? shownColumns.length : amountIndex;
  // Everything to the right of the two money columns shares one empty cell.
  const lastMoney = Math.max(amountIndex, shownColumns.indexOf('taxAmount'));
  const afterTax = lastMoney === -1 ? 0 : shownColumns.length - lastMoney - 1;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <EditableSection id="taxinv-header" defaults={HEADER_DEFAULTS}>
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
              New Invoice
            </Button>
          </div>
        </div>
      </EditableSection>

      {/* Filters */}
      <EditableSection id="taxinv-filters" defaults={FILTERS_DEFAULTS}>
        <div className="flex flex-wrap items-center gap-3">
          {filterOn(filters, 'search') && (
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search supplier, invoice no…"
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

          {filterOn(filters, 'type') && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-3 py-1.5">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="all">All types</option>
                <option value="Tax invoice">Tax invoice</option>
                <option value="Invoice">Invoice</option>
                <option value="Revised tax invoice">Revised tax invoice</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}

          {/* Date range (static) */}
          {filterOn(filters, 'date-range') && (
            <div className="bg-background text-muted-foreground flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
              Current month
              <ChevronDown className="size-3.5" />
            </div>
          )}

          {(search || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
      </EditableSection>

      {/* Table */}
      <EditableSection id="taxinv-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  {columnOn(table, 'date') && (
                    <th className="py-2.5 pr-3 pl-4">{th('date', 'Date')}</th>
                  )}
                  {columnOn(table, 'supplierName') && (
                    <th className="px-3 py-2.5">{th('supplierName', 'Supplier')}</th>
                  )}
                  {columnOn(table, 'supplierBizNo') && (
                    <th className="px-3 py-2.5">{th('supplierBizNo', 'Business No.')}</th>
                  )}
                  {columnOn(table, 'amount') && (
                    <th className="px-3 py-2.5 text-right">{th('amount', 'Amount (₩)')}</th>
                  )}
                  {columnOn(table, 'taxAmount') && (
                    <th className="px-3 py-2.5 text-right">{th('taxAmount', 'Tax (₩)')}</th>
                  )}
                  {columnOn(table, 'invoiceType') && (
                    <th className="px-3 py-2.5">{th('invoiceType', 'Type')}</th>
                  )}
                  {columnOn(table, 'invoiceNo') && (
                    <th className="px-3 py-2.5">{th('invoiceNo', 'Invoice No.')}</th>
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
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0 cursor-pointer"
                  >
                    {columnOn(table, 'date') && (
                      <td className="text-muted-foreground py-3 pr-3 pl-4 text-sm tabular-nums">
                        {inv.date}
                      </td>
                    )}
                    {columnOn(table, 'supplierName') && (
                      <td className="max-w-[180px] truncate px-3 py-3 text-sm font-medium">
                        {inv.supplierName}
                      </td>
                    )}
                    {columnOn(table, 'supplierBizNo') && (
                      <td className="text-muted-foreground px-3 py-3 font-mono text-xs">
                        {inv.supplierBizNo}
                      </td>
                    )}
                    {columnOn(table, 'amount') && (
                      <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                        {inv.amount < 0 && <span className="text-red-600">−</span>}
                        {Math.abs(inv.amount).toLocaleString()}
                      </td>
                    )}
                    {columnOn(table, 'taxAmount') && (
                      <td className="text-muted-foreground px-3 py-3 text-right text-sm tabular-nums">
                        {inv.taxAmount < 0 && <span className="text-red-600">−</span>}
                        {Math.abs(inv.taxAmount).toLocaleString()}
                      </td>
                    )}
                    {columnOn(table, 'invoiceType') && (
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[inv.invoiceType]}`}
                        >
                          {inv.invoiceType}
                        </span>
                      </td>
                    )}
                    {columnOn(table, 'invoiceNo') && (
                      <td className="px-3 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">
                        {inv.invoiceNo}
                      </td>
                    )}
                    {columnOn(table, 'status') && (
                      <td className="px-3 py-3">
                        <Badge variant={STATUS_VARIANT[inv.status]} className="text-[11px]">
                          {inv.status}
                        </Badge>
                      </td>
                    )}
                    {columnOn(table, 'submittedBy') && (
                      <td className="text-muted-foreground py-3 pr-4 text-sm">{inv.submittedBy}</td>
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
                    Total ({filtered.length} invoices)
                  </td>
                  {columnOn(table, 'amount') && (
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      {totalAmount.toLocaleString()}
                    </td>
                  )}
                  {columnOn(table, 'taxAmount') && (
                    <td className="text-muted-foreground px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      {totalTax.toLocaleString()}
                    </td>
                  )}
                  {afterTax > 0 && <td colSpan={afterTax} />}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
