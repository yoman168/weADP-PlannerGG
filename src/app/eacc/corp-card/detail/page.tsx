'use client';

import { ArrowLeft, FileText, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, Card, Separator, cn } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

const CHARGE = {
  chargeNo: 'CC-2026-01423',
  date: '2026-08-12',
  card: '****9901',
  holder: 'Kim Minsu',
  merchant: 'Seoul Office Supply',
  amount: 245_000,
  tax: 22_273,
  purpose: 'Printer paper & toner cartridge',
  costCentre: 'IT & Infrastructure',
  status: 'Pending' as const,
  approver: 'Lee Jiyeon',
  submittedAt: '2026-08-12 15:38',
};

const ATTACHMENTS = [
  { id: 'a-1', name: 'card-receipt.pdf', size: '310 KB' },
  { id: 'a-2', name: 'merchant-slip.jpg', size: '142 KB' },
];

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Card Charge Detail',
  subtitle: 'eACC Cloud > Expense Management > Corporate Card',
};

const FIELDS_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Charge Fields',
  columns: [
    { key: 'chargeNo', label: 'Charge No.', visible: true },
    { key: 'date', label: 'Date', visible: true },
    { key: 'merchant', label: 'Merchant', visible: true },
    { key: 'amount', label: 'Amount', visible: true },
    { key: 'purpose', label: 'Purpose', visible: true },
    { key: 'costCentre', label: 'Cost centre', visible: true },
    { key: 'approver', label: 'Approver', visible: true },
  ],
};

const ATTACH_DEFAULTS = {
  visible: true,
  sectionType: 'list' as const,
  label: 'Attachments',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
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

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CorpCardDetailPage() {
  const header = useSectionConfig('cc-detail-header', HEADER_DEFAULTS);
  const fields = useSectionConfig('cc-detail-fields', FIELDS_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-lg">
        <EditableSection id="cc-detail-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/corp-card" aria-label="Back to corporate card list">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {header.subtitle}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">{header.title}</h1>
                <Badge variant="secondary">{CHARGE.status}</Badge>
              </div>
            </div>
          </div>
        </EditableSection>

        <EditableSection id="cc-detail-fields" defaults={FIELDS_DEFAULTS}>
          <Card className="p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Charge information</h2>
            {columnOn(fields, 'chargeNo') && (
              <Field label={columnLabel(fields, 'chargeNo', 'Charge No.')} value={CHARGE.chargeNo} mono />
            )}
            {columnOn(fields, 'date') && (
              <Field label={columnLabel(fields, 'date', 'Date')} value={CHARGE.date} />
            )}
            {columnOn(fields, 'merchant') && (
              <Field label={columnLabel(fields, 'merchant', 'Merchant')} value={CHARGE.merchant} />
            )}
            {columnOn(fields, 'amount') && (
              <Field label={columnLabel(fields, 'amount', 'Amount')} value={`₩${CHARGE.amount.toLocaleString()} (tax ₩${CHARGE.tax.toLocaleString()})`} />
            )}
            {columnOn(fields, 'purpose') && (
              <Field label={columnLabel(fields, 'purpose', 'Purpose')} value={CHARGE.purpose} />
            )}
            {columnOn(fields, 'costCentre') && (
              <Field label={columnLabel(fields, 'costCentre', 'Cost centre')} value={CHARGE.costCentre} />
            )}
            {columnOn(fields, 'approver') && (
              <Field label={columnLabel(fields, 'approver', 'Approver')} value={`${CHARGE.approver} · Card ${CHARGE.card} · ${CHARGE.holder}`} />
            )}
          </Card>
        </EditableSection>

        <EditableSection id="cc-detail-attach" defaults={ATTACH_DEFAULTS}>
          <Card className="mt-4 shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Attachments</h2>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Paperclip className="size-2.5" />
                {ATTACHMENTS.length}
              </Badge>
            </div>
            <div className="flex flex-col">
              {ATTACHMENTS.map((file) => (
                <div key={file.id} className="flex items-center gap-2 border-b px-4 py-2.5 last:border-0">
                  <FileText className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.name}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">{file.size}</span>
                </div>
              ))}
            </div>
          </Card>
        </EditableSection>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/eacc/corp-card">Close</Link>
          </Button>
          <Button size="sm" className="flex-1" asChild>
            <Link href="/eacc/approvals/confirm">Approve</Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/eacc/corp-card/reject">Reject</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
