'use client';

import { ArrowLeft, CreditCard } from 'lucide-react';
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
  title: 'New Card Charge',
  subtitle: 'eACC Cloud > Expense Management > Corporate Card',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Charge Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CorpCardNewChargePage() {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-08-16');
  const [purpose, setPurpose] = useState('');
  const [costCentre, setCostCentre] = useState('IT & Infrastructure');

  const header = useSectionConfig('new-charge-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="new-charge-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/corp-card" aria-label="Back to corporate card list">
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

        <EditableSection id="new-charge-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CreditCard className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">Card: ****9901 · Kim Minsu</span>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-merchant" className="text-xs">Merchant / Vendor</Label>
              <Input id="nc-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Stationery World Co." className="h-9 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nc-amount" className="text-xs">Amount (₩)</Label>
                <Input id="nc-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9 text-sm tabular-nums" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nc-date" className="text-xs">Transaction date</Label>
                <Input id="nc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-purpose" className="text-xs">Purpose</Label>
              <Input id="nc-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Client dinner, Office supplies" className="h-9 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-cost" className="text-xs">Cost centre</Label>
              <select
                id="nc-cost"
                value={costCentre}
                onChange={(e) => setCostCentre(e.target.value)}
                className="bg-background h-9 rounded-md border px-3 text-sm outline-none"
              >
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
                <Link href="/eacc/corp-card">Cancel</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/eacc/corp-card">Submit</Link>
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
