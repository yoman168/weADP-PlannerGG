'use client';

import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Paperclip,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Separator, Textarea, cn } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

const RECEIPT = {
  receiptNo: 'RCP-2026-00187',
  date: '2026-07-31',
  supplier: 'Stationery World Co.',
  bizNo: '1108734521',
  purpose: 'Office supplies',
  costCentre: 'IT & Infrastructure',
  amount: 128_000,
  taxAmount: 11_636,
  method: 'Corporate card ****9901',
  submittedBy: 'Kim Minsu',
  submittedAt: '2026-07-31 14:22',
  status: 'Draft' as const,
};

const LINE_ITEMS = [
  { id: 'li-1', description: 'A4 paper, 5 boxes', qty: 5, unit: 12_000, amount: 60_000 },
  { id: 'li-2', description: 'Whiteboard markers, 2 packs', qty: 2, unit: 9_000, amount: 18_000 },
  { id: 'li-3', description: 'Desk organiser', qty: 1, unit: 23_000, amount: 23_000 },
  { id: 'li-4', description: 'Printer toner (compatible)', qty: 1, unit: 27_000, amount: 27_000 },
];

const HISTORY = [
  { id: 'h-1', when: '2026-07-31 14:22', who: 'Kim Minsu', what: 'Created the receipt' },
  { id: 'h-2', when: '2026-07-31 14:24', who: 'Kim Minsu', what: 'Attached receipt-scan.pdf' },
  { id: 'h-3', when: '2026-07-31 16:03', who: 'System', what: 'Matched to card charge ****9901' },
];

const EVIDENCE = [
  { id: 'e-1', name: 'receipt-scan.pdf', size: '412 KB' },
  { id: 'e-2', name: 'card-slip.jpg', size: '188 KB' },
];

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Cash Receipt Detail',
  subtitle: 'eACC Cloud > Tax & Receipts > Cash Receipt',
};

const SUMMARY_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Receipt Fields',
  columns: [
    { key: 'receiptNo', label: 'Receipt No.', visible: true },
    { key: 'date', label: 'Date', visible: true },
    { key: 'supplier', label: 'Supplier', visible: true },
    { key: 'bizNo', label: 'Business No.', visible: true },
    { key: 'purpose', label: 'Purpose', visible: true },
    { key: 'costCentre', label: 'Cost centre', visible: true },
    { key: 'method', label: 'Payment method', visible: true },
    { key: 'submittedBy', label: 'Submitted by', visible: true },
  ],
};

const ITEMS_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Line Items',
  columns: [
    { key: 'description', label: 'Description', visible: true },
    { key: 'qty', label: 'Qty', visible: true },
    { key: 'unit', label: 'Unit price', visible: true },
    { key: 'amount', label: 'Amount', visible: true },
  ],
};

const EVIDENCE_DEFAULTS = {
  visible: true,
  sectionType: 'list' as const,
  label: 'Evidence Files',
};

const HISTORY_DEFAULTS = {
  visible: true,
  sectionType: 'list' as const,
  label: 'History',
};

const DECISION_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Approval Box',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className={cn('min-w-0 truncate text-sm font-medium', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}

export default function CashReceiptDetailPage() {
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'approved' | 'returned' | null>(null);

  const header = useSectionConfig('receipt-detail-header', HEADER_DEFAULTS);
  const summary = useSectionConfig('receipt-detail-summary', SUMMARY_DEFAULTS);
  const items = useSectionConfig('receipt-detail-items', ITEMS_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(items, key, fallback);

  const itemsTotal = LINE_ITEMS.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <EditableSection id="receipt-detail-header" defaults={HEADER_DEFAULTS}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/cash-receipt" aria-label="Back to the cash receipt list">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {header.subtitle}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight">{header.title}</h1>
                <Badge variant={decision === 'approved' ? 'success' : 'secondary'}>
                  {decision === 'approved'
                    ? 'Approved'
                    : decision === 'returned'
                      ? 'Returned'
                      : RECEIPT.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>
      </EditableSection>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <EditableSection id="receipt-detail-summary" defaults={SUMMARY_DEFAULTS}>
            <Card className="p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold">Receipt</h2>
              {columnOn(summary, 'receiptNo') && (
                <Field
                  label={columnLabel(summary, 'receiptNo', 'Receipt No.')}
                  value={RECEIPT.receiptNo}
                  mono
                />
              )}
              {columnOn(summary, 'date') && (
                <Field label={columnLabel(summary, 'date', 'Date')} value={RECEIPT.date} />
              )}
              {columnOn(summary, 'supplier') && (
                <Field
                  label={columnLabel(summary, 'supplier', 'Supplier')}
                  value={RECEIPT.supplier}
                />
              )}
              {columnOn(summary, 'bizNo') && (
                <Field
                  label={columnLabel(summary, 'bizNo', 'Business No.')}
                  value={RECEIPT.bizNo}
                  mono
                />
              )}
              {columnOn(summary, 'purpose') && (
                <Field label={columnLabel(summary, 'purpose', 'Purpose')} value={RECEIPT.purpose} />
              )}
              {columnOn(summary, 'costCentre') && (
                <Field
                  label={columnLabel(summary, 'costCentre', 'Cost centre')}
                  value={RECEIPT.costCentre}
                />
              )}
              {columnOn(summary, 'method') && (
                <Field
                  label={columnLabel(summary, 'method', 'Payment method')}
                  value={RECEIPT.method}
                />
              )}
              {columnOn(summary, 'submittedBy') && (
                <Field
                  label={columnLabel(summary, 'submittedBy', 'Submitted by')}
                  value={`${RECEIPT.submittedBy} · ${RECEIPT.submittedAt}`}
                />
              )}
            </Card>
          </EditableSection>

          <EditableSection id="receipt-detail-items" defaults={ITEMS_DEFAULTS}>
            <Card className="shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Line items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                      {columnOn(items, 'description') && (
                        <th className="py-2.5 pl-4">{th('description', 'Description')}</th>
                      )}
                      {columnOn(items, 'qty') && (
                        <th className="px-3 py-2.5 text-right">{th('qty', 'Qty')}</th>
                      )}
                      {columnOn(items, 'unit') && (
                        <th className="px-3 py-2.5 text-right">{th('unit', 'Unit price')}</th>
                      )}
                      {columnOn(items, 'amount') && (
                        <th className="py-2.5 pr-4 text-right">{th('amount', 'Amount')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {LINE_ITEMS.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        {columnOn(items, 'description') && (
                          <td className="py-3 pl-4 text-sm">{item.description}</td>
                        )}
                        {columnOn(items, 'qty') && (
                          <td className="text-muted-foreground px-3 py-3 text-right text-sm tabular-nums">
                            {item.qty}
                          </td>
                        )}
                        {columnOn(items, 'unit') && (
                          <td className="text-muted-foreground px-3 py-3 text-right text-sm tabular-nums">
                            {item.unit.toLocaleString()}
                          </td>
                        )}
                        {columnOn(items, 'amount') && (
                          <td className="py-3 pr-4 text-right text-sm font-medium tabular-nums">
                            {item.amount.toLocaleString()}
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
                          ['description', 'qty', 'unit'].filter((key) => columnOn(items, key))
                            .length,
                        )}
                        className="text-muted-foreground py-2.5 pl-4 text-xs"
                      >
                        Subtotal · tax {RECEIPT.taxAmount.toLocaleString()}
                      </td>
                      {columnOn(items, 'amount') && (
                        <td className="py-2.5 pr-4 text-right text-sm font-bold tabular-nums">
                          ₩{itemsTotal.toLocaleString()}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </EditableSection>
        </div>

        <div className="flex flex-col gap-6">
          <EditableSection id="receipt-detail-decision" defaults={DECISION_DEFAULTS}>
            <Card className="flex flex-col gap-3 p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Decision</h2>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note for the submitter (required when returning)"
                className="min-h-20 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setDecision('approved')}
                >
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={note.trim().length === 0}
                  onClick={() => setDecision('returned')}
                >
                  <RotateCcw className="size-3.5" />
                  Return
                </Button>
              </div>
              {decision && (
                <p
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                    decision === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {decision === 'approved' ? (
                    <Check className="size-3" />
                  ) : (
                    <X className="size-3" />
                  )}
                  {decision === 'approved'
                    ? 'Approved — the charge moves to the July batch.'
                    : 'Returned to Kim Minsu with your note.'}
                </p>
              )}
            </Card>
          </EditableSection>

          <EditableSection id="receipt-detail-evidence" defaults={EVIDENCE_DEFAULTS}>
            <Card className="shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Evidence</h2>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Paperclip className="size-2.5" />
                  {EVIDENCE.length}
                </Badge>
              </div>
              <div className="flex flex-col">
                {EVIDENCE.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 border-b px-4 py-2.5 last:border-0"
                  >
                    <FileText className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.name}</span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">{file.size}</span>
                  </div>
                ))}
              </div>
            </Card>
          </EditableSection>

          <EditableSection id="receipt-detail-history" defaults={HISTORY_DEFAULTS}>
            <Card className="p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">History</h2>
              <div className="flex flex-col gap-3">
                {HISTORY.map((entry) => (
                  <div key={entry.id} className="flex gap-2.5">
                    <span className="bg-muted mt-1 size-1.5 shrink-0 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-xs">{entry.what}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {entry.who} · {entry.when}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <p className="text-muted-foreground text-[11px]">
                Receipt number replaces the internal id in every list — June change request.
              </p>
            </Card>
          </EditableSection>
        </div>
      </div>
    </div>
  );
}
