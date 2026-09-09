/**
 * The rounds of a project, and the screens already in them.
 *
 * Assembling a round's folders means reading four separate keys out of
 * storage and threading them through `projectVersionFolders`. The IA sheet
 * needed that, and so does anything else that has to answer "what screens does
 * this project already have" — the task generator most of all, since a
 * generator that cannot see the existing screens will happily propose one that
 * already exists under a different name.
 */

import { findProject, type DesignFile, type DesignFolder } from '@/lib/we-adk-mock/projects';
import { loadGeneratedScreens, type SketchScreen } from '@/lib/we-adk-mock/sketches';
import {
  BASELINE_VERSION,
  loadRemovedVersions,
  loadSubfolders,
  loadVersionCount,
  loadVersionStatuses,
  projectVersionFolders,
  subfolderStorageKey,
  versionFolderKey,
} from '@/lib/we-adk-mock/versions';

/** Every round of a project, newest last, with the screens saved into each. */
export function loadRoundFolders(projectId: string): DesignFolder[] {
  const project = findProject(projectId);
  if (!project) return [];

  const count = loadVersionCount(projectId);
  const removed = loadRemovedVersions(projectId);
  const statuses = loadVersionStatuses(projectId);

  const created: Record<string, SketchScreen[]> = {};
  for (let version = BASELINE_VERSION; version <= Math.max(count, BASELINE_VERSION); version += 1) {
    if (removed.includes(version)) continue;
    const roundKey = versionFolderKey(projectId, version);
    created[roundKey] = loadGeneratedScreens(roundKey);
    for (const sub of loadSubfolders(projectId, version)) {
      const key = subfolderStorageKey(projectId, version, sub.id);
      created[key] = loadGeneratedScreens(key);
    }
  }

  return projectVersionFolders(project, created, count, statuses, removed).filter(
    (folder) => folder.versionNumber !== undefined,
  );
}

/** Every design file in a round, subfolders included. */
export function folderFiles(folder: DesignFolder | undefined): DesignFile[] {
  if (!folder) return [];
  return [...(folder.children ?? []).flatMap((child) => child.files), ...folder.files];
}

/**
 * The round a new screen would join — the highest-numbered one still open,
 * falling back to the newest round when every one of them is released.
 */
export function latestRound(projectId: string): DesignFolder | undefined {
  const folders = loadRoundFolders(projectId);
  if (folders.length === 0) return undefined;
  const open = folders.filter((folder) => folder.versionStatus !== 'Released');
  const pool = open.length > 0 ? open : folders;
  return pool.reduce((newest, folder) =>
    (folder.versionNumber ?? 0) > (newest.versionNumber ?? 0) ? folder : newest,
  );
}

/**
 * What Main already holds, as a block for a generation prompt.
 *
 * Without this the generator designs in a vacuum: it re-proposes screens the
 * round already has, invents a second name for one of them, and picks its own
 * conventions for labels and routes. Naming what exists is what makes a new
 * screen join the product rather than sit beside it.
 *
 * Returns an empty string when the round has no screens yet, so a first
 * generation is not handed an empty list to reason about.
 */
export function existingScreensContext(projectId: string, limit = 40): string {
  const round = latestRound(projectId);
  const files = folderFiles(round);
  if (files.length === 0) return '';

  const lines = files.slice(0, limit).map((file) => {
    const route = file.route ?? file.basedOnRoute;
    return `- ${file.name}${route ? ` (${route})` : ''}`;
  });

  const parts = [
    '',
    `Screens already in ${round?.name ?? 'the current round'} (${files.length}) — the product this task is being added to:`,
    ...lines,
  ];
  if (files.length > limit) parts.push(`- …and ${files.length - limit} more`);

  parts.push(
    '',
    'Design the new screens to sit inside this product, not beside it: reuse the',
    'naming, layout conventions and route shape above, and do not re-propose a',
    'screen that is already in the list — extend or link to it instead.',
  );
  return parts.join('\n');
}
