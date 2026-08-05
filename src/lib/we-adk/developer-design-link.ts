/**
 * What the Design tool decided, as the Developer tab needs it.
 *
 * Developer receives three inputs — the requirement from Business, the harness
 * from the org, and the design system from Design. The first two are already
 * modelled; this is the third, read from the same storage the Design tab writes
 * so there is one answer to "what does this round look like".
 *
 * Scoped to the round, not to the requirement's `targetScreens`. Those are
 * Builder screen ids (`scr-…`) while the design assignment is keyed by the
 * round's design-file ids — two namespaces with no mapping between them. Joining
 * them would mean inventing one, and a fabricated join reads as fact. The round
 * default plus a count of exceptions is what can be said truthfully.
 */

import {
  DEFAULT_DESIGN_SYSTEM,
  findDesignSystem,
  withOverrides,
  type DesignSystem,
} from './design-systems';
import { loadAssignment } from './design-system-assignment';
import {
  BASELINE_VERSION,
  isVersionLocked,
  loadVersionCount,
  loadVersionStatuses,
  versionScreens,
} from '@/lib/we-adk-mock/versions';

export interface DesignLink {
  /** The round the design work belongs to, or null when none is open. */
  version: number | null;
  /** The system every screen in the round inherits, with its edits folded in. */
  system: DesignSystem;
  /** Folders pinned to a different system. */
  folderOverrides: number;
  /** Files pinned to a different system. */
  fileOverrides: number;
  /** Blocks carrying an exception to their component spec. */
  blockOverrides: number;
  /** Whether the round has been tuned off the shipped system at all. */
  tuned: boolean;
  /**
   * The round's design files — the working set a developer builds from.
   *
   * Real files with real content behind them: each one's blocks render to HTML
   * through `designToHtml`, which is what the code view shows. Nothing here is
   * placeholder.
   */
  files: { id: string; name: string; route?: string }[];
}

/** The newest round still open — the same one the Design tab styles. */
function openVersion(projectId: string): number | null {
  const count = loadVersionCount(projectId);
  const statuses = loadVersionStatuses(projectId);
  for (let version = count; version >= BASELINE_VERSION; version -= 1) {
    if (!isVersionLocked(version, statuses)) return version;
  }
  return null;
}

/** Browser-only — the assignment lives in localStorage. */
export function loadDesignLink(projectId: string): DesignLink {
  const version = openVersion(projectId);

  if (version === null) {
    return {
      version: null,
      system: DEFAULT_DESIGN_SYSTEM,
      folderOverrides: 0,
      fileOverrides: 0,
      blockOverrides: 0,
      tuned: false,
      files: [],
    };
  }

  const assignment = loadAssignment(projectId, version);
  const base = findDesignSystem(assignment.round) ?? DEFAULT_DESIGN_SYSTEM;
  const patch = assignment.overrides[base.id];

  return {
    version,
    system: withOverrides(base, patch),
    folderOverrides: Object.keys(assignment.folders).length,
    fileOverrides: Object.keys(assignment.files).length,
    blockOverrides: Object.keys(assignment.blocks).length,
    tuned: patch !== undefined,
    files: versionScreens(projectId, version).map((screen) => ({
      id: screen.id,
      name: screen.name,
      route: screen.route,
    })),
  };
}
