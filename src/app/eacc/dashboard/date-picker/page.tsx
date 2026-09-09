'use client';

import { ArrowLeft, Calendar } from 'lucide-react';
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
  title: 'Select Period',
  subtitle: 'eACC Cloud > Dashboard > Date Picker',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Date Range Form',
};

/* ------------------------------------------------------------------ */
/* Presets                                                              */
/* ------------------------------------------------------------------ */

const PRESETS = [
  { label: 'This month', from: '2026-08-01', to: '2026-08-31' },
  { label: 'Last month', from: '2026-07-01', to: '2026-07-31' },
  { label: 'This quarter', from: '2026-07-01', to: '2026-09-30' },
  { label: 'Year to date', from: '2026-01-01', to: '2026-08-16' },
  { label: 'Last year', from: '2025-01-01', to: '2025-12-31' },
];

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function DashboardDatePickerPage() {
  const [from, setFrom] = useState('2026-08-01');
  const [to, setTo] = useState('2026-08-31');

  const header = useSectionConfig('datepicker-header', HEADER_DEFAULTS);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setFrom(preset.from);
    setTo(preset.to);
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="datepicker-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/dashboard" aria-label="Back to dashboard">
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

        <EditableSection id="datepicker-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">Date Range</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dp-from" className="text-xs">From</Label>
                <Input id="dp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dp-to" className="text-xs">To</Label>
                <Input id="dp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">Quick presets</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="text-muted-foreground hover:bg-muted rounded-md border px-2.5 py-1 text-xs transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/dashboard">Cancel</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/eacc/dashboard">Apply</Link>
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
