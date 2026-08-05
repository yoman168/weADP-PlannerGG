'use client';

/**
 * The A / M marker a design file wears in a round.
 *
 * One component rather than markup repeated per list: the explorer tree and the
 * folder view both show it, and a marker that means two different things in two
 * places is worse than no marker.
 */
import { cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { type FileDiff } from '@/lib/we-adk/version-diff';

/**
 * Why a file carries the marker it carries.
 *
 * A letter on its own leaves the obvious question unanswered, so the wording
 * names the half that differs — a screen has a canvas and a section layout, and
 * either can move on its own.
 */
export function changeLabel(t: (key: string) => string, diff: FileDiff): string {
  if (diff.change === 'added') return t('explorer.added');
  if (diff.change === 'unchanged') return t('explorer.unchanged');
  const parts = diff.parts ?? [];
  if (parts.length === 2) return t('explorer.modifiedBoth');
  if (parts[0] === 'layout') return t('explorer.modifiedLayout');
  if (parts[0] === 'canvas') return t('explorer.modifiedCanvas');
  return t('explorer.modified');
}

/**
 * `A·` or `M·` — the letter with a dot beside it. Nothing at all when unchanged.
 *
 * The dot is a middle dot in its own element rather than a full stop in the
 * text: a period sits on the baseline, so it cannot be centred against the
 * letter or grown without dragging the row's line height with it. This way
 * `items-center` lines it up with the middle of the letter and `leading-none`
 * keeps the bigger glyph from changing the row height.
 */
export function ChangeMark({ diff, className }: { diff?: FileDiff; className?: string }) {
  const { t } = useLocale();
  if (!diff || diff.change === 'unchanged') return null;

  const added = diff.change === 'added';
  const label = changeLabel(t, diff);

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center gap-[1px] font-mono text-[10px] font-semibold',
        added ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
        className,
      )}
    >
      {added ? 'A' : 'M'}
      <span aria-hidden className="text-[15px] leading-none">
        ·
      </span>
    </span>
  );
}
