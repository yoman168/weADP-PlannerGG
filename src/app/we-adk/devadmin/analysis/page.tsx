'use client';

import { useTheme } from 'next-themes';
import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, Progress, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { StatTile } from '@/components/we-adk/stat-tile';
import { COST_TREND, GROUP_COMPARE, SELECTED_GROUP_DETAIL } from '@/lib/we-adk-mock/devadmin';

export default function AnalysisPage() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inkMuted = dark ? '#a1a1aa' : '#71717a';
  const [selectedGroup, setSelectedGroup] = useState(SELECTED_GROUP_DETAIL.group);
  const detail = SELECTED_GROUP_DETAIL;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          Select a target to see usage scale and activity in detail.
        </p>
        <Tabs defaultValue="group">
          <TabsList>
            <TabsTrigger value="group">By group</TabsTrigger>
            <TabsTrigger value="project">By project</TabsTrigger>
            <TabsTrigger value="user">By user</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-muted-foreground text-xs">This month · 2026-07-01 ~ 2026-07-31</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium">Usage comparison by group</p>
            <p className="text-muted-foreground text-xs">
              Compare usage differences across groups and see which projects drove the change.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <th className="pb-2 text-left font-normal">Group</th>
                  <th className="pb-2 text-right font-normal">Cost</th>
                  <th className="pb-2 text-right font-normal">Tokens</th>
                  <th className="pb-2 text-right font-normal">Sessions</th>
                  <th className="pb-2 text-left font-normal">Share</th>
                </tr>
              </thead>
              <tbody>
                {GROUP_COMPARE.map((row) => (
                  <tr
                    key={row.group}
                    onClick={() => setSelectedGroup(row.group)}
                    className={`cursor-pointer border-t ${row.group === selectedGroup ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                  >
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedGroup(row.group);
                        }}
                        aria-current={row.group === selectedGroup ? 'true' : undefined}
                        className="text-left"
                      >
                        <span className="block font-medium hover:underline">{row.group}</span>
                        <span className="text-muted-foreground block text-xs">
                          {row.projects} projects · {row.users} users
                        </span>
                      </button>
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.cost}</td>
                    <td className="py-2 text-right tabular-nums">{row.tokens}</td>
                    <td className="py-2 text-right tabular-nums">{row.sessions}</td>
                    <td className="w-32 py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={row.share} className="h-1.5" />
                        <span className="text-muted-foreground w-10 shrink-0 text-xs">
                          {row.share}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted-foreground text-xs">
              3 targets · select a row to see its detailed analysis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Selected group</p>
              <span className="text-muted-foreground text-xs">● Collecting normally</span>
            </div>
            <p className="text-base font-semibold">{detail.group}</p>
            <p className="text-muted-foreground text-xs">
              {detail.projects} projects · {detail.users} users
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Cost" value={detail.cost} />
              <StatTile label="Tokens" value={detail.tokens} />
              <StatTile label="Active users" value={`${detail.activeUsers}`} />
              <StatTile label="Sessions" value={detail.sessions} />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground text-xs">Model token mix</p>
              {detail.modelMix.map((entry) => (
                <div key={entry.model} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0">{entry.model}</span>
                  <Progress value={entry.share} className="h-1.5" />
                  <span className="text-muted-foreground w-10 shrink-0 text-right">
                    {entry.share}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{detail.group} cost trend</p>
              <span className="text-muted-foreground text-xs">
                Current 7/1–7/31 · Previous month 6/1–6/30 · KST
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={COST_TREND} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: dark ? '#232323' : '#ffffff',
                      border: `1px solid ${grid}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                    name="Current period"
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke={inkMuted}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    dot={false}
                    name="Previous month"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium">Cost change contribution</p>
            <p className="text-muted-foreground text-center text-xs">
              Current period − comparison period, by sub-item
              <br />
              No variance data to compare against the comparison period.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
