'use client';

/**
 * The Business log, on its own screen.
 *
 * Built like Monitor's service log, because it answers the same kind of question
 * and should not need a second way of being read: a stamp, what it belonged to,
 * and the line itself. The difference is the order — Monitor streams, so its
 * newest line is at the bottom where a terminal puts it, while this is a record
 * you come back to, and the thing you want is what happened last.
 */

import { useEffect } from 'react';
import { ArrowLeft, ScrollText, Trash2 } from 'lucide-react';
import { Button, cn } from '@/components/ui';
import {
  activityDay,
  activityStamp,
  MAX_EVENTS,
  type ActivityEvent,
} from '@/lib/we-adk-mock/activity';
import { versionDisplayName, type VersionNames } from '@/lib/we-adk-mock/versions';

export function BusinessActivityLog({
  events,
  names,
  onClose,
  onClear,
}: {
  /** Newest first, as the store keeps them. */
  events: ActivityEvent[];
  names: VersionNames;
  onClose: () => void;
  onClear: () => void;
}) {
  // Escape leaves, the same as the log screen in Monitor.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground -ml-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <ScrollText aria-hidden className="text-muted-foreground ml-1 size-3.5" />
        <h2 className="text-sm font-semibold">Activity</h2>
        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {events.length}
        </span>
        <span className="flex-1" />
        {events.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onClear}
            title="Clear the log — the work it describes is not affected"
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        )}
      </header>

      {events.length === 0 ? (
        <p className="text-muted-foreground mx-6 my-16 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
          Nothing logged yet. Save a design, open a round or release one, and it is recorded here.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {events.map((event, index) => {
            // A divider only where the day actually turns over, so a session's
            // work reads as one block rather than a dated list.
            const day = activityDay(event.at);
            const newDay = index === 0 || activityDay(events[index - 1]?.at ?? '') !== day;
            return (
              <div key={event.id}>
                {newDay && (
                  <p className="text-muted-foreground bg-muted/40 px-3 py-1 text-[10px] font-semibold tracking-wider uppercase">
                    {day}
                  </p>
                )}
                <div className="hover:bg-muted/40 flex items-baseline gap-2.5 px-3 py-1.5">
                  <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                    {activityStamp(event.at)}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                      event.version === undefined
                        ? 'text-muted-foreground bg-muted'
                        : 'bg-primary/10 text-key-accent',
                    )}
                  >
                    {event.version === undefined
                      ? 'project'
                      : versionDisplayName(event.version, names)}
                  </span>
                  <span className="min-w-0 text-xs leading-relaxed">{event.text}</span>
                </div>
              </div>
            );
          })}

          {events.length >= MAX_EVENTS && (
            <p className="text-muted-foreground px-3 py-2 text-[11px] italic">
              The oldest entries past {MAX_EVENTS} are dropped.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
