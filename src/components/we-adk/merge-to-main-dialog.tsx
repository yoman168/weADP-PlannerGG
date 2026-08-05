'use client';

/**
 * Publishing a team member's finished designs into a round.
 *
 * The User tab is where someone works on their own; this is the door back into
 * Main. It shows what each design would do to the round before anything moves —
 * added, or replacing the round's own copy — because a merge that silently
 * overwrites another person's screen is the one thing this must not be.
 */
import { ArrowRight, Code2, FolderOpen, GitMerge, Loader2, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  cn,
} from '@/components/ui';
import { ChangeMark } from '@/components/we-adk/change-mark';
import { designHtmlFileName } from '@/lib/we-adk/design-html';
import { type FileDiff } from '@/lib/we-adk/version-diff';
import {
  mergeBlocker,
  mergeCandidates,
  mergeIntoVersion,
  mergeable,
  type MergeCandidate,
  type MergeResult,
} from '@/lib/we-adk/user-merge';
import { type SketchScreen } from '@/lib/we-adk-mock/sketches';

const KIND_TONE: Record<MergeCandidate['kind'], 'success' | 'info' | 'outline'> = {
  new: 'success',
  revision: 'info',
  unchanged: 'outline',
};

/**
 * What merging this one would do, in the round's terms.
 *
 * A revision names the half that differs, the same way the explorer's tooltips
 * do — a screen has a canvas and a section layout, and knowing which one moved
 * is the difference between reviewing a merge and taking it on trust.
 */
function candidateLabel(entry: MergeCandidate): string {
  if (entry.kind === 'new') return 'Adds to the round';
  if (entry.kind === 'unchanged') return 'Already in the round';
  const parts = entry.parts ?? [];
  if (parts.length === 2) return 'Replaces canvas and layout';
  if (parts[0] === 'layout') return 'Replaces the layout';
  if (parts[0] === 'canvas') return 'Replaces the canvas';
  return 'Replaces the round’s copy';
}

/** A candidate as the explorer's A· / M· mark reads it. */
function markOf(entry: MergeCandidate): FileDiff {
  if (entry.kind === 'new') return { change: 'added' };
  if (entry.kind === 'revision') return { change: 'modified', parts: entry.parts };
  return { change: 'unchanged' };
}

export function MergeToMainDialog({
  open,
  projectId,
  version,
  versionName,
  memberName,
  memberScreens,
  onClose,
  onMerged,
}: {
  open: boolean;
  projectId: string;
  /** The round the designs go into — the one the member is working against. */
  version: number;
  versionName: string;
  memberName: string;
  memberScreens: SketchScreen[];
  onClose: () => void;
  onMerged: (result: MergeResult) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  // Read the round as the dialog opens, so what it promises matches what is
  // there now rather than what was there when the tab was first painted.
  const candidates = useMemo(
    () => (open ? mergeCandidates(projectId, version, memberScreens) : []),
    [open, projectId, version, memberScreens],
  );

  useEffect(() => {
    if (!open) return;
    // Nothing ticked to begin with. Publishing into the round is deliberate, so
    // it is chosen design by design; "Select all" is there for the round that
    // is finished in one go.
    setPicked(new Set());
    setWorking(false);
  }, [open, candidates]);

  /** Everything in the round is listed; only these can be picked. */
  const choosable = mergeable(candidates).map((entry) => entry.screen.id);
  const allPicked = choosable.length > 0 && choosable.every((id) => picked.has(id));

  const selected = candidates.filter((entry) => picked.has(entry.screen.id));
  const blocker = open ? mergeBlocker(projectId, version, selected) : null;
  const addCount = selected.filter((entry) => entry.kind === 'new').length;
  const reviseCount = selected.filter((entry) => entry.kind === 'revision').length;

  const toggle = (id: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = () => {
    if (blocker !== null || working) return;
    setWorking(true);
    const result = mergeIntoVersion(
      projectId,
      version,
      selected,
      new Date().toISOString().slice(0, 10),
    );
    setWorking(false);
    if (!result) return;
    onMerged(result);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            Merge into {versionName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          {memberName}&rsquo;s designs go into <span className="font-mono">{versionName}</span> in
          Main. Pick what is finished — the rest stays in their workspace.
        </p>

        {blocker === 'locked' ? (
          <p className="text-destructive rounded-md border px-3 py-2 text-sm">
            <span className="font-mono">{versionName}</span> has been released, so nothing can be
            merged into it. Mark it In progress first, or open the next round.
          </p>
        ) : candidates.length === 0 ? (
          // Nothing to decide, so there is no list — say which of the two
          // reasons it is rather than showing an empty box.
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-8 text-center text-sm">
            {memberName} has no designs in this round yet.
          </p>
        ) : (
          // The round as a folder: every design in it, with the ones this person
          // changed or added selectable and the rest locked — the same read-only
          // treatment a released round gets in Main. Showing them greyed rather
          // than hiding them says what the round contains.
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5 px-1 py-1 text-xs">
              <FolderOpen className="text-muted-foreground size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-mono font-medium">{versionName}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                {candidates.length}
              </span>
              <Badge variant="info" className="shrink-0 text-[10px]">
                In progress
              </Badge>
            </div>

            <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={allPicked}
                disabled={choosable.length === 0}
                onChange={() => setPicked(allPicked ? new Set() : new Set(choosable))}
                className="size-4 shrink-0 accent-blue-600"
              />
              <span className="min-w-0 flex-1">
                {allPicked ? 'Clear all' : 'Select all'} — {choosable.length} changed
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {picked.size} picked
              </span>
            </label>

            {/* Indented under the folder, the way the explorer nests a
                  round's files. */}
            <div className="ml-2 flex max-h-[70vh] min-w-0 flex-col overflow-y-auto border-l">
              {candidates.map((entry) => {
                const id = entry.screen.id;
                const locked = entry.kind === 'unchanged';
                const on = picked.has(id);
                return (
                  <label
                    key={id}
                    title={
                      locked
                        ? `${entry.screen.name} matches ${versionName} — nothing to merge`
                        : candidateLabel(entry)
                    }
                    className={cn(
                      'flex min-w-0 items-center gap-1.5 py-1 pr-1.5 pl-2 text-xs',
                      locked
                        ? 'text-muted-foreground/70 cursor-not-allowed'
                        : on
                          ? 'bg-muted/60 cursor-pointer'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground cursor-pointer',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked}
                      onChange={() => toggle(id)}
                      className="size-3.5 shrink-0 accent-blue-600"
                    />
                    <Code2 className="size-3.5 shrink-0" />
                    <span
                      className={cn('min-w-0 flex-1 truncate font-mono', locked && 'opacity-60')}
                    >
                      {designHtmlFileName(entry.screen.name)}
                    </span>
                    {/* The same A· / M· the Main explorer uses. */}
                    <ChangeMark diff={markOf(entry)} />
                    {locked && <Lock className="size-2.5 shrink-0 opacity-40" />}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {addCount} added · {reviseCount} replaced
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={run} disabled={blocker !== null || working} className="gap-1.5">
              {working ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
              Merge {selected.length} design{selected.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
