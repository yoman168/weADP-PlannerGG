'use client';

import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Label, Separator, Textarea, cn } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

const ITEMS = [
  { id: 's-1', label: 'Type', value: 'Corporate card charge' },
  { id: 's-2', label: 'Reference', value: 'CC-2026-01423' },
  { id: 's-3', label: 'Submitted by', value: 'Kim Minsu' },
  { id: 's-4', label: 'Amount', value: '₩245,000' },
  { id: 's-5', label: 'Cost centre', value: 'IT & Infrastructure' },
  { id: 's-6', label: 'Merchant', value: 'Seoul Office Supply' },
];

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Confirm Approval',
  subtitle: 'eACC Cloud > Approvals > Confirm',
};

const BODY_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Approval Body',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function ApprovalsConfirmPage() {
  const [note, setNote] = useState('');
  const [approved, setApproved] = useState(false);

  const header = useSectionConfig('approve-confirm-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="approve-confirm-header" defaults={HEADER_DEFAULTS}>
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

        <EditableSection id="approve-confirm-body" defaults={BODY_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
              <span className="text-sm font-semibold">Approval summary</span>
            </div>

            <Separator />

            <div className="flex flex-col">
              {ITEMS.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
                  <span className="text-muted-foreground shrink-0 text-xs">{item.label}</span>
                  <span className="min-w-0 truncate text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-note" className="text-xs">Note (optional)</Label>
              <Textarea
                id="ap-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the submitter..."
                className="min-h-16 text-sm"
              />
            </div>

            {approved && (
              <p className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
              )}>
                <Check className="size-3" />
                Approved successfully. Kim Minsu has been notified.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/approvals">Cancel</Link>
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                disabled={approved}
                onClick={() => setApproved(true)}
              >
                <Check className="size-3.5" />
                Approve
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
