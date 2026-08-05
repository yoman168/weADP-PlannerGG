'use client';

import { Sparkles } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui';
import { StatTile } from '@/components/we-adk/stat-tile';
import { AI_USAGE_SCORE, USER_INSIGHT } from '@/lib/we-adk-mock/devadmin';

function BarRow({ label, count, share }: { label: string; count: number; share: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 shrink-0 truncate">{label}</span>
      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
      </div>
      <span className="text-muted-foreground w-20 shrink-0 text-right tabular-nums">
        {count} · {share.toFixed(1)}%
      </span>
    </div>
  );
}

function Gauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative flex size-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#059669"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold tabular-nums">{score}</span>
        <span className="text-muted-foreground text-[10px]">/100</span>
      </div>
    </div>
  );
}

export default function CoachingPage() {
  const { user, stats, sessionCharacter, workArea, skillUsage, subagentDelegation } = USER_INSIGHT;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{user} — work insights</p>
              <p className="text-muted-foreground text-xs">
                A work profile based on sessions and edited files. Not a cross-user performance
                comparison.
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" />
              Based on latest AI usage analysis
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Total sessions" value={`${stats.totalSessions}`} />
            <StatTile
              label="Editing sessions"
              value={`${stats.editSessions}`}
              hint="Sessions that included a file edit"
            />
            <StatTile label="Edited files" value={`${stats.editedFiles}`} />
            <StatTile label="Files per editing session" value={`${stats.filesPerEditSession}`} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-medium">
                Session character (share by session type)
              </p>
              {sessionCharacter.map((entry) => (
                <BarRow
                  key={entry.label}
                  label={entry.label}
                  count={entry.count}
                  share={entry.share}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                Work area (edited-file extensions) <span>top 8</span>
              </p>
              {workArea.map((entry) => (
                <BarRow key={entry.ext} label={entry.ext} count={entry.count} share={entry.share} />
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                Skill/command usage <span>reference metric · top-weighted</span>
              </p>
              {skillUsage.map((entry) => (
                <BarRow
                  key={entry.label}
                  label={entry.label}
                  count={entry.count}
                  share={entry.share}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                Subagent delegation <span>reference metric · top-weighted</span>
              </p>
              {subagentDelegation.map((entry) => (
                <BarRow
                  key={entry.label}
                  label={entry.label}
                  count={entry.count}
                  share={entry.share}
                />
              ))}
            </div>
          </div>

          <p className="text-muted-foreground text-[10px]">
            Data note: session character is derived from editable events on an edit basis.
            Change-related information is not present in the selected user's own OTEL values.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">User coaching insights</p>
              <p className="text-muted-foreground text-xs">
                AI usage analysis · {user} · this month
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Gauge score={AI_USAGE_SCORE.score} />
            <div>
              <p className="text-lg font-semibold">{AI_USAGE_SCORE.band}</p>
              <p className="text-muted-foreground text-xs">
                Average of 13 aggregated sessions (equal session weighting).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {AI_USAGE_SCORE.metrics.map((metric) => (
              <div key={metric.label} className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{metric.label}</span>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(metric.value / metric.max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {metric.value}/{metric.max}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Suggestions for improvement</p>
            <p className="text-muted-foreground text-xs">
              Improvement points drawn from recent sessions. Coaching for reference, not an
              evaluation.
            </p>
            {AI_USAGE_SCORE.suggestions.map((suggestion, index) => (
              <div key={index} className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3 text-xs">
                <p className="text-muted-foreground whitespace-pre-line italic">
                  “{suggestion.quote}”
                </p>
                <p>
                  <span className="font-medium">Try this next: </span>
                  {suggestion.advice}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
