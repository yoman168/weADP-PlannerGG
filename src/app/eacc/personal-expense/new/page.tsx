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
  title: 'New Personal Expense',
  subtitle: 'eACC Cloud > Expense Management > Personal Expense',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Expense Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function PersonalExpenseNewPage() {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-08-16');
  const [category, setCategory] = useState('Transportation');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Personal card');

  const header = useSectionConfig('pe-new-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="pe-new-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/personal-expense" aria-label="Back to personal expense list">
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

        <EditableSection id="pe-new-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Receipt className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">Expense entry</span>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pe-title" className="text-xs">Title</Label>
              <Input id="pe-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Taxi to client meeting" className="h-9 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pe-amount" className="text-xs">Amount (₩)</Label>
                <Input id="pe-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9 text-sm tabular-nums" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pe-date" className="text-xs">Date</Label>
                <Input id="pe-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Category</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-background h-9 rounded-md border px-3 text-sm outline-none">
                  <option>Transportation</option>
                  <option>Meals & Entertainment</option>
                  <option>Office supplies</option>
                  <option>Communication</option>
                  <option>Training</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Payment method</Label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="bg-background h-9 rounded-md border px-3 text-sm outline-none">
                  <option>Personal card</option>
                  <option>Cash</option>
                  <option>Bank transfer</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pe-desc" className="text-xs">Description</Label>
              <Input id="pe-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" className="h-9 text-sm" />
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/personal-expense">Cancel</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/eacc/personal-expense">Save & submit</Link>
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
