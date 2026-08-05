/** Shared status-chip vocabulary across the WE-ADK mockups (mock data only, no API). */

export type ChipTone = 'neutral' | 'blue' | 'amber' | 'green' | 'red' | 'slate' | 'violet';

export interface Chip {
  label: string;
  tone: ChipTone;
}

/**
 * Where a version of the design stands: `Released` is the round that is out
 * there, `In progress` is the one being worked on. Lives here rather than in
 * versions.ts so the folder type can carry it without importing back.
 */
export type VersionStatus = 'Released' | 'In progress';

export const VERSION_STATUS_CHIPS: Record<VersionStatus, Chip> = {
  Released: { label: 'Released', tone: 'green' },
  'In progress': { label: 'In progress', tone: 'blue' },
};

export const CHIP_CLASSES: Record<ChipTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  slate: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
};
