'use client';

import { ArrowLeft, Check, Paperclip, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Input, Label, Textarea, cn } from '@/components/ui';
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

interface Line {
  id: string;
  date: string;
  category: string;
  purpose: string;
  amount: number;
  receipt: boolean;
}

const LINES: Line[] = [
  {
    id: 'l-1',
    date: '2026-07-28',
    category: 'Meals',
    purpose: 'Client dinner — Visionlyu',
    amount: 186_000,
    receipt: true,
  },
  {
    id: 'l-2',
    date: '2026-07-28',
    category: 'Transport',
    purpose: 'Taxi back to office',
    amount: 18_400,
    receipt: true,
  },
  {
    id: 'l-3',
    date: '2026-07-29',
    category: 'Office',
    purpose: 'Notebook and pens',
    amount: 24_000,
    receipt: false,
  },
];

const RETURN_NOTE = {
  by: 'Park Taehyuk (Accountant)',
  at: '2026-07-30 09:12',
  text: 'The office supplies line has no receipt attached. Please add it and resubmit — the dinner and taxi are fine.',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Expense Report — July week 5',
  subtitle: 'Personal Expense > EXP-2026-00412',
};

const RETURN_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Returned Notice',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Report Fields',
  filters: [
    { key: 'title', label: 'Title', visible: true },
    { key: 'period', label: 'Period', visible: true },
    { key: 'costCentre', label: 'Cost centre', visible: true },
    { key: 'payout', label: 'Payout account', visible: true },
  ],
};

const LINES_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Expense Lines',
  columns: [
    { key: 'date', label: 'Date', visible: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'purpose', label: 'Purpose', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'receipt', label: 'Receipt', visible: true },
    { key: 'remove', label: 'Remove', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function PersonalExpenseDetailPage() {
  const [lines, setLines] = useState<Line[]>(LINES);
  const [comment, setComment] = useState('');
  const [resubmitted, setResubmitted] = useState(false);

  const header = useSectionConfig('expense-detail-header', HEADER_DEFAULTS);
  const form = useSectionConfig('expense-detail-form', FORM_DEFAULTS);
  const table = useSectionConfig('expense-detail-lines', LINES_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const missingReceipts = lines.filter((line) => !line.receipt).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <EditableSection id="expense-detail-header" defaults={HEADER_DEFAULTS}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/personal-expense" aria-label="Back to the personal expense list">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {header.subtitle}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight">{header.title}</h1>
                <Badge variant={resubmitted ? 'info' : 'warning'}>
                  {resubmitted ? 'Submitted' : 'Returned'}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={missingReceipts > 0 || resubmitted}
            onClick={() => setResubmitted(true)}
          >
            <Check className="size-3.5" />
            Resubmit
          </Button>
        </div>
      </EditableSection>

      {!resubmitted && (
        <EditableSection id="expense-detail-return" defaults={RETURN_DEFAULTS}>
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Returned to you
              </p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                {RETURN_NOTE.text}
              </p>
              <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-500/80">
                {RETURN_NOTE.by} · {RETURN_NOTE.at}
              </p>
            </div>
          </div>
        </EditableSection>
      )}

      <EditableSection id="expense-detail-form" defaults={FORM_DEFAULTS}>
        <Card className="grid gap-4 p-4 shadow-sm sm:grid-cols-2">
          {filterOn(form, 'title') && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Title</Label>
              <Input defaultValue="July week 5" className="h-9 text-sm" />
            </div>
          )}
          {filterOn(form, 'period') && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Period</Label>
              <Input defaultValue="2026-07-27 ~ 2026-07-31" className="h-9 text-sm" />
            </div>
          )}
          {filterOn(form, 'costCentre') && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cost centre</Label>
              <Input defaultValue="Finance & Accounting" className="h-9 text-sm" />
            </div>
          )}
          {filterOn(form, 'payout') && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Payout account</Label>
              <Input defaultValue="KB 123456-01-789012" className="h-9 font-mono text-xs" />
            </div>
          )}
        </Card>
      </EditableSection>

      <EditableSection id="expense-detail-lines" defaults={LINES_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Expense lines</h2>
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
              <Plus className="size-3" />
              Add line
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                  {columnOn(table, 'date') && <th className="py-2.5 pl-4">{th('date', 'Date')}</th>}
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
                    <th className="px-3 py-2.5">{th('receipt', 'Receipt')}</th>
                  )}
                  {columnOn(table, 'remove') && <th className="w-10 py-2.5 pr-4" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.id}
                    className={cn(
                      'border-b last:border-0',
                      !line.receipt && 'bg-amber-50/60 dark:bg-amber-950/20',
                    )}
                  >
                    {columnOn(table, 'date') && (
                      <td className="text-muted-foreground py-3 pl-4 text-sm tabular-nums">
                        {line.date}
                      </td>
                    )}
                    {columnOn(table, 'category') && (
                      <td className="px-3 py-3 text-sm">{line.category}</td>
                    )}
                    {columnOn(table, 'purpose') && (
                      <td className="px-3 py-3 text-sm font-medium">{line.purpose}</td>
                    )}
                    {columnOn(table, 'amount') && (
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        {line.amount.toLocaleString()}
                      </td>
                    )}
                    {columnOn(table, 'receipt') && (
                      <td className="px-3 py-3">
                        {line.receipt ? (
                          <Badge variant="success" className="gap-1 text-[11px]">
                            <Paperclip className="size-2.5" />
                            Attached
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((entry) =>
                                  entry.id === line.id ? { ...entry, receipt: true } : entry,
                                ),
                              )
                            }
                          >
                            <Paperclip className="size-2.5" />
                            Attach
                          </Button>
                        )}
                      </td>
                    )}
                    {columnOn(table, 'remove') && (
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          aria-label={`Remove ${line.purpose}`}
                          onClick={() =>
                            setLines((prev) => prev.filter((entry) => entry.id !== line.id))
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t">
                  <td
                    colSpan={Math.max(
                      1,
                      ['date', 'category', 'purpose'].filter((key) => columnOn(table, key)).length,
                    )}
                    className="text-muted-foreground py-2.5 pl-4 text-xs font-semibold"
                  >
                    Total ({lines.length} lines)
                  </td>
                  {columnOn(table, 'amount') && (
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      ₩{total.toLocaleString()}
                    </td>
                  )}
                  <td colSpan={2} className="py-2.5 pr-4">
                    {missingReceipts > 0 && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        {missingReceipts} without a receipt
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </EditableSection>

      <Card className="flex flex-col gap-2 p-4 shadow-sm">
        <Label className="text-xs">Comment to the accountant</Label>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Receipt for the office supplies is attached now."
          className="min-h-20 text-sm"
        />
      </Card>
    </div>
  );
}
