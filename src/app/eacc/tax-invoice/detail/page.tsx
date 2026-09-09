'use client';

import { ArrowLeft, Download, FileText, Printer } from 'lucide-react';
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

const INVOICE = {
  invoiceNo: 'TI-2026-00891',
  issueDate: '2026-08-10',
  supplierName: 'Hankook Tech Solutions',
  supplierBizNo: '2208156432',
  buyerName: 'Our Company Ltd.',
  buyerBizNo: '1108734521',
  supplyAmount: 5_000_000,
  tax: 500_000,
  total: 5_500_000,
  item: 'Cloud hosting service (Aug 2026)',
  status: 'Verified' as const,
  receivedBy: 'Lee Jiyeon',
  receivedAt: '2026-08-11 09:15',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Tax Invoice Detail',
  subtitle: 'eACC Cloud > Tax & Receipts > Tax Invoice',
};

const FIELDS_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Invoice Fields',
  columns: [
    { key: 'invoiceNo', label: 'Invoice No.', visible: true },
    { key: 'issueDate', label: 'Issue date', visible: true },
    { key: 'supplier', label: 'Supplier', visible: true },
    { key: 'buyer', label: 'Buyer', visible: true },
    { key: 'item', label: 'Item', visible: true },
    { key: 'amount', label: 'Amount', visible: true },
    { key: 'receivedBy', label: 'Received by', visible: true },
  ],
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

export default function TaxInvoiceDetailPage() {
  const header = useSectionConfig('ti-detail-header', HEADER_DEFAULTS);
  const fields = useSectionConfig('ti-detail-fields', FIELDS_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-lg">
        <EditableSection id="ti-detail-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
                <Link href="/eacc/tax-invoice" aria-label="Back to tax invoice list">
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {header.subtitle}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight">{header.title}</h1>
                  <Badge variant="success">{INVOICE.status}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="size-8 p-0">
                <Printer className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="size-8 p-0">
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>
        </EditableSection>

        <EditableSection id="ti-detail-fields" defaults={FIELDS_DEFAULTS}>
          <Card className="p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="text-muted-foreground size-4" />
              <h2 className="text-sm font-semibold">Invoice</h2>
            </div>
            {columnOn(fields, 'invoiceNo') && (
              <Field label={columnLabel(fields, 'invoiceNo', 'Invoice No.')} value={INVOICE.invoiceNo} mono />
            )}
            {columnOn(fields, 'issueDate') && (
              <Field label={columnLabel(fields, 'issueDate', 'Issue date')} value={INVOICE.issueDate} />
            )}
            {columnOn(fields, 'supplier') && (
              <Field label={columnLabel(fields, 'supplier', 'Supplier')} value={`${INVOICE.supplierName} (${INVOICE.supplierBizNo})`} />
            )}
            {columnOn(fields, 'buyer') && (
              <Field label={columnLabel(fields, 'buyer', 'Buyer')} value={`${INVOICE.buyerName} (${INVOICE.buyerBizNo})`} />
            )}
            {columnOn(fields, 'item') && (
              <Field label={columnLabel(fields, 'item', 'Item')} value={INVOICE.item} />
            )}
            {columnOn(fields, 'amount') && (
              <>
                <Field label="Supply amount" value={`₩${INVOICE.supplyAmount.toLocaleString()}`} />
                <Field label="VAT (10%)" value={`₩${INVOICE.tax.toLocaleString()}`} />
                <Field label={columnLabel(fields, 'amount', 'Total')} value={`₩${INVOICE.total.toLocaleString()}`} />
              </>
            )}
            {columnOn(fields, 'receivedBy') && (
              <Field label={columnLabel(fields, 'receivedBy', 'Received by')} value={`${INVOICE.receivedBy} · ${INVOICE.receivedAt}`} />
            )}
          </Card>
        </EditableSection>

        <Separator className="my-4" />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/eacc/tax-invoice">Close</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
