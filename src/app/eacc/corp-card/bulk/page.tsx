'use client';

import {
  ArrowLeft,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  Square,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Separator, cn } from '@/components/ui';
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

interface DeptBatch {
  id: string;
  department: string;
  owner: string;
  count: number;
  amount: number;
  /** Charges missing evidence — they cannot go through in a batch. */
  incomplete: number;
}

const BATCHES: DeptBatch[] = [
  { id: 'b-it', department: 'IT', owner: 'Kim Minsu', count: 24, amount: 3_820_400, incomplete: 0 },
  {
    id: 'b-finance',
    department: 'Finance',
    owner: 'Lee Jiyeon',
    count: 18,
    amount: 1_284_900,
    incomplete: 2,
  },
  {
    id: 'b-ops',
    department: 'Operations',
    owner: 'Park Seongmin',
    count: 31,
    amount: 5_640_000,
    incomplete: 0,
  },
  {
    id: 'b-hr',
    department: 'HR',
    owner: 'Choi Dongwook',
    count: 9,
    amount: 412_300,
    incomplete: 1,
  },
  {
    id: 'b-sales',
    department: 'Sales',
    owner: 'Jung Minjae',
    count: 27,
    amount: 2_910_500,
    incomplete: 0,
  },
  {
    id: 'b-rd',
    department: 'R&D',
    owner: 'Yoo Namwon',
    count: 14,
    amount: 1_760_000,
    incomplete: 3,
  },
];

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Bulk Approve — July 2026',
  subtitle: 'eACC Cloud > Expense Management > Corporate Card',
};

const PERIOD_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Period',
  filters: [
    { key: 'month', label: 'Month', visible: true },
    { key: 'department', label: 'Department', visible: true },
    { key: 'skip-incomplete', label: 'Skip incomplete', visible: true },
  ],
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Department Batches',
  columns: [
    { key: 'select', label: 'Select', visible: true },
    { key: 'department', label: 'Department', visible: true },
    { key: 'owner', label: 'Card owner', visible: true },
    { key: 'count', label: 'Charges', visible: true },
    { key: 'amount', label: 'Amount (₩)', visible: true },
    { key: 'incomplete', label: 'Missing evidence', visible: true },
  ],
};

const SUMMARY_DEFAULTS = {
  visible: true,
  sectionType: 'stats' as const,
  label: 'Approval Summary',
  cards: [
    { key: 'batches', label: 'Batches selected', visible: true },
    { key: 'charges', label: 'Charges', visible: true },
    { key: 'amount', label: 'Total amount', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CorpCardBulkPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['b-it', 'b-ops']));
  const [skipIncomplete, setSkipIncomplete] = useState(true);
  const [done, setDone] = useState(false);

  const header = useSectionConfig('bulk-header', HEADER_DEFAULTS);
  const period = useSectionConfig('bulk-period', PERIOD_DEFAULTS);
  const table = useSectionConfig('bulk-table', TABLE_DEFAULTS);
  const summary = useSectionConfig('bulk-summary', SUMMARY_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const eligible = BATCHES.filter((batch) => !skipIncomplete || batch.incomplete === 0);
  const chosen = eligible.filter((batch) => selected.has(batch.id));
  const allChosen = eligible.length > 0 && eligible.every((batch) => selected.has(batch.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allChosen ? new Set() : new Set(eligible.map((batch) => batch.id)));

  const totalCharges = chosen.reduce((sum, batch) => sum + batch.count, 0);
  const totalAmount = chosen.reduce((sum, batch) => sum + batch.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <EditableSection id="bulk-header" defaults={HEADER_DEFAULTS}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/corp-card" aria-label="Back to the corporate card list">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {header.subtitle}
              </p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{header.title}</h1>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={chosen.length === 0}
            onClick={() => setDone(true)}
          >
            <CheckSquare2 className="size-3.5" />
            Approve {chosen.length} batch{chosen.length === 1 ? '' : 'es'}
          </Button>
        </div>
      </EditableSection>

      {done && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            Approved {totalCharges} charges across {chosen.length} departments · ₩
            {totalAmount.toLocaleString()}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setDone(false)}>
            Undo
          </Button>
        </div>
      )}

      <EditableSection id="bulk-period" defaults={PERIOD_DEFAULTS}>
        <div className="flex flex-wrap items-center gap-3">
          {filterOn(period, 'month') && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-3 py-1.5">
              <CalendarDays className="text-muted-foreground size-3.5" />
              <select className="bg-transparent text-sm outline-none" defaultValue="2026-07">
                <option value="2026-07">July 2026</option>
                <option value="2026-06">June 2026</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}
          {filterOn(period, 'skip-incomplete') && (
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={skipIncomplete}
                onChange={(event) => setSkipIncomplete(event.target.checked)}
                className="size-3.5 accent-blue-600"
              />
              Skip batches with missing evidence
            </label>
          )}
          <p className="text-muted-foreground ml-auto text-xs">
            Approval is per calendar month — the whole month goes through together.
          </p>
        </div>
      </EditableSection>

      <EditableSection id="bulk-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                  {columnOn(table, 'select') && (
                    <th className="w-10 py-2.5 pr-2 pl-4">
                      <button
                        type="button"
                        onClick={toggleAll}
                        aria-label="Select every eligible batch"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {allChosen ? (
                          <CheckSquare2 className="size-4 text-blue-600" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </th>
                  )}
                  {columnOn(table, 'department') && (
                    <th className="px-3 py-2.5">{th('department', 'Department')}</th>
                  )}
                  {columnOn(table, 'owner') && (
                    <th className="px-3 py-2.5">{th('owner', 'Card owner')}</th>
                  )}
                  {columnOn(table, 'count') && (
                    <th className="px-3 py-2.5 text-right">{th('count', 'Charges')}</th>
                  )}
                  {columnOn(table, 'amount') && (
                    <th className="px-3 py-2.5 text-right">{th('amount', 'Amount (₩)')}</th>
                  )}
                  {columnOn(table, 'incomplete') && (
                    <th className="py-2.5 pr-4">{th('incomplete', 'Missing evidence')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {BATCHES.map((batch) => {
                  const blocked = skipIncomplete && batch.incomplete > 0;
                  const picked = selected.has(batch.id) && !blocked;
                  return (
                    <tr
                      key={batch.id}
                      onClick={() => !blocked && toggle(batch.id)}
                      className={cn(
                        'border-b transition-colors last:border-0',
                        blocked ? 'opacity-50' : 'hover:bg-muted/40 cursor-pointer',
                        picked && 'bg-blue-50/60 dark:bg-blue-950/20',
                      )}
                    >
                      {columnOn(table, 'select') && (
                        <td className="py-3 pr-2 pl-4">
                          {!blocked && (
                            <span className="text-muted-foreground">
                              {picked ? (
                                <CheckSquare2 className="size-4 text-blue-600" />
                              ) : (
                                <Square className="size-4" />
                              )}
                            </span>
                          )}
                        </td>
                      )}
                      {columnOn(table, 'department') && (
                        <td className="px-3 py-3 text-sm font-medium">{batch.department}</td>
                      )}
                      {columnOn(table, 'owner') && (
                        <td className="text-muted-foreground px-3 py-3 text-sm">{batch.owner}</td>
                      )}
                      {columnOn(table, 'count') && (
                        <td className="px-3 py-3 text-right text-sm tabular-nums">{batch.count}</td>
                      )}
                      {columnOn(table, 'amount') && (
                        <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                          {batch.amount.toLocaleString()}
                        </td>
                      )}
                      {columnOn(table, 'incomplete') && (
                        <td className="py-3 pr-4">
                          {batch.incomplete > 0 ? (
                            <Badge variant="warning" className="gap-1 text-[11px]">
                              <TriangleAlert className="size-3" />
                              {batch.incomplete}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
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

      <EditableSection id="bulk-summary" defaults={SUMMARY_DEFAULTS}>
        {/* Card is a column by default — this row lays the totals out across it. */}
        <Card className="flex flex-row flex-wrap items-center gap-6 p-4 shadow-sm">
          {cardOn(summary, 'batches') && (
            <div>
              <p className="text-muted-foreground text-xs">
                {cardLabel(summary, 'batches', 'Batches selected')}
              </p>
              <p className="text-xl font-bold tabular-nums">{chosen.length}</p>
            </div>
          )}
          <Separator orientation="vertical" className="hidden h-10 sm:block" />
          {cardOn(summary, 'charges') && (
            <div>
              <p className="text-muted-foreground text-xs">
                {cardLabel(summary, 'charges', 'Charges')}
              </p>
              <p className="text-xl font-bold tabular-nums">{totalCharges}</p>
            </div>
          )}
          <Separator orientation="vertical" className="hidden h-10 sm:block" />
          {cardOn(summary, 'amount') && (
            <div>
              <p className="text-muted-foreground text-xs">
                {cardLabel(summary, 'amount', 'Total amount')}
              </p>
              <p className="text-xl font-bold tabular-nums">₩{totalAmount.toLocaleString()}</p>
            </div>
          )}
          <Button
            className="ml-auto gap-1.5"
            disabled={chosen.length === 0}
            onClick={() => setDone(true)}
          >
            <CheckSquare2 className="size-3.5" />
            Approve selected
          </Button>
        </Card>
      </EditableSection>
    </div>
  );
}
