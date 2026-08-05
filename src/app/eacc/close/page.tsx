'use client';

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Printer,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  cn,
} from '@/components/ui';
import { type SectionConfig } from '@/components/eacc/edit-context';
import {
  EditableSection,
  cardLabel,
  cardOn,
  columnLabel,
  columnOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

const STATS = [
  { id: 'total', label: 'Total to Process', value: 234, delta: null, color: 'blue' },
  { id: 'completed', label: 'Completed', value: 187, delta: '+12 today', color: 'green' },
  { id: 'remaining', label: 'Remaining', value: 47, delta: null, color: 'amber' },
  { id: 'blocked', label: 'Blocked', value: 8, delta: null, color: 'red' },
];

interface CostCentre {
  id: string;
  name: string;
  total: number;
  done: number;
  blocked: number;
  responsible: string;
  lastActivity: string;
}

const COST_CENTRES: CostCentre[] = [
  {
    id: 'cc-it',
    name: 'IT & Infrastructure',
    total: 52,
    done: 50,
    blocked: 0,
    responsible: 'Kim Minsu',
    lastActivity: '2026-07-31 14:22',
  },
  {
    id: 'cc-fin',
    name: 'Finance & Accounting',
    total: 38,
    done: 34,
    blocked: 2,
    responsible: 'Lee Jiyeon',
    lastActivity: '2026-07-31 11:05',
  },
  {
    id: 'cc-hr',
    name: 'Human Resources',
    total: 29,
    done: 21,
    blocked: 1,
    responsible: 'Choi Dongwook',
    lastActivity: '2026-07-31 09:48',
  },
  {
    id: 'cc-ops',
    name: 'Operations',
    total: 44,
    done: 20,
    blocked: 3,
    responsible: 'Park Seongmin',
    lastActivity: '2026-07-30 17:30',
  },
  {
    id: 'cc-sales',
    name: 'Sales & Marketing',
    total: 31,
    done: 28,
    blocked: 0,
    responsible: 'Jung Minjae',
    lastActivity: '2026-07-31 13:15',
  },
  {
    id: 'cc-r&d',
    name: 'R&D',
    total: 22,
    done: 18,
    blocked: 1,
    responsible: 'Yoo Namwon',
    lastActivity: '2026-07-30 16:00',
  },
  {
    id: 'cc-legal',
    name: 'Legal & Compliance',
    total: 18,
    done: 16,
    blocked: 1,
    responsible: 'Shin Hyunjung',
    lastActivity: '2026-07-31 10:22',
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

const BG_MAP: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/30',
  green: 'bg-emerald-50 dark:bg-emerald-950/30',
  amber: 'bg-amber-50 dark:bg-amber-950/30',
  red: 'bg-red-50 dark:bg-red-950/30',
};

function pct(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

/* ------------------------------------------------------------------ */
/* Components                                                           */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, delta, color }: (typeof STATS)[number]) {
  return (
    <Card className={cn('border-0 shadow-sm', BG_MAP[color])}>
      <CardContent className="p-5">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className={cn('mt-1 text-3xl font-bold tabular-nums', COLOR_MAP[color])}>{value}</p>
        {delta && <p className="text-muted-foreground mt-1 text-xs">{delta}</p>}
      </CardContent>
    </Card>
  );
}

function CostCentreRow({ cc, table }: { cc: CostCentre; table: SectionConfig }) {
  const percent = pct(cc.done, cc.total);
  const remaining = cc.total - cc.done;

  return (
    <tr className="hover:bg-muted/40 border-b transition-colors last:border-0">
      {columnOn(table, 'name') && (
        <td className="py-3 pr-3 pl-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cc.name}</span>
            {cc.blocked > 0 && (
              <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                {cc.blocked} blocked
              </Badge>
            )}
          </div>
        </td>
      )}
      {columnOn(table, 'total') && (
        <td className="text-muted-foreground px-3 py-3 text-sm tabular-nums">{cc.total}</td>
      )}
      {columnOn(table, 'progress') && (
        <td className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Progress value={percent} className="h-2 w-28" />
            <span className="w-10 text-right text-sm font-medium tabular-nums">{percent}%</span>
          </div>
        </td>
      )}
      {columnOn(table, 'status') && (
        <td className="px-3 py-3">
          {remaining === 0 ? (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span className="text-xs font-medium">Complete</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="size-4" />
              <span className="text-xs font-medium">{remaining} remaining</span>
            </div>
          )}
        </td>
      )}
      {columnOn(table, 'responsible') && (
        <td className="text-muted-foreground px-3 py-3 text-sm">{cc.responsible}</td>
      )}
      {columnOn(table, 'lastActivity') && (
        <td className="text-muted-foreground px-3 py-3 text-xs">{cc.lastActivity}</td>
      )}
      {columnOn(table, 'action') && (
        <td className="py-3 pr-4">
          <Link href="/eacc/close/blockers">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              View <ChevronRight className="size-3" />
            </Button>
          </Link>
        </td>
      )}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Month-end Close Status',
  subtitle: 'July 2026 · Closing deadline: 2026-08-05',
};

const STATS_DEFAULTS = {
  visible: true,
  sectionType: 'stats' as const,
  label: 'Summary Cards',
  cards: STATS.map((s) => ({ key: s.id, label: s.label, visible: true })),
};

const TABLE_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Cost Centre Table',
  columns: [
    { key: 'name', label: 'Cost Centre', visible: true },
    { key: 'total', label: 'Total', visible: true },
    { key: 'progress', label: 'Progress', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'responsible', label: 'Responsible', visible: true },
    { key: 'lastActivity', label: 'Last Activity', visible: true },
    { key: 'action', label: 'Action', visible: true },
  ],
};

export default function CloseStatusPage() {
  const header = useSectionConfig('close-header', HEADER_DEFAULTS);
  const stats = useSectionConfig('close-stats', STATS_DEFAULTS);
  const table = useSectionConfig('close-table', TABLE_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);
  const shownStats = STATS.filter((stat) => cardOn(stats, stat.id));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <EditableSection id="close-header" defaults={HEADER_DEFAULTS}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{header.title}</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{header.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" />
              Export PDF
            </Button>
            <Link href="/eacc/close/blockers">
              <Button size="sm" className="gap-1.5">
                <AlertCircle className="size-3.5" />
                View Blockers
              </Button>
            </Link>
          </div>
        </div>
      </EditableSection>

      {/* Stat cards */}
      <EditableSection id="close-stats" defaults={STATS_DEFAULTS}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shownStats.map((stat) => (
            <StatCard key={stat.id} {...stat} label={cardLabel(stats, stat.id, stat.label)} />
          ))}
        </div>
      </EditableSection>

      {/* Cost centre table */}
      <EditableSection id="close-table" defaults={TABLE_DEFAULTS}>
        <Card className="shadow-sm">
          <CardHeader className="px-4 py-3 border-b">
            <CardTitle className="text-base font-semibold">By Cost Centre</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  {columnOn(table, 'name') && (
                    <th className="py-2.5 pr-3 pl-4">{th('name', 'Cost Centre')}</th>
                  )}
                  {columnOn(table, 'total') && (
                    <th className="px-3 py-2.5">{th('total', 'Total')}</th>
                  )}
                  {columnOn(table, 'progress') && (
                    <th className="px-3 py-2.5">{th('progress', 'Progress')}</th>
                  )}
                  {columnOn(table, 'status') && (
                    <th className="px-3 py-2.5">{th('status', 'Status')}</th>
                  )}
                  {columnOn(table, 'responsible') && (
                    <th className="px-3 py-2.5">{th('responsible', 'Responsible')}</th>
                  )}
                  {columnOn(table, 'lastActivity') && (
                    <th className="px-3 py-2.5">{th('lastActivity', 'Last Activity')}</th>
                  )}
                  {columnOn(table, 'action') && <th className="py-2.5 pr-4" />}
                </tr>
              </thead>
              <tbody>
                {COST_CENTRES.map((cc) => (
                  <CostCentreRow key={cc.id} cc={cc} table={table} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
