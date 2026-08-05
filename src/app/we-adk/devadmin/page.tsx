'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Area,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { StatTile } from '@/components/we-adk/stat-tile';
import {
  GROUP_USAGE,
  HEATMAP_GROUPS,
  HEATMAP_ROWS,
  MODEL_BREAKDOWN,
  SECURITY_SUMMARY,
  TOKEN_TREND,
  TOP_USERS,
  USAGE_STATS,
} from '@/lib/we-adk-mock/devadmin';

function heatColor(value: number | null, dark: boolean): string {
  if (value === null) return 'transparent';
  const intensity = Math.min(1, value / 5);
  return dark
    ? `rgba(16, 185, 129, ${0.12 + intensity * 0.55})`
    : `rgba(5, 150, 105, ${0.1 + intensity * 0.45})`;
}

function Sparkline({ points, dark }: { points: number[]; dark: boolean }) {
  const data = points.map((value, index) => ({ index, value }));
  return (
    <div className="h-6 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={dark ? '#34d399' : '#059669'}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DevAdminDashboardPage() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inkMuted = dark ? '#a1a1aa' : '#71717a';
  const totalModelTokens = MODEL_BREAKDOWN.reduce((sum, entry) => sum + entry.tokens, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Usage overview</h1>
          <p className="text-muted-foreground text-xs">
            Check token usage and estimated cost by project and user.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select defaultValue="thisMonth">
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">This month</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">2026-07-01 ~ 2026-07-31</span>
          {['All groups', 'All users', 'All models'].map((label) => (
            <Select key={label} defaultValue="all">
              <SelectTrigger size="sm" className="w-28">
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{label}</SelectItem>
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Total tokens processed"
          value={USAGE_STATS.totalTokens}
          hint={USAGE_STATS.totalTokensHint}
        />
        <StatTile label="Input / output" value={USAGE_STATS.ioTokens} hint={USAGE_STATS.ioHint} />
        <StatTile
          label="Active users"
          value={`${USAGE_STATS.activeUsers}`}
          hint={USAGE_STATS.activeUsersHint}
        />
        <StatTile
          label="Estimated cost"
          value={USAGE_STATS.estimatedCost}
          hint={USAGE_STATS.estimatedCostHint}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="size-4" />
            {SECURITY_SUMMARY.highRisk} high-risk items need review
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span>Needs review {SECURITY_SUMMARY.needsReview}</span>
            <Badge variant="danger">High {SECURITY_SUMMARY.highRisk}</Badge>
            <Badge variant="warning">Medium {SECURITY_SUMMARY.medium}</Badge>
            <Badge variant="muted">Low {SECURITY_SUMMARY.low}</Badge>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <a href="/we-adk/devadmin/security">Review security →</a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium">Token usage trend</p>
            <p className="text-muted-foreground text-xs">Daily input/output token trend</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={TOKEN_TREND} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: inkMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: inkMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: dark ? '#232323' : '#ffffff',
                      border: `1px solid ${grid}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      `${value}M`,
                      name === 'input' ? 'Input' : name === 'output' ? 'Output' : 'Total',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="input"
                    stackId="io"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="output"
                    stackId="io"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={0.25}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={inkMuted}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="text-muted-foreground flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500" /> Input tokens
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-600" /> Output tokens
              </span>
              <span className="flex items-center gap-1.5">
                <span className="border-muted-foreground inline-block w-3 border-t border-dashed" />{' '}
                This month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium">Usage by model</p>
            <p className="text-muted-foreground text-xs">Token usage and estimated cost by model</p>
            <div className="flex items-center gap-4">
              <div className="h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MODEL_BREAKDOWN}
                      dataKey="tokens"
                      nameKey="model"
                      innerRadius={38}
                      outerRadius={56}
                      paddingAngle={2}
                    >
                      {MODEL_BREAKDOWN.map((entry) => (
                        <Cell key={entry.model} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value}M`, name]}
                      contentStyle={{
                        background: dark ? '#232323' : '#ffffff',
                        border: `1px solid ${grid}`,
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 text-xs">
                {MODEL_BREAKDOWN.map((entry) => (
                  <div key={entry.model} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      {entry.model}
                    </span>
                    <span className="text-muted-foreground">{entry.share}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              {totalModelTokens.toFixed(1)}M total tokens used · Opus accounts for 76.3% of all
              tokens.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Token usage by group</p>
              <a href="/we-adk/devadmin/analysis" className="text-primary text-xs hover:underline">
                Analyze groups →
              </a>
            </div>
            <p className="text-muted-foreground text-xs">
              By project group · sorted by total tokens descending (incl. Uncategorized/non-git)
            </p>
            <div className="flex flex-col gap-3">
              {GROUP_USAGE.map((group) => (
                <div key={group.group} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{group.group}</span>
                    <span className="tabular-nums">{group.tokens}</span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${group.share}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-3 text-[11px]">
                    <span>Input {group.input}</span>
                    <span>Output {group.output}</span>
                    <span>Sessions {group.sessions}</span>
                    <span>Users {group.users}</span>
                    <span>Est. cost {group.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium">Per-user project group usage</p>
            <p className="text-muted-foreground text-xs">
              Total tokens per project group for top users (includes an Uncategorized column)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="p-1 text-left font-normal" />
                    {HEATMAP_GROUPS.map((group) => (
                      <th key={group} className="p-1 text-center font-normal">
                        {group.length > 6 ? `${group.slice(0, 6)}…` : group}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HEATMAP_ROWS.map((row) => (
                    <tr key={row.user}>
                      <td className="p-1 font-medium">{row.user}</td>
                      {row.values.map((value, index) => (
                        <td
                          key={index}
                          className="p-1 text-center"
                          style={{ backgroundColor: heatColor(value, dark) }}
                        >
                          {value === null ? '' : `${value}M`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-muted-foreground flex items-center justify-end gap-1 text-[10px]">
              Low
              <span className="flex h-2 w-16 rounded-full bg-gradient-to-r from-emerald-100 to-emerald-600 dark:from-emerald-900 dark:to-emerald-400" />
              High
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Top 5 users by token usage</p>
            <a href="/we-adk/devadmin/coaching" className="text-primary text-xs hover:underline">
              Analyze users →
            </a>
          </div>
          <p className="text-muted-foreground text-xs">
            Sorted by total tokens this period (not a performance or evaluation metric)
          </p>
          <div className="flex flex-col gap-2">
            {TOP_USERS.map((user) => (
              <div key={user.rank} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-4">{user.rank}</span>
                <span className="w-24 shrink-0 truncate font-medium">{user.name}</span>
                <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${user.costShare}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-14 shrink-0 text-right tabular-nums">
                  {user.tokens}
                </span>
                <Sparkline points={user.sparkline} dark={dark} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex w-fit items-center gap-1.5 text-xs">
        <RefreshCcw className="size-3" />
        Live · aggregated this month
      </p>
    </div>
  );
}
