'use client';

/**
 * The rounds, down the left edge of the whole Business tab.
 *
 * Same rail the Developer tab uses, in the same place: the far left, full
 * height, with the tab bar beside it rather than above it. A round is the unit
 * both tabs work in, so choosing one is frame furniture — it should not sit
 * inside one of the views it scopes.
 *
 * It lives in the Business layout rather than in the workspace because that is
 * the only place that is a sibling of the tab bar. That means it holds no state
 * of its own: the selected round is read from the `?folder=` query the explorer
 * already navigates by, so the rail and the tree cannot disagree about which
 * round is open, and picking a round is the same act as clicking its row.
 */

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { recordActivity } from '@/lib/we-adk-mock/activity';
import { CreateVersionDialog } from '@/components/we-adk/create-version-dialog';
import { VersionRail } from '@/components/we-adk/version-rail';
import { findProject } from '@/lib/we-adk-mock/projects';
import { loadGeneratedScreens } from '@/lib/we-adk-mock/sketches';
import {
  BASELINE_VERSION,
  FIRST_EDITABLE_VERSION,
  createVersion,
  isVersionLocked,
  lastCompletedVersion,
  loadRemovedVersions,
  loadSubfolders,
  loadVersionCount,
  loadVersionNames,
  loadVersionStatuses,
  otherVersionStatus,
  removeVersion,
  resolveVersionStatus,
  setVersionStatus,
  subfolderStorageKey,
  versionFolderKey,
  versionFolderId,
  type VersionNames,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';

interface RailState {
  rounds: number[];
  statuses: VersionStatuses;
  names: VersionNames;
  /** False until storage has been read, so "none" can be told from "not yet". */
  loaded: boolean;
}

const EMPTY: RailState = { rounds: [], statuses: {}, names: {}, loaded: false };

export function BusinessVersionRail() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const project = findProject(params.projectId);
  const [state, setState] = useState<RailState>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<{ version: number; fileCount: number } | null>(null);

  /**
   * Read after mount, and again whenever the route changes.
   *
   * The rounds live in localStorage, so there is nothing to read during the
   * server pass. Re-reading on navigation is what keeps the counts honest: a
   * design added on Main changes one of them, and the rail has no other way to
   * hear about it.
   */
  useEffect(() => {
    if (!project) return;
    const count = loadVersionCount(project.id);
    const removed = loadRemovedVersions(project.id);
    const rounds: number[] = [];
    // From the count itself rather than a floor of one: a project created here
    // has no baseline, and inventing version 1 for it is what put a round in
    // the rail of a project that has nothing in it.
    for (let version = count; version >= BASELINE_VERSION; version -= 1) {
      if (removed.includes(version)) continue;
      rounds.push(version);
    }
    setState({
      rounds,
      statuses: loadVersionStatuses(project.id),
      names: loadVersionNames(project.id),
      loaded: true,
    });
  }, [project, pathname, searchParams]);

  if (!project) return null;

  const base = `/we-adk/projects/${project.id}/sketcher`;
  const folder = searchParams.get('folder');

  /**
   * Which round is lit: the one the explorer is in, else the newest still open.
   *
   * A folder id is either `version-4` or `version-4--<subfolder>`, so the number
   * is whatever follows the first dash — a subfolder is still inside its round,
   * and the rail should stay on that round rather than going blank.
   */
  const fromFolder = folder?.startsWith('version-')
    ? Number.parseInt(folder.slice('version-'.length), 10)
    : Number.NaN;
  const selected = state.rounds.includes(fromFolder)
    ? fromFolder
    : (state.rounds.find((round) => !isVersionLocked(round, state.statuses)) ??
      state.rounds[0] ??
      BASELINE_VERSION);

  /**
   * Where picking a round lands you.
   *
   * On a view that is about a round — Main's designs, the IA sheet, Overview's
   * summary — you stay where you are and the round changes under you. Anywhere
   * else there is nothing on screen that would react to it, so it goes to Main
   * rather than leaving a control that appears to do nothing.
   */
  const roundAware =
    pathname === base || pathname === `${base}/ia` || pathname === `${base}/overview`;
  const open = (version: number) =>
    router.push(`${roundAware ? pathname : base}?folder=${versionFolderId(version)}`);

  const countFiles = (version: number): number => {
    const rootKey = versionFolderKey(project.id, version);
    let count = loadGeneratedScreens(rootKey).length;
    for (const sub of loadSubfolders(project.id, version)) {
      count += loadGeneratedScreens(subfolderStorageKey(project.id, version, sub.id)).length;
    }
    return count;
  };

  const askRemoveVersion = (version: number) => {
    if (isVersionLocked(version, state.statuses)) return;
    const fileCount = countFiles(version);
    if (fileCount > 0) {
      setRemoving({ version, fileCount });
      return;
    }
    dropVersion(version);
  };

  const dropVersion = (version: number) => {
    removeVersion(project.id, version);
    const name = state.names[version] ?? `Version ${version}`;
    recordActivity(project.id, `${name} removed.`, version);
    setRemoving(null);
    setState((prev) => ({ ...prev, rounds: prev.rounds.filter((r) => r !== version) }));
    if (selected === version) {
      const remaining = state.rounds.filter((r) => r !== version);
      const next = remaining.find((r) => !isVersionLocked(r, state.statuses)) ?? remaining[0];
      if (next !== undefined) open(next);
      else router.push(base);
    }
  };

  return (
    <>
      <VersionRail
        rounds={state.rounds}
        loaded={state.loaded}
        statuses={state.statuses}
        names={state.names}
        scope={selected}
        onScopeChange={(next) => {
          if (next === 'all') return;
          open(next);
        }}
        onNewVersion={() => setDialogOpen(true)}
        onRemoveVersion={askRemoveVersion}
        onStatusToggle={(version) => {
          const current = resolveVersionStatus(version, state.statuses);
          const next = otherVersionStatus(current);
          const updated = setVersionStatus(project.id, version, next);
          setState((prev) => ({ ...prev, statuses: updated }));
          const name = state.names[version] ?? `Version ${version}`;
          recordActivity(project.id, `${name} marked as ${next.toLowerCase()}.`, version);
          window.dispatchEvent(new Event('we-adk:version-status'));
        }}
      />

      {/* Opening a round belongs to the list of rounds, so the dialog lives here
          rather than in the explorer — which owns the file-level actions and had
          been carrying this one only because there was nowhere else to put it. */}
      <CreateVersionDialog
        open={dialogOpen}
        nextVersion={Math.max((state.rounds[0] ?? BASELINE_VERSION) + 1, FIRST_EDITABLE_VERSION)}
        copyFrom={lastCompletedVersion(state.rounds, state.statuses)}
        onClose={() => setDialogOpen(false)}
        onCreate={(name) => {
          const created = createVersion(project, { name });
          // Logged here rather than in the explorer's toast, because opening a
          // round happens here — the explorer never hears about it, and the one
          // event a Business log is certain to be asked about is when a round
          // started.
          recordActivity(
            project.id,
            created.copy && created.copy.screens.length > 0
              ? `${created.name ?? `version ${created.version}`} opened from version ${created.copy.from} — ${created.copy.screens.length} design(s) carried over.`
              : `${created.name ?? `version ${created.version}`} opened — empty, nothing completed to copy from.`,
            created.version,
          );
          // Navigating re-runs the effect above, which is what re-reads the
          // rounds — so the new one appears without a second source of truth.
          open(created.version);
        }}
      />

      <Dialog open={removing !== null} onOpenChange={(next) => !next && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove {removing ? (state.names[removing.version] ?? `Version ${removing.version}`) : ''}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This version has {removing?.fileCount ?? 0} design file{(removing?.fileCount ?? 0) !== 1 ? 's' : ''}. Removing it will delete all files inside it.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removing && dropVersion(removing.version)}
              className="gap-1"
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
