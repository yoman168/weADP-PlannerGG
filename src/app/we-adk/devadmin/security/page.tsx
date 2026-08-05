'use client';

import { AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { StatTile } from '@/components/we-adk/stat-tile';
import { StatusChip } from '@/components/we-adk/status-chip';
import { SECURITY_DETAIL, SECURITY_ITEMS, SECURITY_TABS } from '@/lib/we-adk-mock/devadmin';

function severityBadgeVariant(tone: string) {
  if (tone === 'red') return 'danger' as const;
  if (tone === 'amber') return 'warning' as const;
  return 'muted' as const;
}

export default function SecurityPage() {
  const [tab, setTab] = useState<(typeof SECURITY_TABS)[number]['key']>('needsReview');
  const [selectedId, setSelectedId] = useState(SECURITY_DETAIL.id);
  const [outcome, setOutcome] = useState<'notAnIssue' | 'confirmed' | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-muted-foreground text-xs">Monitoring &gt; Security</p>
        <h1 className="text-lg font-semibold">Security</h1>
        <p className="text-muted-foreground text-sm">
          Review security signals detected in Claude Code sessions and manage their review status.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-red-200 dark:border-red-500/30">
          <CardContent className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium">Priority review</p>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-5" />
              <p className="text-xl font-semibold">7 high-risk items</p>
            </div>
            <p className="text-muted-foreground text-xs">Unreviewed high-severity items.</p>
            <button
              type="button"
              onClick={() => setTab('high')}
              className="text-primary flex w-fit items-center gap-1 text-xs hover:underline"
            >
              View list <ArrowRight className="size-3" />
            </button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium">Needs-review overview</p>
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                label="Total"
                value={7}
                className="border-none bg-transparent p-0 shadow-none"
              />
              <StatTile
                label="High"
                value={<span className="text-red-600 dark:text-red-400">7</span>}
                className="border-none bg-transparent p-0 shadow-none"
              />
              <StatTile
                label="Medium"
                value={<span className="text-amber-600 dark:text-amber-400">0</span>}
                className="border-none bg-transparent p-0 shadow-none"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {SECURITY_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              tab === item.key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label} {item.count}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search by file, command, type" className="h-8 w-64" />
        {['All severities', 'All types', 'Last 30 days'].map((label) => (
          <Select key={label} defaultValue="all">
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{label}</SelectItem>
            </SelectContent>
          </Select>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="w-8 px-3 py-2 text-left" />
                <th className="px-3 py-2 text-left font-medium">Severity</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Target / evidence</th>
                <th className="px-3 py-2 text-left font-medium">Project</th>
              </tr>
            </thead>
            <tbody>
              {SECURITY_ITEMS.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'cursor-pointer border-t',
                    item.id === selectedId ? 'bg-primary/5' : 'hover:bg-muted/30',
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="accent-primary size-3.5"
                      aria-label={`Select security item ${item.id}`}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={severityBadgeVariant(item.severity.tone)}>
                      {item.severity.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip {...item.type} />
                  </td>
                  <td className="px-3 py-2">
                    {/* Focusable control so the row is reachable without a mouse. */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      aria-current={item.id === selectedId ? 'true' : undefined}
                      className="block max-w-md text-left"
                    >
                      <span className="block truncate font-mono text-xs hover:underline">
                        {item.target}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.reference}
                      </span>
                    </button>
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{item.project}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Card className="h-fit">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Security item #{SECURITY_DETAIL.id}</p>
            </div>
            <p className="font-mono text-sm font-semibold">{SECURITY_DETAIL.type}</p>
            <div className="flex gap-2">
              <Badge variant={severityBadgeVariant(SECURITY_DETAIL.severity.tone)}>
                {SECURITY_DETAIL.severity.label}
              </Badge>
              <StatusChip {...SECURITY_DETAIL.status} />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border p-3 text-xs">
              <p className="text-muted-foreground font-medium">Detection evidence</p>
              <div>
                <p className="text-muted-foreground">Detected location</p>
                <p className="font-mono break-all">{SECURITY_DETAIL.location}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Detection basis</p>
                <p>{SECURITY_DETAIL.basis}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Evidence summary</p>
                <p>{SECURITY_DETAIL.summary}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Project</p>
                <p>{SECURITY_DETAIL.project}</p>
              </div>
              <div>
                <p className="text-muted-foreground">User</p>
                <p>{SECURITY_DETAIL.user}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Detected at</p>
                <p>{SECURITY_DETAIL.detectedAt}</p>
              </div>
            </div>
            <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <Lock className="size-3" />
              Shows only the location and a masked excerpt — never the original content.
            </p>

            <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-xs">
              <p className="text-muted-foreground flex items-center justify-between font-medium">
                Related session <span>work metadata collected at detection time</span>
              </p>
              <p className="font-mono">{SECURITY_DETAIL.session.id}</p>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-muted-foreground">Worked</p>
                  <p>{SECURITY_DETAIL.session.workedAt}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Branch</p>
                  <p>{SECURITY_DETAIL.session.branch}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Repository</p>
                  <p className="font-mono">{SECURITY_DETAIL.session.repo}</p>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit">
                {SECURITY_DETAIL.session.tag}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className="text-muted-foreground text-xs">
                {outcome === null
                  ? 'Select a review outcome.'
                  : outcome === 'notAnIssue'
                    ? 'Marked as not an issue.'
                    : 'Risk confirmed.'}
              </span>
              <div className="flex gap-2">
                <Button
                  variant={outcome === 'notAnIssue' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={outcome === 'notAnIssue'}
                  onClick={() =>
                    setOutcome((value) => (value === 'notAnIssue' ? null : 'notAnIssue'))
                  }
                >
                  Not an issue
                </Button>
                <Button
                  variant={outcome === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={outcome === 'confirmed'}
                  onClick={() =>
                    setOutcome((value) => (value === 'confirmed' ? null : 'confirmed'))
                  }
                >
                  Confirm risk
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
