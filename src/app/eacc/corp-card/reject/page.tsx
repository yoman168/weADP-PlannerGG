'use client';

import { ArrowLeft, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Label, Separator, Textarea } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Reject Charge',
  subtitle: 'eACC Cloud > Expense Management > Corporate Card',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Reject Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const REASONS = [
  'Missing receipt / evidence',
  'Duplicate submission',
  'Wrong cost centre',
  'Amount mismatch',
  'Not a business expense',
  'Other (please specify)',
];

export default function CorpCardRejectPage() {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const header = useSectionConfig('cc-reject-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="cc-reject-header" defaults={HEADER_DEFAULTS}>
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

        <EditableSection id="cc-reject-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="size-4" />
              <span className="text-sm font-semibold">Reject CC-2026-01423</span>
            </div>

            <p className="text-muted-foreground text-xs">
              Kim Minsu · ₩245,000 · Seoul Office Supply
            </p>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Reason</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-background h-9 rounded-md border px-3 text-sm outline-none"
              >
                <option value="">Select a reason...</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rej-note" className="text-xs">Additional note</Label>
              <Textarea
                id="rej-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Provide details so the submitter can correct and resubmit..."
                className="min-h-20 text-sm"
              />
            </div>

            {submitted && (
              <p className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400">
                <XCircle className="size-3" />
                Charge rejected and returned to Kim Minsu.
              </p>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/corp-card">Cancel</Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={!reason || submitted}
                onClick={() => setSubmitted(true)}
              >
                Reject
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
