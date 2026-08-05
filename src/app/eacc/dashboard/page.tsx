'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Clock,
  CreditCard,
  Receipt,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, Card, Progress, cn } from '@/components/ui';
import {
  EditableSection,
  cardLabel,
  cardOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

interface Stat {
  id: string;
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  tone: 'blue' | 'emerald' | 'amber' | 'red';
}

const STATS: Stat[] = [
  {
    id: 'spend',
    label: 'July spend',
    value: '₩48,720,400',
    delta: '+8.2%',
    up: true,
    tone: 'blue',
  },
  {
    id: 'pending',
    label: 'Waiting on me',
    value: '12',
    delta: '4 overdue',
    up: false,
    tone: 'amber',
  },
  { id: 'closed', label: 'Closed this month', value: '187 / 234', tone: 'emerald' },
  { id: 'blocked', label: 'Blocked items', value: '8', delta: '+2 today', up: true, tone: 'red' },
];

const TONE_CLASS: Record<Stat['tone'], string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/30',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/30',
  amber: 'bg-amber-50 dark:bg-amber-950/30',
  red: 'bg-red-50 dark:bg-red-950/30',
};

const VALUE_CLASS: Record<Stat['tone'], string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

interface Task {
  id: string;
  title: string;
  detail: string;
  due: string;
  tone: 'danger' | 'warning' | 'info';
  href: string;
}

const TASKS: Task[] = [
  {
    id: 't-1',
    title: '8 items blocking the close',
    detail: 'Missing evidence in Operations and R&D',
    due: 'Due 2026-08-05',
    tone: 'danger',
    href: '/eacc/close/blockers',
  },
  {
    id: 't-2',
    title: '12 corporate card charges to approve',
    detail: 'July 2026 · ₩3,684,900',
    due: 'Due 2026-08-02',
    tone: 'warning',
    href: '/eacc/corp-card',
  },
  {
    id: 't-3',
    title: '4 personal expenses returned',
    detail: 'Waiting on the submitter to fix and resend',
    due: 'No deadline',
    tone: 'info',
    href: '/eacc/personal-expense',
  },
];

interface Recent {
  id: string;
  what: string;
  who: string;
  when: string;
  amount: string;
  icon: typeof CreditCard;
}

const RECENT: Recent[] = [
  {
    id: 'r-1',
    what: 'Corporate card · Amazon Web Services',
    who: 'Kim Minsu',
    when: '10 min ago',
    amount: '₩1,240,000',
    icon: CreditCard,
  },
  {
    id: 'r-2',
    what: 'Cash receipt · Stationery World Co.',
    who: 'Kim Minsu',
    when: '1 hour ago',
    amount: '₩128,000',
    icon: Receipt,
  },
  {
    id: 'r-3',
    what: 'Personal expense · Client dinner',
    who: 'Lee Jiyeon',
    when: '3 hours ago',
    amount: '₩186,000',
    icon: Wallet,
  },
  {
    id: 'r-4',
    what: 'Corporate card · Korean Air',
    who: 'Shin Hyunjung',
    when: 'Yesterday',
    amount: '₩1,820,000',
    icon: CreditCard,
  },
];

const CATEGORIES = [
  { label: 'Software', share: 34, amount: '₩16,564,000' },
  { label: 'Travel', share: 27, amount: '₩13,154,500' },
  { label: 'Food & Beverage', share: 16, amount: '₩7,795,300' },
  { label: 'Office Supplies', share: 13, amount: '₩6,333,700' },
  { label: 'Other', share: 10, amount: '₩4,872,900' },
];

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Dashboard',
  subtitle: 'July 2026 · Taehyuk Park (Accountant)',
};

const STATS_DEFAULTS = {
  visible: true,
  sectionType: 'stats' as const,
  label: 'Summary Cards',
  cards: STATS.map((stat) => ({ key: stat.id, label: stat.label, visible: true })),
};

const TASKS_DEFAULTS = {
  visible: true,
  sectionType: 'list' as const,
  label: 'What Needs Me',
};

const CATEGORY_DEFAULTS = {
  visible: true,
  sectionType: 'list' as const,
  label: 'Spend by Category',
};

const RECENT_DEFAULTS = {
  visible: true,
  sectionType: 'list' as const,
  label: 'Recent Activity',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const header = useSectionConfig('dashboard-header', HEADER_DEFAULTS);
  const stats = useSectionConfig('dashboard-stats', STATS_DEFAULTS);

  return (
    <div className="flex flex-col gap-6 p-6">
      <EditableSection id="dashboard-header" defaults={HEADER_DEFAULTS}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{header.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{header.subtitle}</p>
          </div>
          <Button size="sm" asChild>
            <Link href="/eacc/close">Go to close status</Link>
          </Button>
        </div>
      </EditableSection>

      <EditableSection id="dashboard-stats" defaults={STATS_DEFAULTS}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATS.filter((stat) => cardOn(stats, stat.id)).map((stat) => (
            <div key={stat.id} className={cn('rounded-xl p-4', TONE_CLASS[stat.tone])}>
              <p className="text-muted-foreground text-xs font-medium">
                {cardLabel(stats, stat.id, stat.label)}
              </p>
              <p className={cn('mt-2 text-2xl font-bold tabular-nums', VALUE_CLASS[stat.tone])}>
                {stat.value}
              </p>
              {stat.delta && (
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
                  {stat.up ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {stat.delta}
                </p>
              )}
            </div>
          ))}
        </div>
      </EditableSection>

      <div className="grid gap-6 lg:grid-cols-3">
        <EditableSection id="dashboard-tasks" defaults={TASKS_DEFAULTS} className="lg:col-span-2">
          <Card className="flex h-full flex-col shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">What needs me</h2>
              <Badge variant="secondary" className="text-[10px]">
                {TASKS.length} items
              </Badge>
            </div>
            <div className="flex flex-col">
              {TASKS.map((task) => (
                <Link
                  key={task.id}
                  href={task.href}
                  className="hover:bg-muted/40 flex items-center gap-3 border-b px-4 py-3 last:border-0"
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg',
                      task.tone === 'danger' && 'bg-red-500/15 text-red-600 dark:text-red-400',
                      task.tone === 'warning' &&
                        'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      task.tone === 'info' && 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    )}
                  >
                    {task.tone === 'danger' ? (
                      <TriangleAlert className="size-4" />
                    ) : (
                      <Clock className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-muted-foreground truncate text-xs">{task.detail}</p>
                  </div>
                  <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                    {task.due}
                  </span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              ))}
            </div>
          </Card>
        </EditableSection>

        <EditableSection id="dashboard-categories" defaults={CATEGORY_DEFAULTS}>
          <Card className="flex h-full flex-col shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Spend by category</h2>
              <p className="text-muted-foreground text-xs">July 2026</p>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {CATEGORIES.map((category) => (
                <div key={category.label} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium">{category.label}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {category.amount}
                    </span>
                  </div>
                  <Progress value={category.share} className="h-1.5" />
                </div>
              ))}
            </div>
          </Card>
        </EditableSection>
      </div>

      <EditableSection id="dashboard-recent" defaults={RECENT_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </div>
          <div className="flex flex-col">
            {RECENT.map((entry) => {
              const Icon = entry.icon;
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
                >
                  <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="text-muted-foreground size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{entry.what}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {entry.who} · {entry.when}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{entry.amount}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
