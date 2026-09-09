'use client';

import { ArrowLeft, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Input, Label, Separator } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'New Cash Receipt',
  subtitle: 'eACC Cloud > Tax & Receipts > Cash Receipt',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Receipt Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CashReceiptNewPage() {
  const [supplier, setSupplier] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-08-16');
  const [purpose, setPurpose] = useState('');
  const [costCentre, setCostCentre] = useState('IT & Infrastructure');
  const [method, setMethod] = useState('Corporate card');

  const header = useSectionConfig('cr-new-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="cr-new-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/cash-receipt" aria-label="Back to cash receipt list">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {header.subtitle}
              </p>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight">{header.title}</h1>
            </div>
          </div>
        </EditableSection>

        <EditableSection id="cr-new-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Receipt className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">Receipt entry</span>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cr-supplier" className="text-xs">Supplier / Vendor</Label>
              <Input id="cr-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Stationery World Co." className="h-9 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-biz" className="text-xs">Business No.</Label>
                <Input id="cr-biz" value={bizNo} onChange={(e) => setBizNo(e.target.value)} placeholder="000-00-00000" className="h-9 font-mono text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-date" className="text-xs">Date</Label>
                <Input id="cr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-amount" className="text-xs">Amount (₩)</Label>
                <Input id="cr-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9 text-sm tabular-nums" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Payment method</Label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="bg-background h-9 rounded-md border px-3 text-sm outline-none">
                  <option>Corporate card</option>
                  <option>Cash</option>
                  <option>Bank transfer</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cr-purpose" className="text-xs">Purpose</Label>
              <Input id="cr-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Office supplies" className="h-9 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cost centre</Label>
              <select value={costCentre} onChange={(e) => setCostCentre(e.target.value)} className="bg-background h-9 rounded-md border px-3 text-sm outline-none">
                <option>IT & Infrastructure</option>
                <option>Finance</option>
                <option>Operations</option>
                <option>Sales</option>
                <option>HR</option>
                <option>R&D</option>
              </select>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/cash-receipt">Cancel</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/eacc/cash-receipt">Save</Link>
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
