/**
 * What a design actually is: a screen, or a popup over one.
 *
 * `DesignFileKind` already exists but answers a different question — where the
 * file came from (a concept, a variant, a copy of a live screen). This is the
 * other axis, and it is the one that changes what the design means downstream: a
 * screen is a destination with a route of its own, a popup is a thing that opens
 * on top of one and has no address. A build for each is a different job, and a
 * DESIGN.md that lists them together as pages is wrong about half of them.
 *
 * Held beside the file rather than on it, keyed by canvas id. A design file is
 * assembled on the fly from several sources — seeded sketches, generated
 * screens, prototype html — so there is no single record to add a field to, and
 * a side table is the only place the answer can live for all of them equally.
 */
import { workspaceStore } from '@/lib/api/workspace-store';

export type SurfaceKind = 'screen' | 'popup';

export const SURFACE_LABELS: Record<SurfaceKind, string> = {
  screen: 'Screen',
  popup: 'Popup',
};

/**
 * What a design is when nobody has said.
 *
 * Screen, because most designs are one and the marker is worth spending on the
 * exception. A default of "unset" would put a third state on every row that only
 * ever means "nobody has looked at this yet".
 */
export const DEFAULT_SURFACE: SurfaceKind = 'screen';

export type SurfaceMap = Record<string, SurfaceKind>;

const KEY = 'we-adk:design-surface';

export function loadSurfaces(projectId: string): SurfaceMap {
  try {
    const raw = workspaceStore.getItem(`${KEY}:${projectId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const surfaces: SurfaceMap = {};
    for (const [fileId, value] of Object.entries(parsed)) {
      // Anything unrecognised is dropped rather than shown: a stale entry would
      // otherwise render as a badge with no word in it.
      if (value === 'screen' || value === 'popup') surfaces[fileId] = value;
    }
    return surfaces;
  } catch {
    return {};
  }
}

/**
 * Mark a design, or clear the mark by passing the default.
 *
 * The default is stored as an absence, so "has anyone said what this is" stays
 * answerable and an untouched project keeps an empty map.
 */
export function setSurface(projectId: string, fileId: string, kind: SurfaceKind): SurfaceMap {
  const surfaces = { ...loadSurfaces(projectId) };
  if (kind === DEFAULT_SURFACE) delete surfaces[fileId];
  else surfaces[fileId] = kind;
  try {
    workspaceStore.setItem(`${KEY}:${projectId}`, JSON.stringify(surfaces));
  } catch {
    // Storage unavailable — the mark won't survive a reload.
  }
  return surfaces;
}

export function resolveSurface(fileId: string, surfaces: SurfaceMap): SurfaceKind {
  return surfaces[fileId] ?? DEFAULT_SURFACE;
}

/** The other one — what a toggle switches to. */
export function otherSurface(kind: SurfaceKind): SurfaceKind {
  return kind === 'screen' ? 'popup' : 'screen';
}
