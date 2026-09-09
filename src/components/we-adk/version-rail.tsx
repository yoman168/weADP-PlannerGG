'use client';

/**
 * The rounds, across the top of the Developer workspace.
 *
 * Picking one scopes the whole tab to it — the task list, the Build workspace
 * and the Monitor all show that round's work and nothing else. Scope belongs
 * on the frame rather than repeated inside each tab, because the question
 * "which release am I looking at" is asked once and should stay answered as
 * you move between them.
 *
 * Business owns the rounds; this only reads them. They are the whole rail —
 * every task is in one, so there is no row beside them for work in none.
 */

import { Archive, Check, ChevronDown, ChevronRight, FolderPlus, Layers, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import {
  isVersionLocked,
  resolveVersionStatus,
  type VersionNames,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';
import { type ProjectTask } from '@/lib/we-adk-mock/tasks';
import { type VersionStatus } from '@/lib/we-adk-mock/types';

/** `'all'` is every round at once. */
export type VersionScope = number | 'all';

/**
 * What the scope is called wherever it is named outside the rail.
 *
 * Takes the names so a round reads the same in the header as in the rail that
 * chose it. Without them the rail said "Approval rework" and the list header
 * said "Version 4" — the same round, and no way for the reader to know that.
 */
export function versionScopeLabel(scope: VersionScope, names: VersionNames = {}): string {
  if (scope === 'all') return 'All versions';
  return names[scope] ?? `Version ${scope}`;
}

/**
 * The round a task shows under.
 *
 * Every task is in a round. There is no bucket beside them for work that named
 * none — a task nobody scheduled is still work this project owes, and parked in
 * a row of its own it is work nobody looks at. So a task with no version, or one
 * naming a round the project does not have, falls back to a round.
 *
 * The fallback is the OLDEST round still open, not the newest. `rounds` is newest
 * first, so this reads from the end. A newest-first fallback made an unplaced
 * task follow whichever round was created last: open a new round and every old
 * fix — and every build raised from one — appeared inside it, as though the work
 * had moved. Reading from the oldest open round instead means opening a round
 * moves nothing; only what is put in it is in it.
 */
export function taskRound(
  task: ProjectTask,
  rounds: number[],
  statuses: VersionStatuses,
): number | undefined {
  if (task.version !== undefined && rounds.includes(task.version)) return task.version;
  const open = rounds.filter((round) => !isVersionLocked(round, statuses));
  return open[open.length - 1] ?? rounds[0];
}

/** The tasks a scope shows. Kept here so every tab filters identically. */
export function tasksInScope(
  tasks: ProjectTask[],
  scope: VersionScope,
  rounds: number[],
  statuses: VersionStatuses,
): ProjectTask[] {
  if (scope === 'all') return tasks;
  return tasks.filter((task) => taskRound(task, rounds, statuses) === scope);
}

/**
 * Released or in progress, as a chip.
 *
 * Blue and emerald because that is the pair Main already uses on its version
 * chip, and a round cannot be a different colour in two places and still read as
 * one round — so the classes live here, the more primitive of the two modules,
 * and Main adds its hover states on top rather than restating the colours.
 *
 * A chip rather than a dot and a coloured word: the tinted ground carries the
 * state at a glance and the word inside it keeps the meaning, which is two jobs
 * done by one mark instead of two marks sharing a line.
 */
export const VERSION_STATUS_PILL: Record<VersionStatus, string> = {
  'In progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  Released: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
};

/* ------------------------------------------------------------------ */
/* How wide the rail is                                                */
/* ------------------------------------------------------------------ */

const WIDTH_KEY = 'we-adk:version-rail-width';
/** `w-44`, the width this rail had before it could be dragged. */
const DEFAULT_WIDTH = 176;
const MIN_WIDTH = 144;
const MAX_WIDTH = 380;

function clampWidth(value: number): number {
  return Math.min(Math.max(Math.round(value), MIN_WIDTH), MAX_WIDTH);
}

/**
 * The rail's width, remembered.
 *
 * Round names are as long as somebody decided to make them, so no fixed width is
 * right for every project — "Approval rework" fits and "Corporate card bulk
 * approve" does not. Kept globally rather than per project: it is a preference
 * about this person's screen, not a fact about the work.
 *
 * Read after mount, like everything else out of storage, so the server pass and
 * the first client render agree on the default.
 */
function useRailWidth(): [number, (next: number) => void, (next: number) => void] {
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WIDTH_KEY);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) setWidth(clampWidth(parsed));
    } catch {
      // Storage unavailable — the default width is a fine answer.
    }
  }, []);

  /** While dragging: on screen only, so a drag is not a hundred writes. */
  const preview = (next: number) => setWidth(clampWidth(next));

  /** On release: this is the width from now on. */
  const commit = (next: number) => {
    const value = clampWidth(next);
    setWidth(value);
    try {
      window.localStorage.setItem(WIDTH_KEY, String(value));
    } catch {
      // Storage unavailable — it just will not survive a reload.
    }
  };

  return [width, preview, commit];
}

const VERSION_STATUS_HOVER: Record<VersionStatus, string> = {
  Released: 'hover:bg-emerald-200 dark:hover:bg-emerald-500/25',
  'In progress': 'hover:bg-blue-200 dark:hover:bg-blue-500/25',
};

function RailButton({
  label,
  state,
  selected,
  title,
  onSelect,
  onRemove,
  onStatusToggle,
}: {
  label: string;
  state: VersionStatus;
  selected: boolean;
  title: string;
  onSelect: () => void;
  onRemove?: () => void;
  onStatusToggle?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        title={title}
        className={cn(
          'focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
          selected
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        )}
      >
        <span className="flex w-3.5 shrink-0 justify-center">
          {selected ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Layers aria-hidden className="size-3.5 opacity-60" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
        {onStatusToggle ? (
          <span
            role="button"
            tabIndex={0}
            onClickCapture={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStatusToggle();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onStatusToggle(); } }}
            title={`Mark as ${state === 'Released' ? 'In progress' : 'Released'}`}
            className={cn(
              'shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
              VERSION_STATUS_PILL[state],
              VERSION_STATUS_HOVER[state],
            )}
          >
            {state}
          </span>
        ) : (
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              VERSION_STATUS_PILL[state],
            )}
          >
            {state}
          </span>
        )}
      </button>
    </li>
  );
}

export function VersionRail({
  rounds,
  loaded = true,
  statuses,
  names,
  scope,
  onScopeChange,
  onNewVersion,
  onRemoveVersion,
  onStatusToggle,
}: {
  /** Round numbers, newest first, as Business defines them. */
  rounds: number[];
  /**
   * Whether the list has been read yet. An empty list means two different
   * things — "this project has no rounds" and "storage has not been read" — and
   * only the caller knows which. Defaults to true for the tabs that build their
   * list before rendering.
   */
  loaded?: boolean;
  statuses: VersionStatuses;
  /** Version number → the name someone gave that round, when it has one. */
  names?: VersionNames;
  scope: VersionScope;
  onScopeChange: (scope: VersionScope) => void;
  /**
   * Opens the next round. Business still owns rounds — this calls the same
   * function it does — but the rail is where you notice the round you are
   * working in has shipped, and that is where the next one should be openable.
   */
  onNewVersion?: () => void;
  onRemoveVersion?: (version: number) => void;
  onStatusToggle?: (version: number) => void;
}) {
  /**
   * A round's row, built the same way wherever it is listed.
   *
   * Declared here rather than inlined twice: the live list and the history list
   * are the same row, and two copies would be two places for the label rule to
   * drift.
   */
  const row = (round: number) => {
    const named = names?.[round];
    const locked = isVersionLocked(round, statuses);
    const baseline = round === 1 && locked;
    return (
      <RailButton
        key={round}
        label={named ?? `Version ${round}`}
        title={named ? `${named} — version ${round}` : `Version ${round}`}
        state={locked ? 'Released' : resolveVersionStatus(round, statuses)}
        selected={scope === round}
        onSelect={() => onScopeChange(round)}
        onRemove={!locked && onRemoveVersion ? () => onRemoveVersion(round) : undefined}
        onStatusToggle={!baseline && onStatusToggle ? () => onStatusToggle(round) : undefined}
      />
    );
  };

  /**
   * Shipped rounds go into history, not the list.
   *
   * The list is for rounds you can still act on. A project accumulates released
   * rounds forever, and left in place they push the one open round further down
   * every time one ships — so the rail slowly becomes a record of the past with
   * today's work at the bottom. They are kept, because what shipped is exactly
   * what someone comes looking for; they are just folded away.
   */
  const live = rounds.filter((round) => !isVersionLocked(round, statuses));
  const history = rounds.filter((round) => isVersionLocked(round, statuses));

  const selectedInHistory = typeof scope === 'number' && history.includes(scope);

  /**
   * Open, shut, or nobody has said yet.
   *
   * `null` is the third state and it is what makes this work: with a plain
   * boolean, the group had to be forced open whenever the selection lived inside
   * it — so selecting a released round left a group that could not be collapsed,
   * because every click was overruled on the next render. Once someone has
   * clicked, their answer is the answer; until then it opens if the round on
   * screen is in there.
   */
  const [historyOpen, setHistoryOpen] = useState<boolean | null>(null);
  const showHistory = historyOpen ?? selectedInHistory;

  const [width, previewWidth, commitWidth] = useRailWidth();
  /** Where the drag started, and how wide the rail was then. */
  const drag = useRef<{ x: number; width: number } | null>(null);

  return (
    <nav
      aria-label="Versions"
      style={{ width }}
      className="bg-background relative flex shrink-0 flex-col border-r max-lg:hidden"
    >
      <div className="flex shrink-0 items-center gap-1 px-3 py-2">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Versions
        </p>
        <span className="flex-1" />
        {onNewVersion && (
          <button
            type="button"
            onClick={onNewVersion}
            title="New version"
            aria-label="New version"
            className="text-muted-foreground hover:bg-muted hover:text-foreground -mr-1 rounded p-1"
          >
            <FolderPlus className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
        <ul className="flex flex-col gap-0.5 px-2">
          {live.map(row)}
          {/* Only once there are rounds to have an opinion about. The rounds are
              read from storage after mount, so an empty list on the first pass
              means "not known yet" — and saying "no round open" then is the rail
              reporting a fact it does not have. */}
          {live.length === 0 && rounds.length > 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-[11px] italic">No round open.</li>
          )}
          {/* A project with nothing in it at all — created here, never worked
              on. It gets a sentence rather than a blank column, because a rail
              showing nothing looks broken and the answer is one button away. */}
          {loaded && rounds.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-[11px] leading-relaxed italic">
              No versions yet. Open one to start.
            </li>
          )}
        </ul>

        {history.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <button
              type="button"
              // Flips what is on screen, not the stored value — so the first
              // click after an auto-open closes it, rather than setting `true`
              // on something already open and appearing to do nothing.
              onClick={() => setHistoryOpen(!showHistory)}
              aria-expanded={showHistory}
              className={cn(
                'focus-visible:ring-ring flex w-full items-center gap-1.5 px-3 py-1 text-left focus-visible:ring-2 focus-visible:outline-none',
                // Tinted while it holds the round on screen and is shut, so the
                // rail still says where you are rather than showing nothing
                // selected anywhere.
                !showHistory && selectedInHistory
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {showHistory ? (
                <ChevronDown aria-hidden className="size-3 shrink-0" />
              ) : (
                <ChevronRight aria-hidden className="size-3 shrink-0" />
              )}
              <Archive aria-hidden className="size-3 shrink-0" />
              <span className="flex-1 text-[10px] font-semibold tracking-wider uppercase">
                History
              </span>
              {!showHistory && selectedInHistory && (
                <span className="font-mono text-[10px]">v{scope}</span>
              )}
              <span className="text-[10px] tabular-nums">{history.length}</span>
            </button>

            {showHistory && (
              <ul className="mt-0.5 flex flex-col gap-0.5 px-2">{history.map(row)}</ul>
            )}
          </div>
        )}
      </div>

      {/* The drag handle: a hair of hit area straddling the border, so the border
          itself is what you reach for. It is a `separator` with a value rather
          than a bare div — the width is adjustable, and a pointer is not the only
          way people adjust things, so the arrow keys move it too. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the versions rail"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, width };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          previewWidth(drag.current.width + (event.clientX - drag.current.x));
        }}
        onPointerUp={(event) => {
          if (drag.current) {
            commitWidth(drag.current.width + (event.clientX - drag.current.x));
            drag.current = null;
          }
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') commitWidth(width - 16);
          else if (event.key === 'ArrowRight') commitWidth(width + 16);
          else return;
          event.preventDefault();
        }}
        className="hover:bg-primary/30 focus-visible:bg-primary/40 absolute inset-y-0 -right-1 w-2 cursor-col-resize transition-colors focus-visible:outline-none"
      />
    </nav>
  );
}
