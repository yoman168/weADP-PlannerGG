'use client';

/**
 * How far two versions of a screen have drifted, as a count.
 *
 * There used to be a side-by-side view under here that drew both designs block
 * by block. It was removed: the counts are what callers actually act on, and the
 * two rendered columns cost a lot of room to say something the numbers already
 * said. `design-diff.ts` still produces the rows, so a viewer can come back.
 */
import { cn } from '@/components/ui';
import { type DesignDiff } from '@/lib/we-adk/design-diff';

/** `+2 −1 ~3`, or nothing at all when the two sides match. */
export function DiffSummary({ diff, className }: { diff: DesignDiff; className?: string }) {
  if (diff.added + diff.removed + diff.changed === 0) return null;
  return (
    <span className={cn('shrink-0 font-mono text-[10px] tabular-nums', className)}>
      {diff.added > 0 && (
        <span className="text-emerald-600 dark:text-emerald-400">+{diff.added}</span>
      )}
      {diff.removed > 0 && (
        <span className="ml-1 text-red-600 dark:text-red-400">−{diff.removed}</span>
      )}
      {diff.changed > 0 && (
        <span className="ml-1 text-amber-600 dark:text-amber-400">~{diff.changed}</span>
      )}
    </span>
  );
}
