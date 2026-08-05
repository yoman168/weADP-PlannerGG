'use client';

import { Check, ChevronDown, Clock, RotateCcw, Search, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Input, cn } from '@/components/ui';
import {
  EditableSection,
  cardLabel,
  cardOn,
  columnLabel,
  columnOn,
  filterOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

type Kind = 'Corporate card' | 'Personal expense' | 'Cash receipt' | 'Tax invoice';

interface Approval {
  id: string;
  ref: string;
  kind: Kind;
  requester: string;
  department: string;
  amount: number;
  submitted: string;
  /** Days left before it is late. Negative means it already is. */
  dueInDays: number;
}

const QUEUE: Approval[] = [
  {
    id: 'a-1',
    ref: 'CC-2026-01188',
    kind: 'Corporate card',
    requester: 'Kim Minsu',
    department: 'IT',
    amount: 1_240_000,
    submitted: '2026-07-31',
    dueInDays: -2,
  },
  {
    id: 'a-2',
    ref: 'EXP-2026-00412',
    kind: 'Personal expense',
    requester: 'Lee Jiyeon',
    department: 'Finance',
    amount: 228_400,
    submitted: '2026-07-30',
    dueInDays: -1,
  },
  {
    id: 'a-3',
    ref: 'RCP-2026-00186',
    kind: 'Cash receipt',
    requester: 'Lee Jiyeon',
    department: 'Finance',
    amount: 45_000,
    submitted: '2026-07-30',
    dueInDays: 0,
  },
  {
    id: 'a-4',
    ref: 'TI-2026-00931',
    kind: 'Tax invoice',
    requester: 'Moon Namwon',
    department: 'Finance',
    amount: 2_080_579,
    submitted: '2026-07-29',
    dueInDays: 1,
  },
  {
    id: 'a-5',
    ref: 'CC-2026-01184',
    kind: 'Corporate card',
    requester: 'Park Seongmin',
    department: 'Operations',
    amount: 340_000,
    submitted: '2026-07-29',
    dueInDays: 1,
  },
  {
    id: 'a-6',
    ref: 'EXP-2026-00409',
    kind: 'Personal expense',
    requester: 'Choi Dongwook',
    department: 'HR',
    amount: 87_300,
    submitted: '2026-07-28',
    dueInDays: 2,
  },
  {
    id: 'a-7',
    ref: 'RCP-2026-00182',
    kind: 'Cash receipt',
    requester: 'Yoo Namwon',
    department: 'R&D',
    amount: 220_000,
    submitted: '2026-07-28',
    dueInDays: 3,
  },
  {
    id: 'a-8',
    ref: 'CC-2026-01179',
    kind: 'Corporate card',
    requester: 'Jung Minjae',
    department: 'Sales',
    amount: 58_000,
    submitted: '2026-07-27',
    dueInDays: 4,
  },
];

const KIND_VARIANT: Record<Kind, 'info' | 'secondary' | 'warning' | 'success'> = {
  'Corporate card': 'info',
  'Personal expense': 'secondary',
  'Cash receipt': 'success',
  'Tax invoice': 'warning',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Approval Queue',
  subtitle: 'Accountant > Waiting on me',
};

const STATS_DEFAULTS = {
  visible: true,
  sectionType: 'stats' as const,
  label: 'Queue Summary',
  cards: [
    { key: 'waiting', label: 'Waiting on me', visible: true },
    { key: 'overdue', label: 'Overdue', visible: true },
    { key: 'value', label: 'Total value', visible: true },
  ],
};

const FILTERS_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Filters',
  filters: [
    { key: 'search', label: 'Search', visible: true },
    { key: 'kind', label: 'Document type', visible: true },
    { key: 'scope', label: 'Scoped to me', visible: true },
  ],
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Queue Table',
  columns: [
    { key: 'ref', label: 'Reference', visible: true },
    { key: 'kind', label: 'Type', visible: true },
    { key: 'requester', label: 'Requester', visible: true },
    { key: 'department', label: 'Department', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'submitted', label: 'Submitted', visible: true },
    { key: 'due', label: 'Due', visible: true },
    { key: 'actions', label: 'Actions', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

function DueCell({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
        <TriangleAlert className="size-3" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Clock className="size-3" />
        Due today
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">in {days}d</span>;
}

export default function ApprovalsPage() {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [handled, setHandled] = useState<Record<string, 'approved' | 'returned'>>({});

  const header = useSectionConfig('approvals-header', HEADER_DEFAULTS);
  const stats = useSectionConfig('approvals-stats', STATS_DEFAULTS);
  const filters = useSectionConfig('approvals-filters', FILTERS_DEFAULTS);
  const table = useSectionConfig('approvals-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const visible = QUEUE.filter((row) => {
    const matchSearch =
      !search ||
      `${row.ref} ${row.requester} ${row.department}`.toLowerCase().includes(search.toLowerCase());
    const matchKind = kindFilter === 'all' || row.kind === kindFilter;
    return matchSearch && matchKind;
  });

  const open = visible.filter((row) => !handled[row.id]);
  const overdue = open.filter((row) => row.dueInDays < 0).length;
  const value = open.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <EditableSection id="approvals-header" defaults={HEADER_DEFAULTS}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {header.subtitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{header.title}</h1>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5">
            Delegate while away
          </Button>
        </div>
      </EditableSection>

      <EditableSection id="approvals-stats" defaults={STATS_DEFAULTS}>
        <div className="grid gap-4 sm:grid-cols-3">
          {cardOn(stats, 'waiting') && (
            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
              <p className="text-muted-foreground text-xs font-medium">
                {cardLabel(stats, 'waiting', 'Waiting on me')}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {open.length}
              </p>
            </div>
          )}
          {cardOn(stats, 'overdue') && (
            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
              <p className="text-muted-foreground text-xs font-medium">
                {cardLabel(stats, 'overdue', 'Overdue')}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {overdue}
              </p>
            </div>
          )}
          {cardOn(stats, 'value') && (
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <p className="text-muted-foreground text-xs font-medium">
                {cardLabel(stats, 'value', 'Total value')}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                ₩{value.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </EditableSection>

      <EditableSection id="approvals-filters" defaults={FILTERS_DEFAULTS}>
        <div className="flex flex-wrap items-center gap-3">
          {filterOn(filters, 'search') && (
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reference, requester…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}
          {filterOn(filters, 'kind') && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-3 py-1.5">
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="all">All types</option>
                <option value="Corporate card">Corporate card</option>
                <option value="Personal expense">Personal expense</option>
                <option value="Cash receipt">Cash receipt</option>
                <option value="Tax invoice">Tax invoice</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}
          <p className="text-muted-foreground ml-auto text-xs">
            Scoped to Taehyuk Park — you only see what you can act on.
          </p>
        </div>
      </EditableSection>

      <EditableSection id="approvals-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                  {columnOn(table, 'ref') && (
                    <th className="py-2.5 pl-4">{th('ref', 'Reference')}</th>
                  )}
                  {columnOn(table, 'kind') && <th className="px-3 py-2.5">{th('kind', 'Type')}</th>}
                  {columnOn(table, 'requester') && (
                    <th className="px-3 py-2.5">{th('requester', 'Requester')}</th>
                  )}
                  {columnOn(table, 'department') && (
                    <th className="px-3 py-2.5">{th('department', 'Department')}</th>
                  )}
                  {columnOn(table, 'amount') && (
                    <th className="px-3 py-2.5 text-right">{th('amount', 'Amount (₩)')}</th>
                  )}
                  {columnOn(table, 'submitted') && (
                    <th className="px-3 py-2.5">{th('submitted', 'Submitted')}</th>
                  )}
                  {columnOn(table, 'due') && <th className="px-3 py-2.5">{th('due', 'Due')}</th>}
                  {columnOn(table, 'actions') && (
                    <th className="py-2.5 pr-4 text-right">{th('actions', 'Actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const state = handled[row.id];
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'hover:bg-muted/40 border-b transition-colors last:border-0',
                        state && 'opacity-60',
                      )}
                    >
                      {columnOn(table, 'ref') && (
                        <td className="py-3 pl-4 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                          {row.ref}
                        </td>
                      )}
                      {columnOn(table, 'kind') && (
                        <td className="px-3 py-3">
                          <Badge variant={KIND_VARIANT[row.kind]} className="text-[11px]">
                            {row.kind}
                          </Badge>
                        </td>
                      )}
                      {columnOn(table, 'requester') && (
                        <td className="px-3 py-3 text-sm font-medium">{row.requester}</td>
                      )}
                      {columnOn(table, 'department') && (
                        <td className="text-muted-foreground px-3 py-3 text-sm">
                          {row.department}
                        </td>
                      )}
                      {columnOn(table, 'amount') && (
                        <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                          {row.amount.toLocaleString()}
                        </td>
                      )}
                      {columnOn(table, 'submitted') && (
                        <td className="text-muted-foreground px-3 py-3 text-sm tabular-nums">
                          {row.submitted}
                        </td>
                      )}
                      {columnOn(table, 'due') && (
                        <td className="px-3 py-3">
                          {state ? (
                            <Badge
                              variant={state === 'approved' ? 'success' : 'warning'}
                              className="text-[11px]"
                            >
                              {state === 'approved' ? 'Approved' : 'Returned'}
                            </Badge>
                          ) : (
                            <DueCell days={row.dueInDays} />
                          )}
                        </td>
                      )}
                      {columnOn(table, 'actions') && (
                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              disabled={Boolean(state)}
                              onClick={() =>
                                setHandled((prev) => ({ ...prev, [row.id]: 'approved' }))
                              }
                            >
                              <Check className="size-3" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground h-7 gap-1 px-2 text-xs"
                              disabled={Boolean(state)}
                              onClick={() =>
                                setHandled((prev) => ({ ...prev, [row.id]: 'returned' }))
                              }
                            >
                              <RotateCcw className="size-3" />
                              Return
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
