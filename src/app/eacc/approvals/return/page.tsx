'use client';

import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Label, Separator, Textarea, cn } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Return for Revision',
  subtitle: 'eACC Cloud > Approvals > Return',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Return Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const REASONS = [
  'Incomplete documentation',
  'Wrong amount or calculation error',
  'Wrong cost centre / GL account',
  'Duplicate entry',
  'Needs manager pre-approval',
  'Other',
];

export default function ApprovalsReturnPage() {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [returned, setReturned] = useState(false);

  const header = useSectionConfig('approve-return-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="approve-return-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/approvals" aria-label="Back to approvals">
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

        <EditableSection id="approve-return-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <RotateCcw className="size-4" />
              <span className="text-sm font-semibold">Return CC-2026-01423</span>
            </div>

            <p className="text-muted-foreground text-xs">
              Kim Minsu · ₩245,000 · Seoul Office Supply
            </p>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Return reason</Label>
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
              <Label htmlFor="ret-note" className="text-xs">Details for the submitter</Label>
              <Textarea
                id="ret-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                className="min-h-20 text-sm"
              />
            </div>

            {returned && (
              <p className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                'bg-amber-500/15 text-amber-700 dark:text-amber-400',
              )}>
                <RotateCcw className="size-3" />
                Returned to Kim Minsu with your note.
              </p>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/approvals">Cancel</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                disabled={!reason || !note.trim() || returned}
                onClick={() => setReturned(true)}
              >
                <RotateCcw className="size-3.5" />
                Return
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
