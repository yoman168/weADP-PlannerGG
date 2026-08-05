'use client';

import { AlertTriangle, ArrowLeft, ChevronDown, Filter, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Input, cn } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  filterOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

interface BlockerRow {
  id: string;
  costCentre: string;
  category: 'Corporate Card' | 'Personal Expense' | 'Tax Invoice' | 'Cash Receipt';
  count: number;
  oldestDays: number;
  responsible: string;
  priority: 'High' | 'Medium' | 'Low';
  note?: string;
}

const BLOCKERS: BlockerRow[] = [
  {
    id: 'blk-1',
    costCentre: 'Operations',
    category: 'Corporate Card',
    count: 12,
    oldestDays: 8,
    responsible: 'Park Seongmin',
    priority: 'High',
    note: 'Bulk approve not yet submitted',
  },
  {
    id: 'blk-2',
    costCentre: 'Operations',
    category: 'Personal Expense',
    count: 6,
    oldestDays: 5,
    responsible: 'Park Seongmin',
    priority: 'High',
  },
  {
    id: 'blk-3',
    costCentre: 'Operations',
    category: 'Tax Invoice',
    count: 4,
    oldestDays: 3,
    responsible: 'Park Seongmin',
    priority: 'Medium',
  },
  {
    id: 'blk-4',
    costCentre: 'Finance & Accounting',
    category: 'Personal Expense',
    count: 7,
    oldestDays: 6,
    responsible: 'Lee Jiyeon',
    priority: 'High',
    note: 'Pending manager approval',
  },
  {
    id: 'blk-5',
    costCentre: 'Finance & Accounting',
    category: 'Corporate Card',
    count: 3,
    oldestDays: 2,
    responsible: 'Lee Jiyeon',
    priority: 'Medium',
  },
  {
    id: 'blk-6',
    costCentre: 'Human Resources',
    category: 'Tax Invoice',
    count: 5,
    oldestDays: 4,
    responsible: 'Choi Dongwook',
    priority: 'Medium',
    note: 'Supplier CEO column data missing',
  },
  {
    id: 'blk-7',
    costCentre: 'R&D',
    category: 'Cash Receipt',
    count: 4,
    oldestDays: 7,
    responsible: 'Yoo Namwon',
    priority: 'High',
  },
  {
    id: 'blk-8',
    costCentre: 'Legal & Compliance',
    category: 'Personal Expense',
    count: 3,
    oldestDays: 3,
    responsible: 'Shin Hyunjung',
    priority: 'Low',
  },
];

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'secondary',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Corporate Card': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'Personal Expense': 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'Tax Invoice': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'Cash Receipt': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Close Blockers by Cost Centre',
  subtitle: 'Items preventing the July 2026 month-end close',
};

const FILTERS_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Filters',
  filters: [
    { key: 'search', label: 'Search', visible: true },
    { key: 'priority', label: 'Priority', visible: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'cost-centre', label: 'Cost Centre', visible: true },
  ],
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Blockers Table',
  columns: [
    { key: 'costCentre', label: 'Cost Centre', visible: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'count', label: 'Count', visible: true },
    { key: 'oldestDays', label: 'Oldest (days)', visible: true },
    { key: 'responsible', label: 'Responsible', visible: true },
    { key: 'priority', label: 'Priority', visible: true },
    { key: 'note', label: 'Note', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CloseBlockersPage() {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');

  const filtered = BLOCKERS.filter((b) => {
    const matchSearch =
      !search ||
      b.costCentre.toLowerCase().includes(search.toLowerCase()) ||
      b.responsible.toLowerCase().includes(search.toLowerCase()) ||
      b.category.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priority === 'all' || b.priority === priority;
    return matchSearch && matchPriority;
  });

  const header = useSectionConfig('blockers-header', HEADER_DEFAULTS);
  const filters = useSectionConfig('blockers-filters', FILTERS_DEFAULTS);
  const table = useSectionConfig('blockers-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  const totalBlocked = filtered.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <EditableSection id="blockers-header" defaults={HEADER_DEFAULTS}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/eacc/close">
              <Button variant="ghost" size="sm" className="mt-0.5 gap-1 px-2">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{header.title}</h1>
              <p className="text-muted-foreground mt-0.5 text-sm">{header.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                {totalBlocked} items blocked
              </span>
            </div>
          </div>
        </div>
      </EditableSection>

      {/* Filters */}
      <EditableSection id="blockers-filters" defaults={FILTERS_DEFAULTS}>
        <div className="flex items-center gap-3">
          {filterOn(filters, 'search') && (
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cost centres, responsible…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}

          {filterOn(filters, 'priority') && (
            <div className="bg-background flex items-center gap-1.5 rounded-md border px-3 py-1.5">
              <Filter className="text-muted-foreground size-3.5" />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="all">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </div>
          )}
        </div>
      </EditableSection>

      {/* Table */}
      <EditableSection id="blockers-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  {columnOn(table, 'costCentre') && (
                    <th className="py-2.5 pr-3 pl-4">{th('costCentre', 'Cost Centre')}</th>
                  )}
                  {columnOn(table, 'category') && (
                    <th className="px-3 py-2.5">{th('category', 'Category')}</th>
                  )}
                  {columnOn(table, 'count') && (
                    <th className="px-3 py-2.5 text-center">{th('count', 'Count')}</th>
                  )}
                  {columnOn(table, 'oldestDays') && (
                    <th className="px-3 py-2.5 text-center">{th('oldestDays', 'Oldest (days)')}</th>
                  )}
                  {columnOn(table, 'responsible') && (
                    <th className="px-3 py-2.5">{th('responsible', 'Responsible')}</th>
                  )}
                  {columnOn(table, 'priority') && (
                    <th className="px-3 py-2.5">{th('priority', 'Priority')}</th>
                  )}
                  {columnOn(table, 'note') && <th className="px-3 py-2.5">{th('note', 'Note')}</th>}
                  <th className="py-2.5 pr-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((blocker) => (
                  <tr
                    key={blocker.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    {columnOn(table, 'costCentre') && (
                      <td className="py-3 pr-3 pl-4 text-sm font-medium">{blocker.costCentre}</td>
                    )}
                    {columnOn(table, 'category') && (
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            CATEGORY_COLORS[blocker.category],
                          )}
                        >
                          {blocker.category}
                        </span>
                      </td>
                    )}
                    {columnOn(table, 'count') && (
                      <td className="px-3 py-3 text-center tabular-nums">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                          {blocker.count}
                        </span>
                      </td>
                    )}
                    {columnOn(table, 'oldestDays') && (
                      <td className="px-3 py-3 text-center text-sm tabular-nums">
                        <span
                          className={cn(
                            'font-medium',
                            blocker.oldestDays >= 7
                              ? 'text-red-600'
                              : blocker.oldestDays >= 4
                                ? 'text-amber-600'
                                : 'text-muted-foreground',
                          )}
                        >
                          {blocker.oldestDays}d
                        </span>
                      </td>
                    )}
                    {columnOn(table, 'responsible') && (
                      <td className="text-muted-foreground px-3 py-3 text-sm">
                        {blocker.responsible}
                      </td>
                    )}
                    {columnOn(table, 'priority') && (
                      <td className="px-3 py-3">
                        <Badge variant={PRIORITY_VARIANT[blocker.priority]} className="text-[11px]">
                          {blocker.priority}
                        </Badge>
                      </td>
                    )}
                    {columnOn(table, 'note') && (
                      <td className="text-muted-foreground max-w-xs truncate px-3 py-3 text-xs">
                        {blocker.note ?? '—'}
                      </td>
                    )}
                    <td className="pr-4 py-3">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Remind
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              Showing {filtered.length} of {BLOCKERS.length} blockers
            </p>
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
